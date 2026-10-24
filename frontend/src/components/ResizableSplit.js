/**
 * @file ResizableSplit.js
 * @description The drag handle between a list pane and a detail pane, the way
 * VS Code's sidebar edge works, plus the hook that owns the width.
 *
 * The width is per browser, not per account: it is a preference about this
 * screen on this monitor, so it lives in localStorage and never goes near the
 * server. Every read and write is wrapped — a private window can throw on
 * access rather than just returning nothing — and a failure means the pane
 * opens at its default, which is a fine outcome.
 *
 * It only applies on a wide screen. Below that the panes stack, and a width
 * for the one above the other would mean nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const WIDE = "(min-width: 1024px)";
const MIN = 240;
const MAX = 560;
const DEFAULT = 320;

/** Arrow-key step. Matches the grid the rest of the layout is built on. */
const STEP = 16;

function read(key) {
  try {
    const stored = parseInt(window.localStorage.getItem(key), 10);
    return Number.isFinite(stored) ? Math.min(Math.max(stored, MIN), MAX) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // A browser that refuses to store it still resizes for this visit.
  }
}

/**
 * @param {string} key localStorage key, e.g. "cerberus.teams.listWidth"
 * @returns {{width: number, isWide: boolean, setWidth: Function, containerRef: Object}}
 */
export function useResizableList(key) {
  const [width, setWidthState] = useState(() => read(key));
  const [isWide, setIsWide] = useState(() => {
    try {
      return window.matchMedia(WIDE).matches;
    } catch {
      return true;
    }
  });
  const containerRef = useRef(null);

  useEffect(() => {
    const mql = window.matchMedia(WIDE);
    const onChange = (e) => setIsWide(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setWidth = useCallback(
    (next) => {
      const clamped = Math.min(Math.max(Math.round(next), MIN), MAX);
      setWidthState(clamped);
      write(key, clamped);
    },
    [key]
  );

  return { width, isWide, setWidth, containerRef };
}

/**
 * The handle itself. Pointer capture means a fast drag that outruns the
 * 6px-wide element keeps resizing instead of stopping the moment the cursor
 * leaves it.
 *
 * @param {Object} props
 * @param {Object} props.containerRef  the flex row both panes sit in
 * @param {number} props.width
 * @param {Function} props.setWidth
 * @param {string} props.label         what is being resized, for screen readers
 */
export default function ResizableSplit({ containerRef, width, setWidth, label }) {
  const [dragging, setDragging] = useState(false);

  // Pointer capture retargets the move events to this element, so React's own
  // handler keeps firing even when a fast drag outruns a 12px-wide target.
  // Ending on both up and cancel matters: a cancel — the browser taking over
  // for a gesture, the window losing focus mid-drag — would otherwise leave
  // the handle resizing with no button held down.
  const end = useCallback((e) => {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging || !containerRef.current) return;
        setWidth(e.clientX - containerRef.current.getBoundingClientRect().left);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setWidth(width - STEP);
        else if (e.key === "ArrowRight") setWidth(width + STEP);
        else return;
        e.preventDefault();
      }}
      // Narrow line, wide grab area: the rule is 1px and the rest is hit area.
      // touch-none stops a drag from scrolling the page under it instead.
      className="hidden lg:flex flex-shrink-0 w-3 -mx-1.5 self-stretch items-center justify-center cursor-col-resize touch-none select-none group focus:outline-none"
    >
      <span
        className={`w-px h-full transition-colors ${
          dragging ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-400 group-focus:bg-blue-500"
        }`}
      />
    </div>
  );
}
