import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0e7c6b",
          light: "#10b981",
          dark: "#0a6b5c",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#0e7c6b",
          600: "#0a6b5c",
          700: "#065f46",
          800: "#064e3b",
          900: "#022c22",
        },
        surface: {
          DEFAULT: "#fafbfc",
          warm: "#faf9f7",
          muted: "#f4f5f7",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
      boxShadow: {
        "soft": "0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.05)",
        "lifted": "0 4px 12px -2px rgba(0,0,0,0.08), 0 8px 24px -4px rgba(0,0,0,0.06)",
        "dramatic": "0 8px 30px -4px rgba(0,0,0,0.1), 0 16px 60px -8px rgba(0,0,0,0.08)",
        "glow-brand": "0 0 20px rgba(14,124,107,0.15), 0 0 60px rgba(14,124,107,0.08)",
        "glow-brand-lg": "0 0 30px rgba(14,124,107,0.2), 0 0 80px rgba(14,124,107,0.12)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.1)",
      },
      keyframes: {
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "message-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        bounce: {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-5px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        "nudge-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.5s cubic-bezier(0.16,1,0.3,1)",
        "fade-in": "fade-in 0.4s ease",
        "message-in": "message-in 0.25s ease-out",
        bounce: "bounce 1.4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        pulse: "pulse 3s infinite",
        "nudge-in": "nudge-in 0.3s ease-out",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
