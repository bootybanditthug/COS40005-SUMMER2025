import { useEffect, useRef, useState } from "react";
import { useAnnotation } from "@/hooks/use-annotation";
import { Annotation } from "@shared/schema";
import InlineTextEditor from "./inline-text-editor";

interface AnnotationCanvasProps {
  imageUrl: string;
  annotation: ReturnType<typeof useAnnotation>;
  peerAnnotations?: Map<string, { annotations: Annotation[]; color: string; visible: boolean }>;
  versionOverlay?: Annotation | null;
}

interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function AnnotationCanvas({
  imageUrl,
  annotation,
  peerAnnotations,
  versionOverlay
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageBounds, setImageBounds] = useState<ImageBounds>({ x: 0, y: 0, width: 800, height: 600 });

  const {
    annotations,
    currentAnnotation,
    startDrawing,
    updateDrawing,
    finishDrawing,
    canvasRef,
    textInputPosition,
    completeTextInput,
    cancelTextInput,
    color,
    setImageBounds: updateAnnotationImageBounds,
  } = annotation;

  useEffect(() => {
    const updateImageBounds = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const image = imageRef.current;
      if (!canvas || !image || !container) return;

      const canvasRect = canvas.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const bounds: ImageBounds = {
        x: imageRect.left - canvasRect.left,
        y: imageRect.top - canvasRect.top,
        width: imageRect.width,
        height: imageRect.height,
      };

      canvas.width = containerRect.width;
      canvas.height = containerRect.height;

      setImageBounds(bounds);
      if (updateAnnotationImageBounds) {
        updateAnnotationImageBounds({ width: bounds.width, height: bounds.height });
      }
    };

    updateImageBounds();

    const resizeObserver = new ResizeObserver(() => {
      updateImageBounds();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (imageRef.current) {
      resizeObserver.observe(imageRef.current);
    }

    window.addEventListener('resize', updateImageBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateImageBounds);
    };
  }, [imageUrl, canvasRef]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation | Partial<Annotation>, opacity: number = 1, isSelected: boolean = false) => {
    if (!ann.type || !ann.coordinates || !ann.color) return;

    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.fillStyle = ann.color + alpha;

    const coords = ann.coordinates as any;

    const imgX = imageBounds.x;
    const imgY = imageBounds.y;

    if (ann.type === "rectangle" && coords.width && coords.height) {
      ctx.strokeRect(imgX + coords.x, imgY + coords.y, coords.width, coords.height);
      ctx.fillRect(imgX + coords.x, imgY + coords.y, coords.width, coords.height);
    } else if (ann.type === "circle" && coords.radiusX && coords.radiusY) {
      ctx.beginPath();
      ctx.ellipse(imgX + coords.x, imgY + coords.y, coords.radiusX, coords.radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fill();
    } else if (ann.type === "triangle" && coords.points && Array.isArray(coords.points)) {
      ctx.beginPath();
      coords.points.forEach((point: { x: number; y: number }, index: number) => {
        if (index === 0) {
          ctx.moveTo(imgX + point.x, imgY + point.y);
        } else {
          ctx.lineTo(imgX + point.x, imgY + point.y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else if (ann.type === "polygon" && coords.points && Array.isArray(coords.points)) {
      ctx.beginPath();
      coords.points.forEach((point: { x: number; y: number }, index: number) => {
        if (index === 0) {
          ctx.moveTo(imgX + point.x, imgY + point.y);
        } else {
          ctx.lineTo(imgX + point.x, imgY + point.y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else if (ann.type === "freehand" && coords.points && Array.isArray(coords.points)) {
      ctx.beginPath();
      coords.points.forEach((point: { x: number; y: number }, index: number) => {
        if (index === 0) {
          ctx.moveTo(imgX + point.x, imgY + point.y);
        } else {
          ctx.lineTo(imgX + point.x, imgY + point.y);
        }
      });
      ctx.stroke();
    } else if (ann.type === "text") {
        if (coords.text) {
            ctx.fillStyle = ann.color;
            ctx.fillRect(imgX + coords.x, imgY + coords.y, coords.width || 200, coords.height || 40);
            ctx.strokeRect(imgX + coords.x, imgY + coords.y, coords.width || 200, coords.height || 40);
            ctx.fillStyle = "white";
            ctx.font = "14px sans-serif";
            const padding = 5;
            const maxWidth = (coords.width || 200) - (padding * 2);
            const lineHeight = 18;
            const words = coords.text.split(' ');
            let line = '';
            let yPos = imgY + coords.y + padding + lineHeight - 5;
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && i > 0) {
                    ctx.fillText(line, imgX + coords.x + padding, yPos);
                    line = words[i] + ' ';
                    yPos += lineHeight;
                    if (yPos > imgY + coords.y + (coords.height || 40) - padding) break;
                } else {
                    line = testLine;
                }
            }
            if (line.trim() && yPos <= imgY + coords.y + (coords.height || 40) - padding) {
                ctx.fillText(line, imgX + coords.x + padding, yPos);
            }
        } else {
            ctx.strokeRect(imgX + coords.x, imgY + coords.y, coords.width || 200, coords.height || 40);
        }
    }

    if (ann.label && ann.type !== "text") {
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textMetrics = ctx.measureText(ann.label);
      const padding = 5;
      const boxWidth = textMetrics.width + padding * 2;
      const boxHeight = 20;
      const boxMargin = 8;

      let shapeTopY = 0;
      let shapeCenterX = 0;

      if (ann.type === "rectangle") {
        shapeTopY = coords.y;
        shapeCenterX = coords.x + coords.width / 2;
      } else if (ann.type === "circle") {
        shapeTopY = coords.y - coords.radiusY;
        shapeCenterX = coords.x;
      } else if (["triangle", "polygon", "freehand"].includes(ann.type as string) && Array.isArray(coords.points)) {
        const xs = coords.points.map((p: any) => p.x);
        const ys = coords.points.map((p: any) => p.y);
        shapeTopY = Math.min(...ys);
        shapeCenterX = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) / 2;
      }

      const boxX = shapeCenterX - boxWidth / 2;
      const boxY = shapeTopY - boxHeight - boxMargin;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

      ctx.fillStyle = ann.color;
      ctx.fillRect(imgX + boxX, imgY + boxY, boxWidth, boxHeight);

      ctx.fillStyle = "white";
      ctx.fillText(ann.label, imgX + shapeCenterX, imgY + boxY + boxHeight / 2);

      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }
  };

  const drawSelectionIndicators = (ctx: CanvasRenderingContext2D, ann: Annotation) => {
    const coords = ann.coordinates as any;
    const imgX = imageBounds.x;
    const imgY = imageBounds.y;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (ann.type === "rectangle" && coords.width && coords.height) {
      ctx.strokeRect(imgX + coords.x - 5, imgY + coords.y - 5, coords.width + 10, coords.height + 10);

      const handles = [
        { x: imgX + coords.x, y: imgY + coords.y }, { x: imgX + coords.x + coords.width, y: imgY + coords.y },
        { x: imgX + coords.x + coords.width, y: imgY + coords.y + coords.height }, { x: imgX + coords.x, y: imgY + coords.y + coords.height },
        { x: imgX + coords.x + coords.width / 2, y: imgY + coords.y }, { x: imgX + coords.x + coords.width, y: imgY + coords.y + coords.height / 2 },
        { x: imgX + coords.x + coords.width / 2, y: imgY + coords.y + coords.height }, { x: imgX + coords.x, y: imgY + coords.y + coords.height / 2 },
      ];

      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      handles.forEach(handle => { ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8); });
    } else if (ann.type === "circle" && coords.radiusX && coords.radiusY) {
      const bbox = { x: imgX + coords.x - coords.radiusX, y: imgY + coords.y - coords.radiusY, width: coords.radiusX * 2, height: coords.radiusY * 2 };
      ctx.strokeRect(bbox.x - 5, bbox.y - 5, bbox.width + 10, bbox.height + 10);

      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(imgX + coords.x - 4, imgY + coords.y - coords.radiusY - 4, 8, 8); // Top
      ctx.fillRect(imgX + coords.x + coords.radiusX - 4, imgY + coords.y - 4, 8, 8); // Right
      ctx.fillRect(imgX + coords.x - 4, imgY + coords.y + coords.radiusY - 4, 8, 8); // Bottom
      ctx.fillRect(imgX + coords.x - coords.radiusX - 4, imgY + coords.y - 4, 8, 8); // Left
    } else if ((ann.type === "triangle" || ann.type === "polygon") && coords.points && Array.isArray(coords.points)) {
      const xs = coords.points.map((p: any) => p.x);
      const ys = coords.points.map((p: any) => p.y);
      const minX = Math.min(...xs); const maxX = Math.max(...xs);
      const minY = Math.min(...ys); const maxY = Math.max(...ys);

      ctx.strokeRect(imgX + minX - 5, imgY + minY - 5, maxX - minX + 10, maxY - minY + 10);

      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      coords.points.forEach((point: { x: number; y: number }) => { ctx.fillRect(imgX + point.x - 4, imgY + point.y - 4, 8, 8); });
    } else if (ann.type === "freehand" && coords.points && Array.isArray(coords.points)) {
        const xs = coords.points.map((p: any) => p.x);
        const ys = coords.points.map((p: any) => p.y);
        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);
        ctx.strokeRect(imgX + minX - 5, imgY + minY - 5, maxX - minX + 10, maxY - minY + 10);
    } else if (ann.type === "text" && coords.text) {
        ctx.strokeRect(imgX + coords.x - 5, imgY + coords.y - 5, (coords.width || 200) + 10, (coords.height || 40) + 10);
    }

    ctx.setLineDash([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (versionOverlay) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawAnnotation(ctx, versionOverlay, 0.3);
      ctx.restore();
    }

    if (peerAnnotations) {
      peerAnnotations.forEach((peerData) => {
        if (peerData.visible) {
          peerData.annotations.forEach((ann) => {
            drawAnnotation(ctx, ann, 0.5);
          });
        }
      });
    }

    annotations.forEach((ann) => {
      const isSelected = annotation.selectedAnnotationIds?.includes(ann.id) || false;
      drawAnnotation(ctx, ann as any, 0.5, isSelected);

      if (isSelected) {
        drawSelectionIndicators(ctx, ann as any);
      }
    });

    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation as any, 0.5);
    }
  }, [annotations, currentAnnotation, canvasRef, peerAnnotations, versionOverlay, annotation.selectedAnnotationIds, imageBounds]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const imgX = canvasX - imageBounds.x;
    const imgY = canvasY - imageBounds.y;

    if (imgX < 0 || imgX > imageBounds.width || imgY < 0 || imgY > imageBounds.height) {
      return;
    }

    startDrawing({ ...e, clientX: e.clientX - imageBounds.x, clientY: e.clientY - imageBounds.y } as React.MouseEvent<HTMLCanvasElement>);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const imgX = Math.max(0, Math.min(canvasX - imageBounds.x, imageBounds.width));
    const imgY = Math.max(0, Math.min(canvasY - imageBounds.y, imageBounds.height));

    updateDrawing({ ...e, clientX: e.clientX - imageBounds.x, clientY: e.clientY - imageBounds.y } as React.MouseEvent<HTMLCanvasElement>);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    finishDrawing();
  };

  return (
    <div
      ref={containerRef}
      className="bg-card rounded-lg border border-border h-full flex items-center justify-center relative annotation-canvas"
      data-testid="annotation-canvas"
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Medical image for annotation"
        className="max-w-full max-h-full object-contain rounded-lg"
        draggable={false}
        data-testid="medical-image"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-testid="annotation-overlay"
      />


      <div className="absolute top-4 right-4 flex space-x-2">
        <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot"></div>
          <span className="text-xs" data-testid="online-user">Dr. Smith</span>
        </div>
      </div>

      {textInputPosition && (
        <InlineTextEditor
          x={imageBounds.x + textInputPosition.x}
          y={imageBounds.y + textInputPosition.y}
          width={textInputPosition.width}
          height={textInputPosition.height}
          color={color}
          onComplete={completeTextInput}
          onCancel={cancelTextInput}
        />
      )}
    </div>
  );
}