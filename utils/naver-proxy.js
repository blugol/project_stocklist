const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function proxyNaver(req, res, origin, referer) {
  const url = new URL(req.url, "http://localhost");
  const destPath = url.pathname.replace(/^\/api\/[^/]+/, "") || "/";
  const target = `${origin}${destPath}${url.search}`;

  const up = await fetch(target, {
    headers: {
      Referer: referer,
      "User-Agent": UA,
      Accept: req.headers.accept || "*/*",
    },
  });

  const buf = Buffer.from(await up.arrayBuffer());
  res.status(up.status);
  const type = up.headers.get("content-type");
  if (type) res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=5");
  res.send(buf);
}
