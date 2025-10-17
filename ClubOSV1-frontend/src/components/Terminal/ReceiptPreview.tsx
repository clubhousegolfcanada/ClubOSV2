import React, { useState, useRef } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ReceiptPreviewProps {
  imageUrl: string;
  fileName: string;
  onRotate?: (newUrl: string) => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  imageUrl,
  fileName,
  onRotate
}) => {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle image rotation
  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);

    // If we have a callback, rotate the actual image data
    if (onRotate && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        // Set canvas dimensions based on rotation
        if (newRotation % 180 === 90) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        // Clear and rotate
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((newRotation * Math.PI) / 180);

        // Draw rotated image
        if (newRotation % 180 === 90) {
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
        } else {
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
        }

        ctx.restore();

        // Convert to data URL and callback
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            onRotate(url);
          }
        }, 'image/jpeg', 0.9);
      };
      img.src = imageUrl;
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      <div className="relative bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-10 flex gap-1 bg-[var(--bg-primary)]/90 backdrop-blur-sm rounded-md p-1">
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Image Preview */}
        <div className="relative h-64 overflow-auto">
          <img
            src={imageUrl}
            alt={fileName}
            className="mx-auto transition-transform duration-200"
            style={{
              transform: `rotate(${rotation}deg) scale(${zoom})`,
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        </div>

        {/* Hidden canvas for rotation processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={toggleFullscreen}
        >
          <div className="relative max-w-full max-h-full overflow-auto">
            <img
              src={imageUrl}
              alt={fileName}
              className="mx-auto"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Fullscreen Toolbar */}
            <div className="absolute top-4 right-4 flex gap-2 bg-[var(--bg-primary)]/90 backdrop-blur-sm rounded-md p-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotate();
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors text-white"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors text-white"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors text-white"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiptPreview;