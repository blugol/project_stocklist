import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const proxy: Record<string, ProxyOptions> = {
  "/api/naver": {
    target: "https://polling.finance.naver.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/naver/, ""),
    headers: {
      Referer: "https://finance.naver.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
  },
  "/api/mstock": {
    target: "https://m.stock.naver.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/mstock/, ""),
    headers: {
      Referer: "https://m.stock.naver.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
  },
  "/api/finance": {
    target: "https://finance.naver.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/finance/, ""),
    headers: {
      Referer: "https://finance.naver.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "localhost",
    strictPort: true,
    open: "http://localhost:5173/",
    proxy,
  },
  preview: { proxy },
});
