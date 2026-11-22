import { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";

const VIEWPORT_SIZE = 232;
const OUTPUT_SIZE = 256;

export default function AvatarCropModal({ file, open, saving = false, onClose, onConfirm }) {
  const [imgUrl, setImgUrl] = useState("");
  const [imgEl, setImgEl] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    if (!open || !file) {
      setImgUrl("");
      setImgEl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setNaturalSize({
        width: img.naturalWidth || img.width || 1,
        height: img.naturalHeight || img.height || 1,
      });
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, open]);

  if (!open || !file) return null;

  const isRotatedOdd = (rotation / 90) % 2 !== 0;
  const effW = isRotatedOdd ? naturalSize.height : naturalSize.width;
  const effH = isRotatedOdd ? naturalSize.width : naturalSize.height;

  // Base scale so the image covers the circular viewport at zoom = 1
  const baseScale = VIEWPORT_SIZE / Math.min(effW || 1, effH || 1);
  const totalScale = baseScale * zoom;

  const clampOffset = (nx, ny, nextZoom = zoom, nextRot = rotation) => {
    const odd = (nextRot / 90) % 2 !== 0;
    const w = odd ? naturalSize.height : naturalSize.width;
    const h = odd ? naturalSize.width : naturalSize.height;
    const bScale = VIEWPORT_SIZE / Math.min(w || 1, h || 1);
    const s = bScale * nextZoom;
    const maxX = Math.max(0, (w * s - VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (h * s - VIEWPORT_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nx)),
      y: Math.min(maxY, Math.max(-maxY, ny)),
    };
  };

  const handlePointerDown = (e) => {
    if (saving) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy));
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const handleZoomChange = (nextVal) => {
    const clampedZoom = Math.min(3, Math.max(1, Number(nextVal) || 1));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom, rotation));
  };

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom, nextRot));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleApplyCrop = () => {
    if (!imgEl || saving) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    ctx.save();
    ctx.translate(
      OUTPUT_SIZE / 2 + offset.x * ratio,
      OUTPUT_SIZE / 2 + offset.y * ratio
    );
    ctx.rotate((rotation * Math.PI) / 180);
    const drawScale = totalScale * ratio;
    const drawW = naturalSize.width * drawScale;
    const drawH = naturalSize.height * drawScale;
    ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    onConfirm?.(dataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={(e) => !saving && e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
        className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] animate-popup dark:border-night-line dark:bg-night-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-night-line">
          <div>
            <h3 id="crop-modal-title" className="text-[16.5px] font-extrabold text-[#0f172a] dark:text-white">
              Adjust Profile Photo
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-[#b8b0a8]">
              Drag to reposition and use the slider to zoom.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-night-head dark:text-[#d1c9c2]"
          >
            <Icon name="x" className="text-[14px]" />
          </button>
        </div>

        {/* Circular Crop Viewport */}
        <div className="my-4 flex flex-col items-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, touchAction: "none" }}
            className={`relative overflow-hidden rounded-full border-[3px] border-brand bg-slate-900 shadow-inner select-none ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {imgUrl && (
              <img
                src={imgUrl}
                alt="Adjust profile preview"
                draggable={false}
                style={{
                  width: naturalSize.width * totalScale,
                  height: naturalSize.height * totalScale,
                  maxWidth: "none",
                  maxHeight: "none",
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
                className="pointer-events-none select-none"
              />
            )}
            {/* Subtle alignment guide overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/30"
            />
          </div>

          <span className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 dark:text-[#b8b0a8]">
            <Icon name="move" className="text-[12px] text-brand" />
            <span>Touch or drag image to center</span>
          </span>
        </div>

        {/* Zoom Slider & Rotate/Reset Controls */}
        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-night-line dark:bg-night-head/60">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleZoomChange(Math.max(1, +(zoom - 0.15).toFixed(2)))}
              aria-label="Zoom out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
            >
              <Icon name="minus" className="text-[12px]" />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => handleZoomChange(e.target.value)}
              aria-label="Zoom profile photo"
              className="h-1.5 flex-1 cursor-pointer accent-brand"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(Math.min(3, +(zoom + 0.15).toFixed(2)))}
              aria-label="Zoom in"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
            >
              <Icon name="plus" className="text-[12px]" />
            </button>
            <span className="w-10 text-right font-mono text-[11.5px] font-bold text-slate-600 dark:text-[#d1c9c2]">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleRotate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
            >
              <Icon name="rotate-cw" className="text-[12px]" />
              <span>Rotate 90°</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
            >
              <Icon name="undo-2" className="text-[12px]" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13.5px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-night-line dark:bg-night-head dark:text-[#d1c9c2]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleApplyCrop}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-[13.5px] font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-60"
          >
            <Icon name="check" className="text-[14px]" />
            <span>{saving ? "Saving…" : "Save Photo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
