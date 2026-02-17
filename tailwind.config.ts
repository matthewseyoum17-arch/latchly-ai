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
          500: "#0e7c6b",
          600: "#0a6b5c",
          700: "#065f46",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
      keyframes: {
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
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
      },
      animation: {
        "slide-up": "slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        "fade-in": "fade-in 0.3s ease",
        "message-in": "message-in 0.25s ease-out",
        bounce: "bounce 1.4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        pulse: "pulse 3s infinite",
        "nudge-in": "nudge-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
