import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2 } from "lucide-react";
import UPlotChart from "./UPlotChart";
import uPlot from "uplot";
import { useMemo } from "react";

interface ChartFullscreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: uPlot.Options;
  data: uPlot.AlignedData;
}

export function ChartExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Plein écran"
    >
      <Maximize2 size={14} />
    </button>
  );
}

export default function ChartFullscreen({
  open,
  onClose,
  title,
  options,
  data,
}: ChartFullscreenProps) {
  // Build fullscreen options with larger height
  const fullOpts = useMemo<uPlot.Options>(() => {
    return {
      ...options,
      width: 300, // will be overridden by container
      height: 400,
    };
  }, [options]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[81] flex flex-col p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black uppercase tracking-wide text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chart area – fills remaining space */}
            <div className="flex-1 min-h-0">
              <UPlotChart
                options={fullOpts}
                data={data}
                className="w-full h-full"
              />
            </div>

            {/* Hint */}
            <p className="text-center text-[10px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">
              Tournez l'écran pour le mode paysage
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
