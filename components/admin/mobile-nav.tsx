"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { ADMIN_LINKS } from "@/components/admin/nav-links";
import { cn } from "@/lib/utils";

// Top bar + dropdown menu for the admin on screens smaller than lg.
export function AdminMobileNav({ signOut }: { signOut: (formData: FormData) => void | Promise<void> }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // close the menu after navigating
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // the most specific matching link is the active one (so /admin/seo/search-console
    // highlights itself, not also "SEO Intelligence")
    const activeHref = [...ADMIN_LINKS]
        .sort((a, b) => b.href.length - a.href.length)
        .find((l) => (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href)))?.href;

    return (
        <div className="sticky top-0 z-40 border-b border-border bg-surface lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
                <Link href="/admin" className="font-display text-lg">
                    Smart<span className="text-gold">Travel</span> <span className="text-muted text-xs align-top">admin</span>
                </Link>
                <button
                    type="button"
                    aria-label={open ? "Close menu" : "Open menu"}
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                    className="rounded-md p-2 text-muted hover:bg-surface-raised hover:text-foreground"
                >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {open && (
                <div className="absolute inset-x-0 top-full max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border bg-surface shadow-lg">
                    <nav className="space-y-1 p-3">
                        {ADMIN_LINKS.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
                                    l.href === activeHref
                                        ? "bg-surface-raised text-foreground"
                                        : "text-muted hover:bg-surface-raised hover:text-foreground"
                                )}
                            >
                                <l.icon className="h-4 w-4" />
                                {l.label}
                            </Link>
                        ))}
                    </nav>
                    <form action={signOut} className="border-t border-border p-3">
                        <button className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm text-muted hover:bg-surface-raised hover:text-foreground">
                            <LogOut className="h-4 w-4" /> Sign out
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}