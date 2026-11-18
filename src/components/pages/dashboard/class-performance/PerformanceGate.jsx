"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

// Self-contained role gate: teachers and students may open Class Performance.
// Renders `teacher` or `student` (React elements) depending on the signed-in role.
export default function PerformanceGate({ teacher, student }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!hydrated) fetchMe?.();
  }, [hydrated, fetchMe]);

  const role = user?.role?.toUpperCase();
  const allowed = role === "TEACHER" || role === "STUDENT";

  useEffect(() => {
    if (hydrated && !allowed) router.replace("/dashboard");
  }, [hydrated, allowed, router]);

  if (!hydrated || !allowed) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  return <>{role === "TEACHER" ? teacher : student}</>;
}
