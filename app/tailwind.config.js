/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep dark base
        bg:       "#06070A",
        bg2:      "#0A0B11",
        surface:  "rgba(15,15,22,0.6)",
        border:   "rgba(255,255,255,0.06)",
        borderHi: "rgba(255,255,255,0.12)",

        // Neutrals
        muted:    "#3A3F4A",
        dim:      "#6B7280",
        text:     "#C9D1E0",
        bright:   "#EBF0FA",

        // Brand neon trio
        cyan:     "#00FFD1",
        cyanDim:  "#00BFA0",
        violet:   "#7B5FFF",
        violetLight: "#B8A8FF",
        coral:    "#FF4365",
        coralLight: "#FF8295",

        // States
        amber:    "#F59E0B",
        green:    "#00E89E",
        red:      "#FF4365",
      },
      fontFamily: {
        display: ["'Inter'", "system-ui", "sans-serif"],
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-in":   "fadeIn 0.5s ease forwards",
        "slide-up":  "slideUp 0.5s ease forwards",
        "live-ping": "livePing 1.6s ease-in-out infinite",
        "shimmer":   "shimmer 2.5s linear infinite",
        "spin-slow": "spin 12s linear infinite",
        "float":     "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:  { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        livePing: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: "0.6", transform: "scale(1.15)" } },
        shimmer:  { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
        float:    { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      backgroundImage: {
        "grad-mesh": "radial-gradient(at 0% 0%, rgba(255,67,101,0.4) 0%, transparent 40%), radial-gradient(at 100% 0%, rgba(123,95,255,0.4) 0%, transparent 40%), radial-gradient(at 100% 100%, rgba(31,79,232,0.4) 0%, transparent 40%), radial-gradient(at 0% 100%, rgba(255,67,101,0.3) 0%, transparent 40%)",
        "grad-brand": "linear-gradient(135deg, #00FFD1 0%, #7B5FFF 50%, #FF4365 100%)",
      },
    },
  },
  plugins: [],
};
