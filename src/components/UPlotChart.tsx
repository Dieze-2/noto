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

  const getChartSize = useCallback(() => {
    const container = containerRef.current;
    const fallbackHeight = optionsRef.current.height ?? 220;

    if (!container) return { width: 1, height: fallbackHeight };

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(container.clientWidth || rect.width));
    const containerHeight = Math.round(container.clientHeight || rect.height);

    // In fullscreen/layout-driven containers, always trust real container height
    if (containerHeight > 40) {
      return { width, height: containerHeight };
    }

    // Fallback for inline charts without explicit container height
    const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const isLandscape = window.innerWidth > window.innerHeight;
    const fallbackLandscapeHeight = Math.max(220, viewportHeight - 120);

    return {
      width,
      height: isLandscape ? fallbackLandscapeHeight : fallbackHeight,
    };
  }, []);

  const createChart = useCallback(() => {
    if (!containerRef.current) return;

    chartRef.current?.destroy();
    chartRef.current = null;

    const { width, height } = getChartSize();
    const opts: uPlot.Options = { ...optionsRef.current, width, height };
    chartRef.current = new uPlot(opts, dataRef.current, containerRef.current);
  }, [getChartSize]);

  // Create on mount & recreate on options change
  useEffect(() => {
    createChart();
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [options, createChart]);

  // Update data when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  // Resize + orientation handling
  useEffect(() => {
    let rafId: number | null = null;

    const applySize = () => {
      if (!chartRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!chartRef.current) return;
        const { width, height } = getChartSize();
        chartRef.current.setSize({ width, height });
      });
    };

    const recreateAfterRotate = () => {
      window.setTimeout(() => {
        createChart();
      }, 350);
    };

    const obs = new ResizeObserver(applySize);
    if (containerRef.current) obs.observe(containerRef.current);

    window.addEventListener("resize", applySize);
    window.addEventListener("orientationchange", recreateAfterRotate);

    const mql = window.matchMedia("(orientation: landscape)");
    mql.addEventListener("change", recreateAfterRotate);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", applySize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      window.removeEventListener("resize", applySize);
      window.removeEventListener("orientationchange", recreateAfterRotate);
      mql.removeEventListener("change", recreateAfterRotate);
      visualViewport?.removeEventListener("resize", applySize);
    };
  }, [createChart, getChartSize]);

  return <div ref={containerRef} className={className} />;
}
