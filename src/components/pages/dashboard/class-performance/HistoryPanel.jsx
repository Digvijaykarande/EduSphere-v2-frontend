"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, History, Loader2, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dayLabel, formatPoints, pointsChipClass, startOfDay, startOfWeek, timeLabel } from "./performance.utils";

const PAGE = 40;
const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

function since(range) {
  const now = new Date();
  if (range === "today") return startOfDay(now);
  if (range === "week") return startOfWeek(now);
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

/**
 * Server-driven history for one class. `onDelete(event)` must return a promise;
 * the row disappears once it resolves. `refreshKey` forces a reload (new awards, undo).
 */
export default function HistoryPanel({ sectionId, refreshKey, onDelete }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("week");
  const [state, setState] = useState({ events: [], total: 0, net: 0, page: 1, hasMore: false, loading: true, loadingMore: false, error: "" });
  const [rowError, setRowError] = useState("");
  const reqId = useRef(0);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(async (page) => {
    const from = since(range);
    const res = await api.getPerformanceHistory(sectionId, {
      page, limit: PAGE, search, from: from ? from.toISOString() : undefined,
    });
    return res.data;
  }, [sectionId, range, search]);

  useEffect(() => {
    const id = ++reqId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchPage(1)
      .then((d) => {
        if (id !== reqId.current) return;
        setState({ events: d.events, total: d.total, net: d.netPoints, page: 1, hasMore: d.hasMore, loading: false, loadingMore: false, error: "" });
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setState((s) => ({ ...s, loading: false, error: err instanceof ApiError ? err.message : "Failed to load history." }));
      });
  }, [fetchPage, refreshKey]);

  const loadMore = async () => {
    const id = reqId.current;
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const d = await fetchPage(state.page + 1);
      if (id !== reqId.current) return;
      setState((s) => {
        const have = new Set(s.events.map((e) => e.id));
        return { ...s, events: [...s.events, ...d.events.filter((e) => !have.has(e.id))], page: d.page, hasMore: d.hasMore, total: d.total, net: d.netPoints, loadingMore: false };
      });
    } catch (err) {
      if (id !== reqId.current) return;
      setState((s) => ({ ...s, loadingMore: false, error: err instanceof ApiError ? err.message : "Failed to load more." }));
    }
  };

  const remove = async (e) => {
    setRowError("");
    try {
      await onDelete(e);
      setState((s) => ({
        ...s,
        events: s.events.filter((x) => x.id !== e.id),
        total: Math.max(0, s.total - 1),
        net: Math.round((s.net - e.points) * 100) / 100,
      }));
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Couldn't remove that entry.");
    }
  };

  const groups = [];
  for (const e of state.events) {
    const label = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="p-2.5 sm:p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or category" aria-label="Search history"
            className="w-full h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div role="group" aria-label="History period" className="flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-800 sm:shrink-0">
          {RANGES.map((r) => (
            <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => setRange(r.value)}
              className={`flex-1 sm:flex-none h-9 sm:px-4 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                range === r.value ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rowError && (
        <p role="alert" className="px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10">{rowError}</p>
      )}

      {state.loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
      ) : state.error && state.events.length === 0 ? (
        <div className="py-14 px-6 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-foreground">{state.error}</p>
        </div>
      ) : state.events.length === 0 ? (
        <div className="py-14 px-6 text-center">
          <History className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-foreground">No activity found</p>
          <p className="text-xs text-slate-500 mt-1">Awarded points show up here. You can remove a mistaken entry.</p>
        </div>
      ) : (
        <>
          <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            {state.total} entr{state.total === 1 ? "y" : "ies"} · net <span className="font-bold tabular-nums">{formatPoints(state.net)}</span> points
          </p>
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.label}</h3>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {g.items.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 sm:px-4 py-2">
                    <span className={`shrink-0 w-14 text-center text-xs font-bold px-2 py-1 rounded-full tabular-nums ${pointsChipClass(e.points)}`}>
                      {formatPoints(e.points)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{e.studentName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {e.label} · Roll {e.rollNumber || "—"} · {timeLabel(e.createdAt)}
                      </p>
                    </div>
                    <button type="button" onClick={() => remove(e)} aria-label={`Remove ${e.label} for ${e.studentName}`}
                      className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {state.hasMore && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <button type="button" onClick={loadMore} disabled={state.loadingMore}
                className="h-9 px-5 rounded-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 disabled:opacity-60 cursor-pointer">
                {state.loadingMore ? "Loading…" : `Show more (${state.total - state.events.length} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
