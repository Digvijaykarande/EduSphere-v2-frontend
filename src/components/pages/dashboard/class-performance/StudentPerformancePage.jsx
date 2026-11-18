"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, History, Loader2, Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Leaderboard from "./Leaderboard";
import { useToday } from "./useToday";
import { dayLabel, formatMarks, formatPoints, pointsChipClass, timeLabel } from "./performance.utils";

const TABS = [
  { id: "board", label: "Class ranking", icon: Trophy },
  { id: "mine", label: "My points", icon: History },
];

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0 px-3 sm:px-4 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className="text-base sm:text-lg font-extrabold text-foreground tabular-nums truncate leading-tight">{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{sub}</p>
    </div>
  );
}

function MyAwards() {
  const [state, setState] = useState({ events: [], page: 1, hasMore: false, total: 0, net: 0, loading: true, more: false, error: "" });

  const load = useCallback(async (page) => {
    const res = await api.getMyPerformanceHistory({ page, limit: 30 });
    return res.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(1)
      .then((d) => !cancelled && setState({ events: d.events, page: 1, hasMore: d.hasMore, total: d.total, net: d.netPoints, loading: false, more: false, error: "" }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: err instanceof ApiError ? err.message : "Failed to load your points." })));
    return () => { cancelled = true; };
  }, [load]);

  const more = async () => {
    setState((s) => ({ ...s, more: true }));
    try {
      const d = await load(state.page + 1);
      setState((s) => ({ ...s, events: [...s.events, ...d.events], page: d.page, hasMore: d.hasMore, more: false }));
    } catch (err) {
      setState((s) => ({ ...s, more: false, error: err instanceof ApiError ? err.message : "Failed to load more." }));
    }
  };

  if (state.loading) {
    return <div className="dashboard-card flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (state.error && state.events.length === 0) {
    return <div className="dashboard-card py-14 px-6 text-center text-sm font-semibold text-foreground">{state.error}</div>;
  }
  if (state.events.length === 0) {
    return (
      <div className="dashboard-card py-14 px-6 text-center">
        <History className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm font-semibold text-foreground">No points yet</p>
        <p className="text-xs text-slate-500 mt-1">Points your teachers award you will appear here.</p>
      </div>
    );
  }

  const groups = [];
  for (const e of state.events) {
    const label = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
        {state.total} entr{state.total === 1 ? "y" : "ies"} · total <span className="font-bold tabular-nums">{formatPoints(state.net)}</span> points
      </p>
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.label}</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {g.items.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 sm:px-4 py-2">
                <span className={`shrink-0 w-14 text-center text-xs font-bold px-2 py-1 rounded-full tabular-nums ${pointsChipClass(e.points)}`}>{formatPoints(e.points)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{e.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{e.teacherName} · {timeLabel(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {state.hasMore && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
          <button type="button" onClick={more} disabled={state.more}
            className="h-9 px-5 rounded-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 disabled:opacity-60 cursor-pointer">
            {state.more ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentPerformancePage() {
  const user = useAuthStore((s) => s.user);
  const today = useToday();
  const [tab, setTab] = useState("board");
  const [board, setBoard] = useState({ period: "week", offset: 0 });
  const [teacherId, setTeacherId] = useState("");
  const [meta, setMeta] = useState(null); // { teachers, meId, me, classSize, section, settings }

  const loadBoard = useCallback(
    (params) =>
      api.getMyPerformance({ ...params, teacherId: teacherId || undefined }).then((r) => {
        setMeta(r.data);
        return r.data;
      }),
    [teacherId],
  );

  if (!user) {
    return <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const me = meta?.me;
  const marksOn = !!meta?.settings?.marksEnabled && me?.marks != null;
  const noun = board.period === "week" ? "week" : "month";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="max-w-[1200px] mx-auto space-y-4 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Class Performance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {meta?.section ? `Class ${meta.section.label} · ` : ""}See how you and your classmates are doing.
          </p>
        </div>
        {meta?.teachers?.length > 0 && (
          <div className="relative sm:w-60">
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Filter by teacher"
              className="w-full h-10 appearance-none rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-9 text-sm font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer">
              <option value="">All teachers</option>
              {meta.teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.subjects.length ? ` · ${t.subjects.join(", ")}` : ""}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {me && (
        <div className="dashboard-card grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
          <Stat label="Your rank" value={`#${me.rank}`} sub={`of ${meta.classSize} students`} />
          <Stat label={`Points this ${noun}`} value={me.points} sub={me.delta ? `${formatPoints(me.delta)} vs last ${noun}` : `Same as last ${noun}`} />
          <Stat label="Marks" value={marksOn ? `${formatMarks(me.marks)}/${meta.settings.totalMarks}` : "—"}
            sub={marksOn ? "From this teacher" : teacherId ? "Not enabled" : "Pick a teacher"} />
        </div>
      )}

      <div role="tablist" aria-label="Class performance sections" className="flex p-1 rounded-full bg-slate-100 dark:bg-slate-800/80 w-full sm:w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-5 h-9 rounded-full text-xs font-bold transition-all cursor-pointer ${
              tab === id ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-foreground"
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "board" ? (
        <Leaderboard
          loadBoard={loadBoard}
          dataKey={`student:${teacherId}`}
          sectionLabel={meta?.section?.label}
          period={board.period}
          offset={board.offset}
          baseDate={new Date(today)}
          onChange={setBoard}
          highlightId={meta?.meId || null}
        />
      ) : (
        <MyAwards />
      )}
    </motion.div>
  );
}
