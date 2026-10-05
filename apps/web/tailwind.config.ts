import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#eef3fa", 100: "#d6e2f2", 600: "#1d4e89", 700: "#13315c", 800: "#0b2545", 900: "#071a33" },
        sea: { 400: "#2ec4b6", 500: "#13a89e", 600: "#0e8c84" },
        signal: { red: "#d62828", amber: "#f4a261", green: "#2a9d8f" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
