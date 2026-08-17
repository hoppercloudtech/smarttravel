import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://horizonspot.site";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "horizonSpot";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — East Africa's Travel Discovery Guide`, template: `%s | ${SITE_NAME}` },
  description:
    "Find hotels, restaurants, Airbnbs, resorts and attractions across Uganda, Kenya, Tanzania, Rwanda and beyond — with original overviews, maps and nearby discoveries.",
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  );
}
