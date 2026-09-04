import http from "node:http";
import { evaluateProduct } from "./index.js";

const port = Number(process.env.RULES_ENGINE_PORT || 8090);

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    res.end(JSON.stringify({ status: "ok", service: "parakh-rules-engine" }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/evaluate") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const payload = JSON.parse(body || "{}");
    res.end(JSON.stringify(evaluateProduct(payload.product ?? {}, payload.rules ?? [])));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => console.log(`PARAKH rules engine running on http://localhost:${port}`));
