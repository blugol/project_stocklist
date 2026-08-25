import { proxyNaver } from "../../utils/naver-proxy.js";

export default async function handler(req, res) {
  try {
    await proxyNaver(req, res, "https://m.stock.naver.com", "https://m.stock.naver.com/");
  } catch {
    res.status(502).end();
  }
}

export const config = { regions: ["icn1"] };
