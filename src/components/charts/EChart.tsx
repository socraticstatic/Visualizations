import ReactECharts from "echarts-for-react";
import { memo, useMemo } from "react";
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
  return (
    <ReactECharts
      option={opts}
      notMerge
      lazyUpdate
      style={{ height, width: "100%", ...style }}
      className={className}
      onChartReady={(chart) => onReady?.(chart as unknown as echarts.ECharts)}
      onEvents={onEvents}
    />
  );
};

// Memoize so parent re-renders with the same option reference don't trigger
// a full ECharts setOption pass. ChartsDemo memoizes `option` already, so this
// short-circuits the 8+ chart instances on the page whose inputs didn't change.
export const EChart = memo(EChartInner);
