/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      // Colors map onto CSS custom properties defined in src/styles/global.css.
      // The whole site is now a terminal/build-log skin, so tokens lean toward a
      // flat near-black surface with a green "prompt" accent and an amber warning.
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--c-accent-soft) / <alpha-value>)",
        "accent-warm": "rgb(var(--c-accent-warm) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        // Mono is now the default everywhere. This single change is what makes the
        // entire site read as a terminal rather than a designed-startup landing page.
        sans: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        content: "64rem",
      },
      boxShadow: {
        // Flat by design. No soft floaty product shadows.
        card: "none",
        "card-hover": "none",
      },
    },
  },
  plugins: [],
};
