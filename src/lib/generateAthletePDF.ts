import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface PDFMetric {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
}

interface PDFWorkout {
  date: string;
  exercises: { name: string; load_type: string; load_g: number | null; reps: number }[];
}

interface PDFSession {
  name: string;
  exercises: { exercise_name: string; sets: number | string; reps: string; rest: string; work_type: string; note: string | null }[];
}

interface PDFPersonalRecord {
  name: string;
  e1rm: number;
  date: string;
}

interface PDFMuscleGroup {
  name: string;
  count: number;
  pct: number;
}

interface AthletePDFData {
  athleteName: string;
  stats: {
    currentWeight: number | null;
    weightTrend: number;
    avgSteps: number | null;
    avgKcal: number | null;
    workoutCount: number;
    totalWorkouts: number;
  };
  weeklyRows: {
    label: string;
    avgWeight: number | null;
    avgSteps: number | null;
    avgKcal: number | null;
    sessionsCount: number;
    weightVariation: number | null;
  }[];
  muscleGroups: PDFMuscleGroup[];
  personalRecords: PDFPersonalRecord[];
  sessions: PDFSession[];
  frequencyAvg: number;
  t: (key: string, opts?: any) => string;
}

export function generateAthletePDF(data: AthletePDFData) {
  const { athleteName, stats, weeklyRows, muscleGroups, personalRecords, sessions, frequencyAvg, t } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  const primary = [59, 130, 246]; // blue
  const textDark = [30, 30, 30];
  const textMuted = [120, 120, 120];

  // ── Header ──
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(athleteName, margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${t("pdf.generatedOn")} ${format(new Date(), "dd/MM/yyyy")}`, margin, 28);
  doc.text(t("pdf.bilanTitle"), pageWidth - margin, 18, { align: "right" });

  y = 46;

  // ── Summary cards ──
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(t("coach.overview"), margin, y);
  y += 8;

  const cardW = (pageWidth - margin * 2 - 12) / 4;
  const cards = [
    { label: t("dashboard.weight"), value: stats.currentWeight != null ? `${stats.currentWeight.toFixed(1)} kg` : "—", sub: stats.weightTrend !== 0 ? `${stats.weightTrend > 0 ? "+" : ""}${stats.weightTrend.toFixed(1)} kg` : "" },
    { label: t("coach.workouts"), value: `${stats.workoutCount}`, sub: `/ 30j · ${stats.totalWorkouts} total` },
    { label: t("coach.avgSteps"), value: stats.avgSteps != null ? Math.round(stats.avgSteps).toLocaleString() : "—", sub: "" },
    { label: t("coach.avgKcal"), value: stats.avgKcal != null ? Math.round(stats.avgKcal).toLocaleString() : "—", sub: "" },
  ];

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + 4);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, y, cardW, 22, 3, 3, "F");
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(card.label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + 4, y + 15);
    if (card.sub) {
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.setFontSize(7);
      doc.text(card.sub, x + 4, y + 20);
    }
  });

  y += 30;

  // ── Training frequency ──
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${t("coach.trainingFrequency")}  ø ${frequencyAvg.toFixed(1)} / ${t("coach.perWeek")}`, margin, y);
  y += 6;

  // ── Weekly metrics table ──
  if (weeklyRows.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t("coach.weeklyView"), margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[t("coach.period"), t("coach.avgSteps"), t("coach.avgKcal"), t("dashboard.weight"), "%", t("coach.workouts")]],
      body: weeklyRows.slice(0, 12).map((r) => [
        r.label,
        r.avgSteps != null ? Math.round(r.avgSteps).toLocaleString() : "—",
        r.avgKcal != null ? Math.round(r.avgKcal).toString() : "—",
        r.avgWeight != null ? r.avgWeight.toFixed(1) : "—",
        r.weightVariation != null ? `${r.weightVariation > 0 ? "+" : ""}${r.weightVariation.toFixed(2)}%` : "—",
        r.sessionsCount.toString(),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [primary[0], primary[1], primary[2]], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Muscle groups ──
  if (muscleGroups.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t("coach.muscleGroups"), margin, y);
    y += 6;

    muscleGroups.forEach((mg) => {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${mg.name}`, margin, y);
      doc.text(`${mg.pct}%`, margin + 50, y);
      // Bar
      const barW = 80;
      doc.setFillColor(230, 230, 235);
      doc.roundedRect(margin + 60, y - 3, barW, 4, 2, 2, "F");
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(margin + 60, y - 3, barW * mg.pct / 100, 4, 2, 2, "F");
      y += 7;
    });
    y += 4;
  }

  // ── Personal records ──
  if (personalRecords.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t("coach.personalRecords"), margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", t("program.exercise"), "e1RM (kg)", "Date"]],
      body: personalRecords.map((pr, i) => [
        (i + 1).toString(),
        pr.name,
        pr.e1rm.toFixed(1),
        format(new Date(pr.date), "dd/MM/yy"),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [primary[0], primary[1], primary[2]], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Program / Sessions ──
  if (sessions.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t("coach.sessionsTab"), margin, y);
    y += 4;

    sessions.forEach((session) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(session.name, margin, y + 4);
      y += 6;

      if (session.exercises.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [[t("program.exercise"), t("program.sets"), t("program.reps"), t("program.rest"), t("program.workType"), t("program.note")]],
          body: session.exercises.map((ex) => [
            ex.exercise_name,
            ex.sets.toString(),
            ex.reps,
            ex.rest,
            ex.work_type,
            ex.note ?? "",
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [primary[0], primary[1], primary[2]], textColor: 255, fontStyle: "bold", fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 248, 252] },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
    });
  }

  // ── Footer on each page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      `${t("pdf.bilanTitle")} — ${athleteName} — ${format(new Date(), "dd/MM/yyyy")} — p.${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`bilan-${athleteName.replace(/\s+/g, "_")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
