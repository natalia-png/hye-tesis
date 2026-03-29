/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // CSS variables — cambian automáticamente con el tema
        ink:   "rgb(var(--ink)   / <alpha-value>)",
        coal:  "rgb(var(--coal)  / <alpha-value>)",
        ivory: "rgb(var(--ivory) / <alpha-value>)",
        linen: "rgb(var(--linen) / <alpha-value>)",
        sand:  "rgb(var(--sand)  / <alpha-value>)",
        taupe: "rgb(var(--taupe) / <alpha-value>)",
        stone: "rgb(var(--stone) / <alpha-value>)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 6px 24px rgba(0,0,0,0.06)",
      },
      maxWidth: {
        phone: "420px",
      },
    },
  },
  plugins: [],
};
