"use client";

import { useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
// Two taps/clicks within this window count as a double-tap-to-zoom gesture,
// tracked manually (rather than relying on the browser's own dblclick,
// which doesn't fire for touch) so mouse and touch behave identically.
const DOUBLE_TAP_MS = 300;

type Point = { x: number; y: number };

// A self-contained pan/zoom image viewer: mouse-wheel zoom, pinch-to-zoom
// (via the Pointer Events API, which unifies mouse/touch/pen so pinch and
// drag-to-pan share one code path instead of separate touch/mouse
// handlers), drag-to-pan once zoomed in, and double-click/double-tap to
// toggle zoom. No external dependency — this is the only place in the app
// that needs it, so a small hand-rolled implementation is less weight than
// a general-purpose pan/zoom library for one use site.
export default function ZoomPanImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  // Drives the transition-vs-snap CSS below — must be state, not a ref read
  // during render (refs are only safe to read in effects/handlers).
  const [isInteracting, setIsInteracting] = useState(false);

  const pointersRef = useRef<Map<number, Point>>(new Map());
  const panStartRef = useRef<{ pointer: Point; translate: Point } | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number; midpoint: Point } | null>(null);
  const lastTapRef = useRef<number>(0);

  function clampTranslate(nextScale: number, next: Point): Point {
    const el = containerRef.current;
    if (!el) return next;
    // At scale 1 the image exactly fills the frame — no panning possible or
    // needed. Beyond that, cap how far the image can be dragged so its edge
    // never leaves a visible gap inside the frame.
    const maxOffsetX = (el.clientWidth * (nextScale - 1)) / 2;
    const maxOffsetY = (el.clientHeight * (nextScale - 1)) / 2;
    return {
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, next.x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, next.y)),
    };
  }

  function resetZoom() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  function toggleDoubleTapZoom(point: Point) {
    if (scale > 1) {
      resetZoom();
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Zoom in centered on the tap/click point, not the frame center — the
    // usual expectation for double-tap-to-zoom on a photo.
    const offsetX = (rect.width / 2 - (point.x - rect.left)) * (DOUBLE_TAP_SCALE - 1);
    const offsetY = (rect.height / 2 - (point.y - rect.top)) * (DOUBLE_TAP_SCALE - 1);
    setScale(DOUBLE_TAP_SCALE);
    setTranslate(clampTranslate(DOUBLE_TAP_SCALE, { x: offsetX, y: offsetY }));
  }

  // React attaches onWheel as a passive listener, silently ignoring
  // preventDefault() inside it (logs a console warning, page scrolls
  // underneath the viewer anyway) — confirmed via browser testing, not a
  // hypothetical. A native, non-passive listener is the only way to
  // actually block the page scroll while wheel-zooming the image. Reads
  // current scale/translate off refs (kept in sync below) rather than
  // closing over the state values, since this listener is attached once,
  // not re-attached on every render.
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);
  useEffect(() => {
    scaleRef.current = scale;
    translateRef.current = translate;
  }, [scale, translate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      const currentScale = scaleRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * (1 - event.deltaY * WHEEL_ZOOM_SENSITIVITY)));
      if (nextScale === currentScale) return;
      if (nextScale === MIN_SCALE) {
        resetZoom();
        return;
      }
      const rect = el!.getBoundingClientRect();
      // Zoom centered on the cursor: keep the point under the pointer fixed
      // in place as scale changes, the standard "zoom toward cursor" feel.
      const cx = event.clientX - rect.left - rect.width / 2;
      const cy = event.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / currentScale;
      const prev = translateRef.current;
      setScale(nextScale);
      setTranslate(clampTranslate(nextScale, { x: (prev.x - cx) * ratio + cx, y: (prev.y - cy) * ratio + cy }));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    containerRef.current?.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        toggleDoubleTapZoom({ x: event.clientX, y: event.clientY });
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      panStartRef.current = { pointer: { x: event.clientX, y: event.clientY }, translate };
      setIsInteracting(true);
    } else if (pointersRef.current.size === 2) {
      panStartRef.current = null;
      const [a, b] = [...pointersRef.current.values()];
      pinchStartRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      setIsInteracting(true);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinchStartRef.current.scale * (distance / pinchStartRef.current.distance))
      );
      setScale(nextScale);
      setTranslate((prev) => clampTranslate(nextScale, prev));
      return;
    }

    if (pointersRef.current.size === 1 && panStartRef.current && scale > 1) {
      const dx = event.clientX - panStartRef.current.pointer.x;
      const dy = event.clientY - panStartRef.current.pointer.y;
      setTranslate(clampTranslate(scale, { x: panStartRef.current.translate.x + dx, y: panStartRef.current.translate.y + dy }));
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      setIsInteracting(false);
    }
    if (scale < MIN_SCALE + 0.01) resetZoom();
  }

  return (
    <div
      ref={containerRef}
      className={`relative touch-none select-none overflow-hidden ${className ?? ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`h-full w-full ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        style={{
          objectFit: "contain",
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: isInteracting ? "none" : "transform 150ms ease-out",
          touchAction: "none",
        }}
      />
      {scale > 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            resetZoom();
          }}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/80"
        >
          Reset zoom
        </button>
      )}
    </div>
  );
}
