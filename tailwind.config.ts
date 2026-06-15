import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141615",
        graphite: "#26302c",
        paper: "#f7f3ec",
        chalk: "#fffaf1",
        brass: "#b88942",
        celadon: "#6ba58b",
        oxblood: "#7d2f37",
        bluepaper: "#d8e5ef"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "SFMono-Regular", "ui-monospace", "monospace"]
      },
      boxShadow: {
        panel: "0 18px 60px rgba(20, 22, 21, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
