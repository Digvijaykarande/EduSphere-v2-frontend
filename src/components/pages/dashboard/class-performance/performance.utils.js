// Shared constants + pure helpers for the Class Performance module.
// Nothing in here defines categories or point values: the teacher owns those.

/** Sanity bound for a single award / category value (not a business rule). */
export const MAX_ABS_POINTS = 1000;

/** What a teacher has not configured yet: marks conversion is simply off. */
export const DEFAULT_SETTINGS = { marksEnabled: false, totalMarks: null, pointsForFull: null };

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ------------------------------ text ------------------------------ */

export function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

/* ------------------------------ points UI ------------------------------ */

export function formatPoints(p) {
  const n = round2(p) || 0;
  return `${n > 0 ? "+" : ""}${n}`;
}

export function pointsChipClass(p) {
  if (p < 0) return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (p > 0) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function decimalsOk(n) {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

/** Validate a label/points pair. Returns an error string or "". */
export function validateCategory(label, points, categories = [], editingId = null) {
  const name = String(label || "").trim();
  if (name.length < 2) return "Enter a category name (at least 2 characters).";
  if (name.length > 40) return "Category name is too long (max 40 characters).";
  if (categories.some((c) => c.id !== editingId && c.label.trim().toLowerCase() === name.toLowerCase())) {
    return "You already have a category with this name.";
  }
  const n = Number(points);
  if (points === "" || points === null || Number.isNaN(n)) return "Enter the points value.";
  if (!decimalsOk(n)) return "Use at most 2 decimal places.";
  if (n === 0) return "Points can't be zero.";
  if (Math.abs(n) > MAX_ABS_POINTS) return `Points must be between -${MAX_ABS_POINTS} and ${MAX_ABS_POINTS}.`;
  return "";
}

/* ------------------------------ marks ------------------------------ */

export function validateSettings(totalMarks, pointsForFull) {
  const t = Number(totalMarks);
  const p = Number(pointsForFull);
  if (totalMarks === "" || Number.isNaN(t) || t <= 0) return "Enter the total marks (greater than 0).";
  if (!decimalsOk(t) || t > MAX_ABS_POINTS) return "Total marks must have at most 2 decimals and not exceed 1000.";
  if (pointsForFull === "" || Number.isNaN(p) || p <= 0) return "Enter the points needed for full marks (greater than 0).";
  if (!decimalsOk(p) || p > MAX_ABS_POINTS * 100) return "Points for full marks must have at most 2 decimals.";
  return "";
}

export function sanitizeSettings(s) {
  const t = Number(s?.totalMarks);
  const p = Number(s?.pointsForFull);
  const valid = s?.marksEnabled && !validateSettings(t, p);
  return valid
    ? { marksEnabled: true, totalMarks: t, pointsForFull: p }
    : { ...DEFAULT_SETTINGS };
}

/** Un-capped marks a given number of points is worth (null when marks are off). */
export function rawMarks(points, settings) {
  if (!settings?.marksEnabled) return null;
  return round2((Number(points) / settings.pointsForFull) * settings.totalMarks);
}

/** Marks earned for a period total: never below 0, never above the total. */
export function pointsToMarks(points, settings) {
  const raw = rawMarks(points, settings);
  if (raw === null) return null;
  return Math.max(0, Math.min(settings.totalMarks, raw));
}

export const formatMarks = (n) => String(round2(n));

/* ------------------------------ dates ------------------------------ */

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Weeks run Monday → Sunday.
export function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sun
  return addDays(x, dow === 0 ? -6 : 1 - dow);
}

/** Local yyyy-mm-dd (toISOString would shift the day in positive-UTC zones). */
export function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** { start, end (exclusive), label } for the week/month containing `anchor`. */
export function getRange(period, anchor) {
  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }
  const start = startOfWeek(anchor);
  const end = addDays(start, 7);
  const last = addDays(end, -1);
  return {
    start,
    end,
    label: `${fmtShort(start)} – ${fmtShort(last)}, ${last.getFullYear()}`,
  };
}

export function shiftAnchor(period, anchor, dir) {
  if (period === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return addDays(anchor, 7 * dir);
}

export function inRange(ts, range) {
  const t = new Date(ts).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

export function dayLabel(ts) {
  const d = startOfDay(ts);
  const today = startOfDay(new Date());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === addDays(today, -1).getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------ ranking ------------------------------ */

export function compareRoll(a, b) {
  return compareText(a.roll, b.roll);
}

/**
 * Boundaries for a leaderboard period, in the viewer's local time. The server
 * never guesses a timezone: it just receives these instants.
 */
export function periodParams(period, offset, baseDate) {
  const anchor = shiftAnchor(period, baseDate, offset);
  const range = getRange(period, anchor);
  const prev = getRange(period, shiftAnchor(period, anchor, -1));
  return {
    range,
    params: {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      prevFrom: prev.start.toISOString(),
      prevTo: prev.end.toISOString(),
    },
  };
}

/* ------------------------------ CSV ------------------------------ */

function csvCell(v) {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function leaderboardToCSV(rows, settings) {
  const withMarks = !!settings?.marksEnabled;
  const head = ["Rank", "Roll No", "Name", "Points", "Actions", ...(withMarks ? [`Marks (out of ${settings.totalMarks})`] : [])];
  const lines = rows.map((r) => [r.rank, r.roll, r.name, r.points, r.count, ...(withMarks ? [formatMarks(r.marks)] : [])]);
  return [head, ...lines].map((l) => l.map(csvCell).join(",")).join("\r\n");
}

export function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
