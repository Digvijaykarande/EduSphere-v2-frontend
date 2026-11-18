"use client";

// Data layer for the teacher's Class Performance setup (categories + marks
// weightage). Everything is stored on the server, per teacher. Scoring,
// leaderboard and history are fetched by the components that show them.
//
// One-time migration: teachers who used the old browser-only version get their
// categories and weightage copied to the server the first time they open the
// page (awards themselves are not migrated).

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DEFAULT_SETTINGS } from "./performance.utils";

const localKey = (ownerId) => `edusphere:class-performance:v2:${ownerId}`;
const migratedKey = (ownerId) => `edusphere:class-performance:server-migrated:${ownerId}`;

const msg = (err, fallback) => (err instanceof ApiError ? err.message : fallback);

async function migrateLocal(ownerId) {
  try {
    if (window.localStorage.getItem(migratedKey(ownerId))) return false;
    const raw = window.localStorage.getItem(localKey(ownerId));
    window.localStorage.setItem(migratedKey(ownerId), "1");
    if (!raw) return false;
    const old = JSON.parse(raw);
    let changed = false;
    for (const c of Array.isArray(old?.categories) ? old.categories : []) {
      try {
        await api.createPerformanceCategory({ label: c.label, points: Number(c.points), purpose: c.purpose || "" });
        changed = true;
      } catch { /* skip anything the server rejects */ }
    }
    const s = old?.settings;
    if (s?.marksEnabled) {
      try {
        await api.savePerformanceSettings({
          marksEnabled: true,
          totalMarks: Number(s.totalMarks),
          pointsForFull: Number(s.pointsForFull),
        });
        changed = true;
      } catch { /* ignore */ }
    }
    return changed;
  } catch {
    return false; // storage blocked or corrupt: nothing to migrate
  }
}

export function usePerformanceData(ownerId) {
  const [state, setState] = useState({ ready: false, error: "", categories: [], settings: DEFAULT_SETTINGS });
  const [tick, setTick] = useState(0);
  const migrating = useRef(false);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        let res = await api.getPerformanceSetup();
        const empty = !res?.data?.categories?.length && !res?.data?.settings?.marksEnabled;
        if (empty) {
          // One shared promise, so a remount (React StrictMode) waits for the same migration.
          migrating.current ||= migrateLocal(ownerId);
          if (await migrating.current) res = await api.getPerformanceSetup();
        }
        if (cancelled) return;
        setState({
          ready: true,
          error: "",
          categories: res?.data?.categories || [],
          settings: res?.data?.settings || DEFAULT_SETTINGS,
        });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({ ...s, ready: true, error: msg(err, "Failed to load your setup.") }));
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, ready: false, error: "" }));
    setTick((t) => t + 1);
  }, []);

  const mergeCategory = useCallback((cat) => {
    setState((s) => {
      const exists = s.categories.some((c) => c.id === cat.id);
      return { ...s, categories: exists ? s.categories.map((c) => (c.id === cat.id ? cat : c)) : [...s.categories, cat] };
    });
  }, []);

  // These throw ApiError on failure so forms can show the server's message.
  const saveCategory = useCallback(async (cat) => {
    const payload = { label: cat.label.trim(), points: Number(cat.points), purpose: (cat.purpose || "").trim() };
    const res = cat.id ? await api.updatePerformanceCategory(cat.id, payload) : await api.createPerformanceCategory(payload);
    mergeCategory(res.data.category);
    return res.data.category;
  }, [mergeCategory]);

  const deleteCategory = useCallback(async (id) => {
    await api.deletePerformanceCategory(id);
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
  }, []);

  const saveSettings = useCallback(async (settings) => {
    const res = await api.savePerformanceSettings(settings);
    setState((s) => ({ ...s, settings: res.data.settings }));
    return res.data.settings;
  }, []);

  return {
    ready: state.ready,
    error: state.error,
    categories: state.categories,
    settings: state.settings,
    reload,
    mergeCategory,
    saveCategory,
    deleteCategory,
    saveSettings,
  };
}
