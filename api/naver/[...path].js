import { proxyNaver } from "../../utils/naver-proxy.js";

export const config = { runtime: "edge", regions: ["icn1"] };

export default function handler(req) {
  return proxyNaver(req, "https://polling.finance.naver.com", "https://finance.naver.com/");
}
