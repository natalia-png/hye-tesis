/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Neutros elegantes
        ink:   "#111111",  // casi negro
        coal:  "#1b1b1b",  // negro suave
        ivory: "#F7F6F2",  // blanco cálido
        linen: "#F2EEE7",  // beige muy claro
        sand:  "#E7E2D7",  // beige suave
        taupe: "#BBB4A8",  // greige medio para bordes
        stone: "#6B7280",  // texto secundario frío
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
