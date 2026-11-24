const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const { createSandboxWebhookRelay, WEBHOOK_PATH } = require("../src/scripts/wompiSandboxWebhookRelay");

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
const origin = server => `http://127.0.0.1:${server.address().port}`;

test("Sandbox relay restricts exposure and preserves the signed request and provider retries", async t => {
  const received = [];
  let backendStatus = 200;
  const backend = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      received.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.writeHead(backendStatus); res.end("Backend response");
    });
  });
  await listen(backend);
  const deliveries = [];
  const relay = createSandboxWebhookRelay({
    backendPort: backend.address().port, maxBytes: 2048,
    verify: (event, checksum) => event.signature?.checksum === "valid" && checksum === "valid",
    onDelivery: record => deliveries.push(record),
  });
  await listen(relay);
  t.after(async () => { await close(relay); await close(backend); });
  const raw = '{ "environment": "test", "signature": {"checksum":"valid"}, "data": {"original":"a<&b"} }';
  const post = (body = raw, options = {}) => fetch(origin(relay) + WEBHOOK_PATH, {
    method: "POST", headers: { "Content-Type": "application/json", ...options.headers }, body,
  });
  await t.test("only the webhook POST is public, including query-string rejection", async () => {
    for (const route of ["/", "/api/admin/orders", WEBHOOK_PATH + "?redirect=/api/admin"]) {
      assert.equal((await fetch(origin(relay) + route)).status, 404);
    }
    assert.equal((await fetch(origin(relay) + WEBHOOK_PATH)).status, 405);
    assert.equal(received.length, 0);
  });
  await t.test("rejects malformed, unsigned, production and oversized bodies before forwarding", async () => {
    assert.equal((await post("{")).status, 400);
    assert.equal((await post('{"environment":"test"}')).status, 401);
    assert.equal((await post(raw.replace('"test"', '"prod"'))).status, 400);
    assert.equal((await post(raw, { headers: { "Content-Type": "text/plain" } })).status, 415);
    assert.equal((await post("x".repeat(3000))).status, 413);
    assert.equal(received.length, 0);
  });
  await t.test("retains exact bytes and checksum but strips authorization, cookies and proxy headers", async () => {
    assert.equal((await post(raw, { headers: {
      "X-Event-Checksum": "valid", Authorization: "Bearer untrusted", Cookie: "session=untrusted",
      "X-Forwarded-For": "1.2.3.4",
    } })).status, 200);
    assert.equal(received.length, 1);
    assert.equal(received[0].body, raw);
    assert.equal(received[0].url, WEBHOOK_PATH);
    assert.equal(received[0].method, "POST");
    assert.equal(received[0].headers["x-event-checksum"], "valid");
    for (const name of ["authorization", "cookie", "x-forwarded-for"]) assert.equal(received[0].headers[name], undefined);
    assert.deepEqual(Object.keys(deliveries[0]).sort(), ["at", "status"]);
  });
  await t.test("does not acknowledge backend errors as successful delivery", async () => {
    backendStatus = 503;
    assert.equal((await post()).status, 503);
    backendStatus = 401;
    assert.equal((await post()).status, 401);
  });
  await t.test("backend outage returns non-200 so Wompi may retry", async () => {
    await close(backend);
    assert.equal((await post()).status, 503);
  });
});

test("real checksum verification rejects tampering before the backend sees the event (local simulated event)", async t => {
  const previousSecret = process.env.WOMPI_EVENTS_SECRET;
  process.env.WOMPI_EVENTS_SECRET = "test_events_local_relay_" + crypto.randomBytes(16).toString("hex");
  let calls = 0;
  const backend = http.createServer((req, res) => { calls++; req.resume(); res.end("OK"); });
  await listen(backend);
  const relay = createSandboxWebhookRelay({ backendPort: backend.address().port });
  await listen(relay);
  t.after(async () => {
    await close(relay); await close(backend);
    if (previousSecret === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = previousSecret;
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const tx = { id: "local-simulated", status: "APPROVED", amount_in_cents: 2800000 };
  const checksum = crypto.createHash("sha256")
    .update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`).digest("hex");
  const event = { event: "transaction.updated", environment: "test", timestamp, data: { transaction: tx },
    signature: { checksum, properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"] } };
  const send = () => fetch(origin(relay) + WEBHOOK_PATH, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event),
  });
  assert.equal((await send()).status, 200);
  tx.amount_in_cents++;
  assert.equal((await send()).status, 401);
  assert.equal(calls, 1);
});

test("a backend that hangs is not acknowledged, allowing provider retry", async t => {
  const backend = http.createServer(req => req.resume());
  await listen(backend);
  const relay = createSandboxWebhookRelay({ backendPort: backend.address().port, verify: () => true, forwardTimeoutMs: 30 });
  await listen(relay);
  t.after(async () => { await close(relay); await close(backend); });
  const response = await fetch(origin(relay) + WEBHOOK_PATH, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"environment":"test"}',
  });
  assert.equal(response.status, 503);
});
