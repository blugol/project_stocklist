import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function takeNewBuild() {
  const now = [...document.scripts].map((s) => s.src).find((src) => src.includes("/assets/"));
  if (!now) return;
  const peek = async () => {
    try {
      const html = await fetch(`/?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.text());
      const next = html.match(/src="(\/assets\/[^"]+)"/);
      if (next && !now.includes(next[1])) location.reload();
    } catch {
      /* 오프라인이면 지금 화면을 유지합니다. */
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void peek();
  });
  void peek();
}

takeNewBuild();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
