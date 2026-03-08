import { ClipboardList, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import GlassCard from "@/components/GlassCard";
import { ProgramSessionWithExercises } from "@/db/programs";

const SESSION_COLORS = [
  "156 100% 50%",
  "270 60% 65%",
  "36 100% 55%",
  "200 80% 55%",
  "340 70% 55%",
];

function SessionCard({ session, colorIndex }: {
  session: ProgramSessionWithExercises;
  colorIndex: number;
}) {
  const { t } = useTranslation();
  const color = SESSION_COLORS[colorIndex % SESSION_COLORS.length];

  return (
    <GlassCard className="rounded-2xl overflow-hidden">
      <div className="px-4 py-3" style={{ background: `hsla(${color} / 0.15)` }}>
        <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: `hsl(${color})` }}>
          {session.name}
        </h3>
      </div>

      {session.exercises.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border" style={{ background: `hsla(${color} / 0.06)` }}>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-muted-foreground">{t("program.exercise")}</th>
                <th className="text-center px-2 py-2 font-black uppercase tracking-wider text-muted-foreground">{t("program.sets")}</th>
                <th className="text-center px-2 py-2 font-black uppercase tracking-wider text-muted-foreground">{t("program.reps")}</th>
                <th className="text-center px-2 py-2 font-black uppercase tracking-wider text-muted-foreground">{t("program.rest")}</th>
                <th className="text-center px-2 py-2 font-black uppercase tracking-wider text-muted-foreground">{t("program.workType")}</th>
              </tr>
            </thead>
            <tbody>
              {session.exercises.map((ex, i) => (
                <tr key={ex.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="px-3 py-2.5 font-bold text-foreground">
                    <div>{ex.exercise_name}</div>
                    {ex.note && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground italic">
                        <MessageSquare size={9} />
                        {ex.note}
                      </div>
                    )}
                  </td>
                  <td className="text-center px-2 py-2.5 font-bold text-foreground">{ex.sets || "—"}</td>
                  <td className="text-center px-2 py-2.5 font-bold text-foreground">{ex.reps || "—"}</td>
                  <td className="text-center px-2 py-2.5 font-bold text-foreground">{ex.rest || "—"}</td>
                  <td className="text-center px-2 py-2.5 font-bold text-foreground">{ex.work_type || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

export default function ProgramViewer({ sessions }: { sessions: ProgramSessionWithExercises[] }) {
  const { t } = useTranslation();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{t("coach.noSessions")}</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {sessions.map((session, i) => (
        <SessionCard key={session.id} session={session} colorIndex={i} />
      ))}
    </motion.div>
  );
}
