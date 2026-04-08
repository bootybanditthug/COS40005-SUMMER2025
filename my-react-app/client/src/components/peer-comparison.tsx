import { useEffect, useState } from "react";
import { Annotation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Eye, EyeOff, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PeerAnnotation {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: "student" | "instructor";
  };
  annotations: Annotation[];
  color: string;
  visible?: boolean;
}

interface PeerComparisonProps {
  peerAnnotations: PeerAnnotation[];
  currentUserId: string;
  onToggleUserAnnotations: (entryId: string, visible: boolean) => void;
  onSelectForComparison: (entryId: string) => void;
  onComparisonModeChange?: (mode: "overlay" | "side-by-side") => void;
}

export default function PeerComparison({
  peerAnnotations,
  currentUserId,
  onToggleUserAnnotations,
  onSelectForComparison,
  onComparisonModeChange,
}: PeerComparisonProps) {
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(
    new Set([
      ...peerAnnotations.filter((peer) => peer.visible).map((peer) => peer.id),
    ])
  );
  const [comparisonMode, setComparisonMode] = useState<"overlay" | "side-by-side">("overlay");

  useEffect(() => {
    setVisibleUsers(new Set(peerAnnotations.filter((peer) => peer.visible).map((peer) => peer.id)));
  }, [peerAnnotations]);

  const handleToggleUser = (entryId: string) => {
    const newVisibleUsers = new Set(visibleUsers);
    if (newVisibleUsers.has(entryId)) {
      newVisibleUsers.delete(entryId);
    } else {
      newVisibleUsers.add(entryId);
    }
    setVisibleUsers(newVisibleUsers);
    onToggleUserAnnotations(entryId, !visibleUsers.has(entryId));
  };

  const handleSelectAll = () => {
    const allEntryIds = peerAnnotations.map((pa) => pa.id);
    setVisibleUsers(new Set(allEntryIds));
    allEntryIds.forEach((entryId) => {
      if (!visibleUsers.has(entryId)) {
        onToggleUserAnnotations(entryId, true);
      }
    });
  };

  const handleDeselectAll = () => {
    visibleUsers.forEach((entryId) => {
      onToggleUserAnnotations(entryId, false);
    });
    setVisibleUsers(new Set());
  };

  const visibleCount = visibleUsers.size;
  const totalAnnotations = peerAnnotations.reduce((sum, pa) => sum + pa.annotations.length, 0);

  const getPeerColorClass = (color: string) => {
    switch (color) {
      case "#3b82f6":
        return "bg-blue-500 border-blue-500";
      case "#10b981":
        return "bg-emerald-500 border-emerald-500";
      case "#f59e0b":
        return "bg-amber-500 border-amber-500";
      case "#ef4444":
        return "bg-red-500 border-red-500";
      case "#8b5cf6":
        return "bg-violet-500 border-violet-500";
      case "#06b6d4":
        return "bg-cyan-500 border-cyan-500";
      default:
        return "bg-slate-500 border-slate-500";
    }
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Peer Comparison
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {visibleCount} user{visibleCount !== 1 ? 's' : ''} visible • {totalAnnotations} annotations
        </p>
      </div>

      <div className="p-4 border-b border-border space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={comparisonMode === "overlay" ? "default" : "outline"}
            className="flex-1 text-xs"
            onClick={() => {
              setComparisonMode("overlay");
              onComparisonModeChange?.("overlay");
            }}
          >
            <Layers className="h-3 w-3 mr-1" />
            Overlay
          </Button>
          <Button
            size="sm"
            variant={comparisonMode === "side-by-side" ? "default" : "outline"}
            className="flex-1 text-xs"
            onClick={() => {
              setComparisonMode("side-by-side");
              onComparisonModeChange?.("side-by-side");
            }}
          >
            <Layers className="h-3 w-3 mr-1" />
            Side-by-Side
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleSelectAll}
          >
            Show All
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleDeselectAll}
          >
            Hide All
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {peerAnnotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No peer annotations yet</p>
              <p className="text-xs mt-1">Others' work will appear here</p>
            </div>
          ) : (
            peerAnnotations.map((peerAnnotation) => {
              const isVisible = visibleUsers.has(peerAnnotation.id);
              const isCurrentUser = peerAnnotation.user.id === currentUserId;

              return (
                <Card
                  key={peerAnnotation.id}
                  className={`p-3 transition-all ${
                    isVisible ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={() => handleToggleUser(peerAnnotation.id)}
                      disabled={isCurrentUser}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-3 h-3 rounded-full border-2 ${getPeerColorClass(peerAnnotation.color)}`}
                        />
                        <span className="font-medium truncate">
                          {peerAnnotation.user.firstName} {peerAnnotation.user.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {peerAnnotation.annotations.length} annotation
                          {peerAnnotation.annotations.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge
                          variant={peerAnnotation.user.role === "instructor" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {peerAnnotation.user.role}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {peerAnnotation.annotations.slice(0, 3).map((annotation, idx) => (
                          <div
                            key={annotation.id}
                            className="text-xs text-muted-foreground flex items-center gap-1"
                          >
                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                            <span className="capitalize">{annotation.type}</span>
                            {annotation.label && <span>• {annotation.label}</span>}
                          </div>
                        ))}
                        {peerAnnotation.annotations.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{peerAnnotation.annotations.length - 3} more
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-xs"
                        onClick={() => onSelectForComparison(peerAnnotation.id)}
                      >
                        {isVisible ? (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
