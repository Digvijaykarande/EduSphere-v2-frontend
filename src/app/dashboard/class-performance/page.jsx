import PerformanceGate from "@/components/pages/dashboard/class-performance/PerformanceGate";
import ClassPerformancePage from "@/components/pages/dashboard/class-performance/ClassPerformancePage";
import StudentPerformancePage from "@/components/pages/dashboard/class-performance/StudentPerformancePage";

export const metadata = {
  title: "Class Performance — EduSphere",
};

export default function Page() {
  return (
    <PerformanceGate
      teacher={<ClassPerformancePage />}
      student={<StudentPerformancePage />}
    />
  );
}
