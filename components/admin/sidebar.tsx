import Link from "next/link";
import { LayoutDashboard, MapPin, Workflow, BarChart3, LogOut, Video } from "lucide-react";
import { signOutAction } from "@/app/admin/actions";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/places", label: "Places", icon: MapPin },
  { href: "/admin/ingestion", label: "Ingestion", icon: Workflow },
  { href: "/admin/tiktok", label: "TikTok Automation", icon: Video },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminSidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col h-screen sticky top-0">
      <div className="px-5 h-16 flex items-center border-b border-border">
        <Link href="/admin" className="font-display text-lg">
          Smart<span className="text-gold">Travel</span> <span className="text-muted text-xs align-top">admin</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        ))}
      </nav>
      <form action={signOutAction} className="p-3 border-t border-border">
        <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </aside>
  );
}