import { defineConfig } from "vite";

// Dev server chuyển /api sang backend FastAPI => không dính CORS và không hardcode URL.
export default defineConfig({
  server: {
    port: 5173, proxy: { "/api": "http://127.0.0.1:8000" },
    watch: { ignored: ["**/scripts/**"] },
  },
  // Cache thư viện 3D riêng khi chỉ đổi UI; không cần tải lại toàn bộ Three.js.
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
