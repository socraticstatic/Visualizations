import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  /** Reserved height so layout doesn't jump before children mount. */
  minHeight?: number;
  /** Pixels of pre-render margin (default 200). */
  rootMargin?: string;
}

/**
 * Defers mounting children until the placeholder scrolls within `rootMargin`
 * of the viewport. Used to keep expensive off-screen ECharts panels (vision
 * matrix, emphasis preview, density preview) from re-rendering on every
 * palette change while the user is interacting with on-screen controls.
 */
export function LazyMount({ children, minHeight = 240, rootMargin = "200px" }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} style={shown ? undefined : { minHeight }}>
      {shown ? children : null}
    </div>
  );
}
