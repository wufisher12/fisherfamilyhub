import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build work under any URL path (GitHub Pages project sites live at /repo-name/)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
