import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/admin/actions";
import { ADMIN_LINKS } from "@/components/admin/nav-links";

// Desktop sidebar (lg and up). Phones and tablets use AdminMobileNav instead.
export function AdminSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col h-screen sticky top-0">
      <div className="px-5 h-16 flex items-center border-b border-border">
        <Link href="/admin" className="font-display text-lg">
          Smart<span className="text-gold">Travel</span> <span className="text-muted text-xs align-top">admin</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {ADMIN_LINKS.map((l) => (
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