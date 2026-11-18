"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Sheet from "./Sheet";

const selectCls =
  "w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer";

const errMsg = (err, fallback) => (err instanceof ApiError ? err.message : fallback);

/**
 * Sends the marks for the period currently shown on the leaderboard into an
 * exam's gradebook (scaled to the exam's max marks).
 */
export default function ExportToGradebookModal({ sectionId, sectionLabel, range, onClose, onDone }) {
  const [exams, setExams] = useState({ loading: true, list: [], error: "" });
  const [examId, setExamId] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState({ loading: false, data: null, error: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const window_ = { from: range.start.toISOString(), to: range.end.toISOString() };

  useEffect(() => {
    let cancelled = false;
    api.getPerformanceExportExams(sectionId)
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.exams || [];
        setExams({ loading: false, list, error: "" });
        setExamId(list[0]?.id || "");
      })
      .catch((err) => !cancelled && setExams({ loading: false, list: [], error: errMsg(err, "Failed to load exams.") }));
    return () => { cancelled = true; };
  }, [sectionId]);

  // Live preview of what the export would do.
  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview({ loading: true, data: null, error: "" });
    api.exportPerformanceToExam(sectionId, { examId, ...window_, overwrite, dryRun: true })
      .then((res) => !cancelled && setPreview({ loading: false, data: res.data, error: "" }))
      .catch((err) => !cancelled && setPreview({ loading: false, data: null, error: errMsg(err, "Couldn't prepare the export.") }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, examId, overwrite, range.start.getTime(), range.end.getTime()]);

  const confirm = async () => {
    if (busy || !preview.data) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.exportPerformanceToExam(sectionId, { examId, ...window_, overwrite, dryRun: false });
      setResult(res.data);
      onDone?.(res.data);
    } catch (err) {
      setError(errMsg(err, "Export failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const d = preview.data;

  return (
    <Sheet title="Export to gradebook" subtitle={`${sectionLabel} · ${range.label}`}
      leading={<span className="stat-icon-box stat-icon-violet !h-9 !w-9"><ClipboardCheck size={16} /></span>} onClose={onClose}>
      {result ? (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
          <p className="text-sm font-bold text-foreground">
            {result.written} student{result.written === 1 ? "" : "s"} written to “{result.examTitle}”
          </p>
          {result.skipped > 0 && <p className="text-xs text-slate-500">{result.skipped} with existing marks were left unchanged.</p>}
          <button type="button" onClick={onClose}
            className="h-9 px-6 rounded-full bg-primary text-white text-xs font-bold cursor-pointer">Done</button>
        </div>
      ) : exams.loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading exams…</div>
      ) : exams.error ? (
        <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400 py-4">{exams.error}</p>
      ) : exams.list.length === 0 ? (
        <div className="rounded-xl bg-primary/5 border border-primary/15 px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          No eligible exam found for {sectionLabel}. Create an exam (type <b>Internal</b> works well) for this class and your subject in
          Exams first. Exams whose results are already published can&apos;t be changed.
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="exp-exam" className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Exam</label>
            <select id="exp-exam" value={examId} onChange={(e) => { setExamId(e.target.value); setOverwrite(false); }} className={selectCls}>
              {exams.list.map((e) => (
                <option key={e.id} value={e.id}>{e.title} · {e.subject} · out of {e.maxMarks}</option>
              ))}
            </select>
          </div>

          {preview.loading ? (
            <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</p>
          ) : preview.error ? (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-px" /> {preview.error}
            </p>
          ) : d && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <p>Each student&apos;s marks for <b>{range.label}</b> are scaled to <b>{d.maxMarks}</b> and saved as their marks for this exam.</p>
              <p><b>{d.willWrite}</b> of {d.total} students will be written{d.skipped > 0 ? `, ${d.skipped} skipped (already have marks)` : ""}.</p>
              {d.existing > 0 && (
                <label className="flex items-center gap-2 pt-1 font-semibold text-foreground cursor-pointer">
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-primary" />
                  Overwrite {d.existing} existing mark{d.existing === 1 ? "" : "s"}
                </label>
              )}
            </div>
          )}

          {error && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">Cancel</button>
            <button type="button" onClick={confirm} disabled={busy || preview.loading || !d || d.willWrite === 0}
              className="h-9 px-5 rounded-full bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
              {busy ? "Exporting…" : "Export marks"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
