import { motion } from "framer-motion";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-noto-title text-3xl text-primary mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Charts & progression — à venir</p>
      </motion.div>
    </div>
  );
}
