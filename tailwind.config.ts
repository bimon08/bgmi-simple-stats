import { heroui } from "@heroui/theme";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  plugins: [heroui({
    defaultTheme: "dark",
    themes: {
      dark: {
        colors: {
          primary: { DEFAULT: "#f59e0b", foreground: "#000" },
          secondary: { DEFAULT: "#6366f1" },
        },
      },
    },
  })],
};

export default config;
