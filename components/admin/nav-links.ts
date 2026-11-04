import {
    LayoutDashboard, MapPin, Workflow, BarChart3, Video, Globe, Search, LayoutGrid,
    TrendingUp, MapPinned, Youtube,
} from "lucide-react";

export const ADMIN_LINKS = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/places", label: "Places", icon: MapPin },
    { href: "/admin/ingestion", label: "Ingestion", icon: Workflow },
    { href: "/admin/youtube", label: "YouTube Videos", icon: Youtube },
    { href: "/admin/google-discovery", label: "Google Discovery", icon: Globe },
    { href: "/admin/tiktok", label: "TikTok Automation", icon: Video },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/seo", label: "SEO Intelligence", icon: Search },
    { href: "/admin/seo/discovery-pages", label: "Discovery Pages", icon: LayoutGrid },
    { href: "/admin/seo/search-console", label: "Search Console", icon: TrendingUp },
    { href: "/admin/landmarks", label: "Landmarks", icon: MapPinned },
];