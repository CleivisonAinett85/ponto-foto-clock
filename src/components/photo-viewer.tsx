import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export interface PhotoViewerProps {
  src: string;
  title: string;
  /** Ex.: "quarta-feira, 29 de julho de 2026" */
  date?: string;
  /** Ex.: "08:12" */
  time?: string;
  hasJustification?: boolean;
  justification?: string;
  onClose: () => void;
}

const MIN = 1;
const MAX = 5;

/**
 * Visualização ampliada da evidência: pinça, duplo toque, botões de zoom e
 * rotação de 90°. Tudo apenas visual — o arquivo original nunca é alterado.
 */
export function PhotoViewer({
  src,
  title,
  date,
  time,
  hasJustification,
  justification,
  onClose,
}: PhotoViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gesture = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

  const zoomTo = (v: number) => {
    const next = clamp(v);
    setScale(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      gesture.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale,
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        zoomTo(scale > 1 ? 1 : 2.5);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      drag.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && gesture.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomTo((gesture.current.scale * dist) / gesture.current.dist);
    } else if (e.touches.length === 1 && drag.current && scale > 1) {
      setOffset({
        x: drag.current.ox + (e.touches[0].clientX - drag.current.x),
        y: drag.current.oy + (e.touches[0].clientY - drag.current.y),
      });
    }
  };

  const onTouchEnd = () => {
    gesture.current = null;
    drag.current = null;
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4 shrink-0">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
          <p className="truncate text-xs text-muted-foreground capitalize">
            {[date, time].filter(Boolean).join(" • ")}
          </p>
          {hasJustification && (
            <p className="mt-1 text-xs text-info">
              📄 Justificativa associada
              {justification ? `: ${justification}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar evidência"
          className="shrink-0 rounded-lg bg-card p-3"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex-1 overflow-hidden flex items-center justify-center touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={() => zoomTo(scale > 1 ? 1 : 2.5)}
      >
        <img
          src={src}
          alt={`Evidência de ${title}`}
          draggable={false}
          className="max-h-full max-w-full object-contain transition-transform duration-100"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      <div className="shrink-0 flex items-center justify-center gap-3 p-4 pb-8">
        <button
          onClick={() => zoomTo(scale - 0.5)}
          aria-label="Diminuir zoom"
          className="rounded-xl bg-card px-5 py-4"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="min-w-14 text-center text-sm font-semibold text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => zoomTo(scale + 0.5)}
          aria-label="Aumentar zoom"
          className="rounded-xl bg-card px-5 py-4"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          aria-label="Girar 90 graus"
          className="rounded-xl bg-card px-5 py-4"
        >
          <RotateCw className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
