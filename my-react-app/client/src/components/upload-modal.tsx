import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, FileText, CheckCircle, X } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: "uploading" | "completed" | "error";
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowseFiles = (event?: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event?.target?.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      progress: 0,
      status: "uploading" as const,
    }));

    // Prevent duplicates by filename
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const filtered = newFiles.filter((f) => !names.has(f.name));
      return [...prev, ...filtered];
    });

    // Reset input value to allow re-uploading same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = () => {
    // Mock upload completion
    const uploaded = files.map((file) => ({
      ...file,
      progress: 100,
      status: "completed" as const,
    }));
    setFiles(uploaded);
    console.log("Upload completed:", uploaded);
    setTimeout(onClose, 600);
  };

  const handleCancelUpload = () => {
    setFiles([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl" data-testid="upload-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Medical Images</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            multiple
            onChange={handleBrowseFiles}
            className="hidden"
          />

          {/* Drop Zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-secondary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            data-testid="drop-zone"
          >
            <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Drag and drop DICOM files here</h3>
            <p className="text-muted-foreground mb-4">or click to browse files</p>
            <Button
              className="bg-primary text-primary-foreground hover:opacity-90"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-browse-files"
            >
              Browse Files
            </Button>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  data-testid={`file-${file.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{file.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.status === "uploading" && (
                      <>
                        <div className="w-32">
                          <Progress value={file.progress} className="h-2" />
                        </div>
                        <span className="text-sm text-muted-foreground">{file.progress}%</span>
                      </>
                    )}
                    {file.status === "completed" && (
                      <>
                        <div className="w-32">
                          <Progress value={100} className="h-2" />
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button
              variant="secondary"
              onClick={handleCancelUpload}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              className="bg-primary text-primary-foreground hover:opacity-90"
              disabled={files.length === 0}
              data-testid="button-upload-files"
            >
              Upload Files
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
