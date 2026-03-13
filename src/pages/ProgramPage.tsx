import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ClipboardList, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getMyPrograms, getProgramSessions, Program, ProgramSessionWithExercises } from "@/db/programs";
import { getProfile, displayName, Profile } from "@/db/profiles";
import ProgramViewer from "@/components/ProgramViewer";

interface CoachGroup {
  coachId: string;
  coachName: string;
  sessions: ProgramSessionWithExercises[];
}

export default function ProgramPage() {
  const { t } = useTranslation();
  const [coachGroups, setCoachGroups] = useState<CoachGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const programs = await getMyPrograms();
      if (programs.length === 0) { setLoading(false); return; }

      // Get unique coach IDs and fetch profiles
      const coachIds = [...new Set(programs.map(p => p.coach_id))];
      const profiles = await Promise.all(coachIds.map(id => getProfile(id)));
      const profileMap = new Map<string, Profile | null>();
      coachIds.forEach((id, i) => profileMap.set(id, profiles[i]));

      // Load sessions for each program, group by coach
      const groupMap = new Map<string, CoachGroup>();
      for (const p of programs) {
        const sessions = await getProgramSessions(p.id);
        if (!groupMap.has(p.coach_id)) {
          groupMap.set(p.coach_id, {
            coachId: p.coach_id,
            coachName: displayName(profileMap.get(p.coach_id) ?? null),
            sessions: [],
          });
        }
        groupMap.get(p.coach_id)!.sessions.push(...sessions);
      }

      setCoachGroups(Array.from(groupMap.values()));
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

  const totalSessions = coachGroups.reduce((s, g) => s + g.sessions.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
          {t("program.mySessions")}
        </h1>

        {totalSessions === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("coach.noSessions")}</p>
          </div>
        ) : (
          coachGroups.map((group) => (
            <div key={group.coachId} className="space-y-3">
              {coachGroups.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <User size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("program.coachLabel", "Coach")} : {group.coachName}
                  </span>
                </div>
              )}
              <ProgramViewer sessions={group.sessions} />
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
