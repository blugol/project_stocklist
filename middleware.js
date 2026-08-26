const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const TARGETS = {
  naver: { origin: "https://polling.finance.naver.com", referer: "https://finance.naver.com/" },
  mstock: { origin: "https://m.stock.naver.com", referer: "https://m.stock.naver.com/" },
  finance: { origin: "https://finance.naver.com", referer: "https://finance.naver.com/" },
};

export const config = {
  matcher: ["/api/naver/:path*", "/api/mstock/:path*", "/api/finance/:path*"],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const dest = TARGETS[url.pathname.split("/")[2]];
  if (!dest) return new Response("not found", { status: 404 });
  const destPath = url.pathname.replace(/^\/api\/[^/]+/, "") || "/";
  return fetch(`${dest.origin}${destPath}${url.search}`, {
    headers: {
      Referer: dest.referer,
      "User-Agent": UA,
      Accept: request.headers.get("accept") || "*/*",
    },
  });
}
