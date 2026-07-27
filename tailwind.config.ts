import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        border: "hsl(var(--border))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        gold: {
          DEFAULT: "hsl(var(--gold))",
          soft: "hsl(var(--gold-soft))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
        },
        clay: "hsl(var(--clay))",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "22px",
      },
      boxShadow: {
        panel: "0 1px 0 0 hsl(var(--border)), 0 12px 32px -16px rgba(0,0,0,0.5)",
      },
      backgroundImage: {
        "route-dots": "radial-gradient(hsl(var(--gold) / 0.55) 1.2px, transparent 1.2px)",
      },
    },
  },
  plugins: [],
};

export default config;
