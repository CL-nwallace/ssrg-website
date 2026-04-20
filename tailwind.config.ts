import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "#0a0a0a",
          elevated: "#111111",
          surface: "#1a1a1a",
        },
        gold: {
          DEFAULT: "#c9a84c",
          light: "#d4b96a",
          muted: "#8a7535",
        },
        text: {
          primary: "#f5f5f5",
          secondary: "#a3a3a3",
          muted: "#737373",
        },
      },
      fontFamily: {
        serif: ["Cormorant", "serif"],
        sans: ["Montserrat", "sans-serif"],
      },
      fontSize: {
        "display": ["80px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "hero": ["64px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading": ["48px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "subheading": ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "large": ["24px", { lineHeight: "1.4" }],
        "body": ["16px", { lineHeight: "1.6" }],
        "small": ["14px", { lineHeight: "1.5" }],
      },
      borderColor: {
        subtle: "rgba(255, 255, 255, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
