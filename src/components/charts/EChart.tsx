import ReactECharts from "echarts-for-react";
import { memo, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type * as echarts from "echarts";

interface EChartProps {
  option: Record<string, unknown>;
  height?: number | string;
  style?: CSSProperties;
  className?: string;
  /** Callback receiving the underlying ECharts instance once ready. */
  onReady?: (chart: echarts.ECharts) => void;
  /** Optional event handlers forwarded to echarts-for-react. */
  onEvents?: Record<string, (params: unknown) => void>;
}

const EChartInner = ({
  option,
  height = 320,
  style,
  className,
  onReady,
  onEvents,
}: EChartProps) => {
  // notMerge=true so theme/posture/N changes swap atomically (no tween through
  // intermediate colors). lazyUpdate=true lets ECharts coalesce repeated
  // setOption calls within the same tick — important when many EChart
  // instances re-render together (vision matrix, compare mode).
  const opts = useMemo(() => option, [option]);

  // echarts-for-react only resizes on window.resize, not on *container* resize.
  // When a parent grid/flex cell changes width without a window event (sticky
  // columns settling, the layout reflowing after data load, a sidebar toggling),
  // the canvas keeps its stale init width and bleeds over neighboring content.
  // A ResizeObserver on the wrapper keeps the canvas pinned to its real box.
  const chartRef = useRef<echarts.ECharts | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const handleReady = (chart: echarts.ECharts) => {
    chartRef.current = chart;
    onReady?.(chart);

    const dom = chart.getDom();
    const target = dom?.parentElement ?? dom;
    if (target && typeof ResizeObserver !== "undefined") {
      observerRef.current?.disconnect();
      const ro = new ResizeObserver(() => {
        // guard against resize-after-dispose
        if (chartRef.current && !chartRef.current.isDisposed?.()) {
          chartRef.current.resize();
        }
      });
      ro.observe(target);
      observerRef.current = ro;
    }
  };

  return (
    <ReactECharts
      option={opts}
      notMerge
      lazyUpdate
      style={{ height, width: "100%", ...style }}
      className={className}
      onChartReady={(chart) => handleReady(chart as unknown as echarts.ECharts)}
      onEvents={onEvents}
    />
  );
};

// Memoize so parent re-renders with the same option reference don't trigger
// a full ECharts setOption pass. ChartsDemo memoizes `option` already, so this
// short-circuits the 8+ chart instances on the page whose inputs didn't change.
export const EChart = memo(EChartInner);
