// Development-only tunnel origin. Never expose the full local backend to test a webhook.
const http = require("node:http");
const path = require("node:path");
const { verifyEventChecksum } = require("../services/wompiService");

const WEBHOOK_PATH = "/api/webhooks/wompi";

function createSandboxWebhookRelay({
  verify = verifyEventChecksum,
  backendPort = 5000,
  maxBytes = 256 * 1024,
  forwardTimeoutMs = 45000,
  onDelivery = () => {},
} = {}) {
  const server = http.createServer((req, res) => {
    const reply = (status, message) => {
      if (!res.writableEnded && !res.destroyed) {
        res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end(message);
      }
    };
    if (req.url !== WEBHOOK_PATH) { req.resume(); return reply(404, "Not found"); }
    if (req.method !== "POST") { req.resume(); return reply(405, "POST required"); }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      req.resume(); return reply(415, "JSON required");
    }
    const chunks = [];
    let length = 0;
    let tooLarge = false;
    req.on("data", chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        reply(413, "Payload too large");
      } else if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return;
      const raw = Buffer.concat(chunks);
      let event;
      try { event = JSON.parse(raw.toString("utf8")); }
      catch { return reply(400, "Invalid JSON"); }
      if (event?.environment !== "test") return reply(400, "Sandbox events only");
      const checksum = req.headers["x-event-checksum"] || event?.signature?.checksum;
      if (!verify(event, checksum)) return reply(401, "Invalid checksum");
      // Only the signed body and checksum travel to the existing receiver. Never forward
      // cookies, Authorization, proxy headers, arbitrary paths, or a caller-selected host.
      const headers = { "Content-Type": "application/json", "Content-Length": raw.length };
      if (checksum) headers["X-Event-Checksum"] = checksum;
      const upstream = http.request({
        hostname: "127.0.0.1", port: backendPort, path: WEBHOOK_PATH,
        method: "POST", headers,
      }, incoming => {
        incoming.resume();
        incoming.on("end", () => {
          const status = incoming.statusCode || 503;
          onDelivery({ at: new Date().toISOString(), status });
          reply(status, status === 200 ? "OK" : "Backend did not accept event");
        });
        incoming.on("error", () => reply(503, "Backend unavailable"));
      });
      upstream.setTimeout(forwardTimeoutMs, () => upstream.destroy());
      upstream.on("error", () => reply(503, "Backend unavailable"));
      upstream.end(raw);
    });
    req.on("error", () => reply(400, "Incomplete request"));
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (require.main === module) {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
  if (process.env.NODE_ENV === "production" || process.env.WOMPI_ENV !== "sandbox"
      || !process.env.WOMPI_PRIVATE_KEY?.startsWith("prv_test_")
      || !process.env.WOMPI_EVENTS_SECRET?.startsWith("test_events_")) {
    throw new Error("Este receptor temporal requiere configuración explícita de Sandbox; no admite producción");
  }
  const relay = createSandboxWebhookRelay({ onDelivery: record => console.log(JSON.stringify(record)) });
  relay.on("error", error => { console.error(`Relay failed: ${error.code || "UNKNOWN"}`); process.exitCode = 1; });
  relay.listen(5011, "127.0.0.1", () => console.log(`Sandbox webhook relay: http://127.0.0.1:5011${WEBHOOK_PATH}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    relay.close();
    relay.closeAllConnections();
  });
}

module.exports = { createSandboxWebhookRelay, WEBHOOK_PATH };
