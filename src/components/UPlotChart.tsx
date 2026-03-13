import { useRef, useEffect, useCallback } from "react";
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
  // Keep latest options/data in refs to avoid stale closures
  const optionsRef = useRef(options);
  const dataRef = useRef(data);
  optionsRef.current = options;
  dataRef.current = data;

  const getHeight = useCallback(() => {
    const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    return isLandscape ? Math.min(window.innerHeight - 80, 300) : (optionsRef.current.height ?? 220);
  }, []);

  const createChart = useCallback(() => {
    if (!containerRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = null;

    const width = containerRef.current.clientWidth;
    const height = getHeight();
    const opts: uPlot.Options = { ...optionsRef.current, width, height };
    chartRef.current = new uPlot(opts, dataRef.current, containerRef.current);
  }, [getHeight]);

  // Create on mount & recreate on options change
  useEffect(() => {
    createChart();
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [options]);

  // Update data when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  // Resize handler + orientation change
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.setSize({
        width: containerRef.current.clientWidth,
        height: getHeight(),
      });
    };

    const handleOrientation = () => {
      // Delay to let the browser finish rotating
      setTimeout(() => {
        // Recreate chart entirely on orientation change for clean layout
        createChart();
      }, 300);
    };

    const obs = new ResizeObserver(handleResize);
    if (containerRef.current) obs.observe(containerRef.current);

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);

    // Also detect orientation via matchMedia for browsers that don't fire orientationchange
    const mql = window.matchMedia("(orientation: landscape)");
    const mqlHandler = () => setTimeout(handleResize, 200);
    mql.addEventListener("change", mqlHandler);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);
      mql.removeEventListener("change", mqlHandler);
    };
  }, [createChart, getHeight]);

  return <div ref={containerRef} className={className} />;
}
