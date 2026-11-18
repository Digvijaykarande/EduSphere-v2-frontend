"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import { PanelHeader, EmptyRow } from "./SharedUI";
import { addDays, formatPoints, getRange, startOfDay } from "../class-performance/performance.utils";

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-extrabold text-foreground tabular-nums truncate">{value}</span>
    </div>
  );
}

/** Small Class Performance summary for the Teacher and Student dashboards. */
export default function PerformanceSnapshot({ role }) {
  const [state, setState] = useState({ loading: true, data: null, empty: false });

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const done = (patch) => !cancelled && setState({ loading: false, data: null, empty: false, ...patch });

    if (role === "teacher") {
      const from = startOfDay(now);
      api.getPerformanceTeacherSnapshot({ from: from.toISOString(), to: addDays(from, 1).toISOString() })
        .then((r) => done({ data: r.data }))
        .catch(() => done({ empty: true }));
    } else {
      const week = getRange("week", now);
      const prev = getRange("week", addDays(week.start, -7));
      api.getMyPerformance({
        from: week.start.toISOString(), to: week.end.toISOString(),
        prevFrom: prev.start.toISOString(), prevTo: prev.end.toISOString(),
      })
        .then((r) => done({ data: r.data }))
        .catch(() => done({ empty: true }));
    }
    return () => { cancelled = true; };
  }, [role]);

  const { loading, data, empty } = state;

  return (
    <Card className="p-4 pt-4 shadow-sm lg:col-span-1">
      <CardHeader className="p-0 pb-3">
        <PanelHeader
          title="Class performance"
          subtitle={role === "teacher" ? "Points you awarded today" : "Your standing this week"}
          href="/dashboard/class-performance"
          action="Open"
        />
      </CardHeader>
      <CardContent className="p-0 space-y-2">
        {loading ? (
          <EmptyRow>Loading…</EmptyRow>
        ) : empty || !data ? (
          <EmptyRow>Performance data isn&apos;t available yet.</EmptyRow>
        ) : role === "teacher" ? (
          data.awards === 0 ? (
            <EmptyRow><Trophy size={14} className="inline mr-1.5 -mt-0.5" />No points awarded today.</EmptyRow>
          ) : (
            <>
              <Row label="Net points today" value={formatPoints(data.points)} />
              <Row label="Awards given" value={data.awards} />
              <Row label="Students recognised" value={data.students} />
              <Row label="Top today" value={data.top ? `${data.top.name} (${formatPoints(data.top.points)})` : "—"} />
            </>
          )
        ) : data.me ? (
          <>
            <Row label="Your rank" value={`#${data.me.rank} of ${data.classSize}`} />
            <Row label="Points this week" value={data.me.points} />
            <Row label="Vs last week" value={data.me.delta ? formatPoints(data.me.delta) : "No change"} />
            {data.rows.filter((r) => r.points > 0).slice(0, 3).map((r) => (
              <Row key={r.id} label={`#${r.rank} ${r.id === data.meId ? "You" : r.name}`} value={`${r.points} pts`} />
            ))}
          </>
        ) : (
          <EmptyRow>No points yet this week.</EmptyRow>
        )}
      </CardContent>
    </Card>
  );
}
