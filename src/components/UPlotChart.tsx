import { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface UPlotChartProps {
  options: uPlot.Options;
  data: uPlot.AlignedData;
  className?: string;
}

export default function UPlotChart({ options, data, className }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const createChart = () => {
    if (!containerRef.current) return;
    chartRef.current?.destroy();

    const width = containerRef.current.clientWidth;
    // In landscape on mobile, use more height
    const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    const height = isLandscape ? Math.min(window.innerHeight - 80, 300) : (options.height ?? 220);

    const opts: uPlot.Options = { ...options, width, height };
    chartRef.current = new uPlot(opts, data, containerRef.current);
  };

  useEffect(() => {
    createChart();
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  // Re-create on options change (range switch)
  useEffect(() => {
    createChart();
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // Resize handler + orientation change
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
      const height = isLandscape ? Math.min(window.innerHeight - 80, 300) : (options.height ?? 220);
      chartRef.current.setSize({
        width: containerRef.current.clientWidth,
        height,
      });
    };

    const obs = new ResizeObserver(handleResize);
    if (containerRef.current) obs.observe(containerRef.current);

    // Also listen for orientation change
    window.addEventListener("orientationchange", () => setTimeout(handleResize, 200));
    window.addEventListener("resize", handleResize);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [options.height]);

  return <div ref={containerRef} className={className} />;
}
