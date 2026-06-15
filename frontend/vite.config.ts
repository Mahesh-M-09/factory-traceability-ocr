import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/factory-traceability-ocr/",
  plugins: [react()],
  server: {
    port: 5173
  }
});
