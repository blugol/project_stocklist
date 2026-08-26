const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function proxyNaver(req, origin, referer) {
  const url = new URL(req.url);
  const destPath = url.pathname.replace(/^\/api\/[^/]+/, "") || "/";
  const target = `${origin}${destPath}${url.search}`;
  const up = await fetch(target, {
    headers: {
      Referer: referer,
      "User-Agent": UA,
      Accept: req.headers.get("accept") || "*/*",
    },
  });
  const headers = new Headers();
  const type = up.headers.get("content-type");
  if (type) headers.set("Content-Type", type);
  headers.set("Cache-Control", "public, max-age=5");
  return new Response(up.body, { status: up.status, headers });
}
