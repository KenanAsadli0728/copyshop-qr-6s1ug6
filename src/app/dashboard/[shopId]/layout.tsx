import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <div className="mx-auto max-w-5xl p-4">{children}</div>
    </div>
  );
}
