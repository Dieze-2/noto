import { motion } from "framer-motion";

/**
 * Animated neon "NOTO" splash screen.
 * Each letter is drawn with stroke-dashoffset animation,
 * then fills with a glowing mint-green neon effect.
 */
export default function NotoLoader() {
  const letters = [
    // N
    "M 10 80 L 10 20 L 50 80 L 50 20",
    // O
    "M 65 50 C 65 22 95 22 95 50 C 95 78 65 78 65 50 Z",
    // T
    "M 105 20 L 145 20 M 125 20 L 125 80",
    // O
    "M 155 50 C 155 22 185 22 185 50 C 185 78 155 78 155 50 Z",
  ];

  const strokeColor = "hsl(156, 100%, 50%)";
  const glowFilter = `
    drop-shadow(0 0 6px hsl(156, 100%, 50%))
    drop-shadow(0 0 20px hsl(156, 100%, 50%))
    drop-shadow(0 0 40px hsla(156, 100%, 50%, 0.5))
    drop-shadow(0 0 80px hsla(156, 100%, 50%, 0.3))
  `;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <svg
          viewBox="0 0 195 100"
          className="w-64 h-auto"
          style={{ filter: glowFilter }}
        >
          {letters.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { delay: i * 0.25, duration: 0.8, ease: "easeInOut" },
                opacity: { delay: i * 0.25, duration: 0.1 },
              }}
            />
          ))}
        </svg>

        {/* Loading bar */}
        <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${strokeColor}, transparent)`,
              boxShadow: `0 0 12px ${strokeColor}`,
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.8,
            }}
          />
        </div>
      </div>
    </div>
  );
}
