import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly if 5173 is taken rather than drifting to a new port (which would lose localStorage)
    open: true, // auto-opens browser on launch
  },
});
