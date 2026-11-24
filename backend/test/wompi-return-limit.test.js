const test = require("node:test"), assert = require("node:assert/strict");
const express = require("express");
const { paymentReturnLimiter, trackingLimiter } = require("../src/middlewares/rateLimitMiddleware");

test("L01: limita verificaciones privadas sin agotar las consultas de confirmación", async () => {
  const app = express(); let verified = 0;
  app.post("/return", paymentReturnLimiter, (_req, res) => { verified++; res.json({ status: "success" }); });
  app.post("/lookup", trackingLimiter, (_req, res) => res.json({ status: "success" }));
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let i = 0; i < 12; i++) assert.equal((await fetch(`${base}/return`, { method: "POST" })).status, 200);
    assert.equal((await fetch(`${base}/return`, { method: "POST" })).status, 429); assert.equal(verified, 12);
    for (let i = 0; i < 9; i++) assert.equal((await fetch(`${base}/lookup`, { method: "POST" })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
