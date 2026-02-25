/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#131926",
        card: "#1f2937",
        ink: "#ecf2ff",
        accent: "#1fbf8f",
        danger: "#dd5f5f"
      }
    }
  },
  plugins: []
};
