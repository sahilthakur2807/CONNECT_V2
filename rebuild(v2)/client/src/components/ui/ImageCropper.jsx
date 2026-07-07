import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowsPointingOutIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";

export function ImageCropper({
  file,
  onCropComplete,
  onCancel,
  aspectRatio = 3, // width / height (e.g. 3:1 for banner)
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageSrc, setImageSrc] = useState("");
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // Dimensions needed for clipping calculations
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ baseWidth: 0, baseHeight: 0 });

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Adjust base dimensions when container resize or image loads
  const handleImageLoad = (e) => {
    const img = e.target;
    calculateDimensions(img);
  };

  const calculateDimensions = useCallback((img) => {
    if (!containerRef.current || !img) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerWidth / aspectRatio;

    setContainerSize({ width: containerWidth, height: containerHeight });

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let baseWidth = 0;
    let baseHeight = 0;

    if (imgRatio < containerRatio) {
      // Image is taller than container aspect ratio -> fit width
      baseWidth = containerWidth;
      baseHeight = containerWidth / imgRatio;
    } else {
      // Image is wider than container aspect ratio -> fit height
      baseHeight = containerHeight;
      baseWidth = containerHeight * imgRatio;
    }

    setImgDisplaySize({ baseWidth, baseHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [aspectRatio]);

  // Adjust sizing on browser resize
  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        calculateDimensions(imgRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateDimensions]);

  // Compute limits of translation based on zoom to ensure image covers container
  const getOffsetBounds = useCallback(() => {
    const wImg = imgDisplaySize.baseWidth * zoom;
    const hImg = imgDisplaySize.baseHeight * zoom;

    const maxOffsetHiddenX = Math.max(0, (wImg - containerSize.width) / 2);
    const maxOffsetHiddenY = Math.max(0, (hImg - containerSize.height) / 2);

    return {
      minX: -maxOffsetHiddenX,
      maxX: maxOffsetHiddenX,
      minY: -maxOffsetHiddenY,
      maxY: maxOffsetHiddenY,
    };
  }, [imgDisplaySize, zoom, containerSize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    startDragPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startDragPos.current.x;
    const dy = e.clientY - startDragPos.current.y;

    const targetX = startOffset.current.x + dx;
    const targetY = startOffset.current.y + dy;

    // Clamp to bounds
    const bounds = getOffsetBounds();
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

    setOffset({ x: clampedX, y: clampedY });
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Touch Support
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    startDragPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startOffset.current = { ...offset };
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startDragPos.current.x;
    const dy = e.touches[0].clientY - startDragPos.current.y;

    const targetX = startOffset.current.x + dx;
    const targetY = startOffset.current.y + dy;

    const bounds = getOffsetBounds();
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

    setOffset({ x: clampedX, y: clampedY });
  };

  // Adjust offset when zoom level changes to keep the image centered/within bounds
  useEffect(() => {
    if (containerSize.width === 0) return;
    const bounds = getOffsetBounds();
    setOffset((prev) => ({
      x: Math.max(bounds.minX, Math.min(bounds.maxX, prev.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, prev.y)),
    }));
  }, [zoom, getOffsetBounds, containerSize.width]);

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    // Generate high resolution crop (1200px width)
    const targetWidth = 1200;
    const targetHeight = targetWidth / aspectRatio;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const wImg = imgDisplaySize.baseWidth * zoom;
    const hImg = imgDisplaySize.baseHeight * zoom;

    // Display position of the image inside the container
    const dxDisplay = (containerSize.width - wImg) / 2 + offset.x;
    const dyDisplay = (containerSize.height - hImg) / 2 + offset.y;

    // Position of top-left container corner inside display image
    const xImgDisplay = -dxDisplay;
    const yImgDisplay = -dyDisplay;

    // Map display coordinates back to natural source dimensions
    const scale = img.naturalWidth / wImg;

    const sx = xImgDisplay * scale;
    const sy = yImgDisplay * scale;
    const sWidth = containerSize.width * scale;
    const sHeight = containerSize.height * scale;

    ctx.drawImage(
      img,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], file.name, { type: file.type });
        const croppedUrl = URL.createObjectURL(croppedFile);
        onCropComplete(croppedFile, croppedUrl);
      }
    }, file.type || "image/jpeg");
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
        <ArrowsPointingOutIcon className="w-3 h-3" />
        <span>Drag & scale to adjust banner crop area</span>
      </div>

      {/* Cropping Frame Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        className="w-full relative overflow-hidden bg-muted border border-border/60 cursor-move select-none"
        style={{
          height: containerSize.width ? `${containerSize.width / aspectRatio}px` : "150px",
          borderRadius: "16px",
        }}
      >
        {imageSrc && (
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Target"
            onLoad={handleImageLoad}
            className="absolute max-w-none origin-center pointer-events-none select-none"
            style={{
              width: `${imgDisplaySize.baseWidth * zoom}px`,
              height: `${imgDisplaySize.baseHeight * zoom}px`,
              left: `calc(50% + ${offset.x}px - ${(imgDisplaySize.baseWidth * zoom) / 2}px)`,
              top: `calc(50% + ${offset.y}px - ${(imgDisplaySize.baseHeight * zoom) / 2}px)`,
            }}
          />
        )}
        
        {/* Overlay aspect frame guide */}
        <div className="absolute inset-0 pointer-events-none border-2 border-primary/40 rounded-[15px] ring-[9999px] ring-black/40" />
      </div>

      {/* Zoom Control Slider */}
      <div className="flex items-center gap-3 bg-secondary/30 p-2.5 rounded-xl border border-border/40">
        <MagnifyingGlassMinusIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-primary cursor-pointer h-1 rounded-lg"
        />
        <MagnifyingGlassPlusIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono font-bold text-muted-foreground w-8 text-right">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="rounded-xl text-xs font-bold h-9 cursor-pointer"
        >
          <XMarkIcon className="w-3 h-3 mr-1" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleCrop}
          className="rounded-xl text-xs font-bold h-9 px-4 cursor-pointer"
        >
          <CheckIcon className="w-3 h-3 mr-1" />
          Apply Crop
        </Button>
      </div>
    </div>
  );
}
