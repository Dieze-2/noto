import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getMyPrograms, getProgramSessions, ProgramSessionWithExercises } from "@/db/programs";
import ProgramViewer from "@/components/ProgramViewer";

export default function ProgramPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ProgramSessionWithExercises[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const programs = await getMyPrograms();
      if (programs.length > 0) {
        // Single program per athlete — load its sessions directly
        const s = await getProgramSessions(programs[0].id);
        setSessions(s);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
          {t("program.mySessions")}
        </h1>

        {sessions.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("coach.noSessions")}</p>
          </div>
        ) : (
          <ProgramViewer sessions={sessions} />
        )}
      </motion.div>
    </div>
  );
}
