import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <div className="p-6 sm:p-8 max-w-6xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
