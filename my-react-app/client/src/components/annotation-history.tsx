import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, RotateCcw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// 🔧 Define a minimal type to avoid dependency on external schema
interface AnnotationVersion {
  id: string;
  version?: number;
  createdAt?: string;
  changeDescription?: string;
  color?: string;
  type?: string;
  label?: string;
}

interface AnnotationHistoryProps {
  versions?: AnnotationVersion[]; // ✅ optional + safe default
  currentVersion?: number;
  onVersionSelect?: (version: AnnotationVersion) => void;
  onRestore?: (version: AnnotationVersion) => void;
  onDelete?: (versionId: string) => void;
}

export default function AnnotationHistory({
  versions = [],                   // ✅ safe default
  currentVersion,
  onVersionSelect = () => {},       // ✅ safe no-op defaults
  onRestore = () => {},
  onDelete = () => {},
}: AnnotationHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const handleVersionClick = (version: AnnotationVersion) => {
    setSelectedVersion(version.id);
    onVersionSelect(version);
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Version History
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {versions.length} version{versions.length !== 1 ? "s" : ""} saved
        </p>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No version history yet</p>
              <p className="text-xs mt-1">Changes will appear here</p>
            </div>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedVersion === version.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                }`}
                onClick={() => handleVersionClick(version)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        version.version === currentVersion ? "default" : "secondary"
                      }
                    >
                      v{version.version ?? "-"}
                    </Badge>
                    {version.version === currentVersion && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {version.createdAt
                      ? formatDistanceToNow(new Date(version.createdAt), {
                          addSuffix: true,
                        })
                      : "Unknown"}
                  </span>
                </div>

                {version.changeDescription && (
                  <p className="text-sm mb-2">{version.changeDescription}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {version.color && (
                    <div
                      className="w-4 h-4 rounded-full border-2"
                      style={{
                        backgroundColor: version.color,
                        borderColor: version.color,
                      }}
                    />
                  )}
                  {version.type && <span className="capitalize">{version.type}</span>}
                  {version.label && <span>• {version.label}</span>}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-3">
                  

                  {version.version !== currentVersion && (
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(version);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete version ${version.version}? This will renumber all subsequent versions.`
                        )
                      ) {
                        onDelete(version.id);
                      }
                    }}
                    title="Delete Version"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
