import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

function orderLogFile(): Plugin {
  return {
    name: "order-log-file",
    configureServer(server) {
      server.middlewares.use("/dev/order-log", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => {
          chunks.push(chunk as Buffer);
        });
        req.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { text?: string };
            if (typeof body.text !== "string") throw new Error("text");
            const dir = path.resolve(server.config.root, "기록");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, "금일대장.txt"), body.text, "utf8");
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
    },
  };
}

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
  plugins: [react(), orderLogFile()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    open: "http://localhost:5173/",
    allowedHosts: true,
    proxy,
  },
  preview: { host: true, proxy },
});
