import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette — light pink + violet, warm and welcoming for a
        // Montessori school, grounded with a deep plum ink and a soft gold
        // accent that carries the "wisdom" note from the motto.
        blush: {
          50: "#FFF8FB",
          100: "#FBEAF2",
          200: "#F6D9E6",
          300: "#EFBBD6",
          400: "#E7A0C5",
        },
        violet: {
          50: "#F4F0FA",
          100: "#E4D9F2",
          200: "#C7AEE3",
          300: "#A47FD0",
          400: "#8259BB",
          500: "#6B429F",
          600: "#573483",
          700: "#432866",
        },
        plum: {
          900: "#2E1735",
          800: "#3B1F45",
        },
        gold: {
          400: "#D9B26B",
          500: "#C79A56",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        arch: "999px 999px 12px 12px",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(59, 31, 69, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
