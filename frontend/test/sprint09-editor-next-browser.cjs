"use strict";
// Sprint 09 · product editor. Real production Next build + real Express/auth + ephemeral MongoDB
// replica set (phase2Fixture). Own loopback ports, sanitized child env, no .env, no Cloudinary,
// external network blocked. DIZOR_SPRINT09_MODE=antes only captures the previous design.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const MODE = process.env.DIZOR_SPRINT09_MODE === "antes" ? "antes" : "despues";
const root = path.resolve(__dirname, "../.."), front = path.join(root, "frontend");
const out = path.join(process.env.DIZOR_SPRINT09_OUT || path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-09"), MODE);
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(out, "fallo.png"), { force: true });
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint09-next-"));
const result = { mode: MODE, checks: [], pageErrors: [], hydrationErrors: [], externalRequests: [], screenshots: [], measurements: [] };
let page, browser, nextServer, fixture, ready = false, buildLog = "", serverLog = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function command(args, env, onData) { return new Promise((resolve, reject) => { const child = spawn(process.execPath, args, { cwd: stage, env, windowsHide: true }); const timer = setTimeout(() => child.kill(), 300000); child.stdout.on("data", (d) => onData(d.toString())); child.stderr.on("data", (d) => onData(d.toString())); child.once("error", reject); child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); }); }); }

(async () => {
 try {
  const port = await new Promise((resolve) => { const probe = http.createServer(); probe.listen(0, "127.0.0.1", () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  fixture = require("../../backend/test/helpers/phase2Fixture.cjs");
  process.env.CLIENT_URL = `http://127.0.0.1:${port}`; process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
  await fixture.setup(); ready = true;
  const ctx = fixture.context, apiUrl = ctx.base + "/api", origin = `http://127.0.0.1:${port}`;
  fs.cpSync(front, stage, { recursive: true, filter: (file) => !["node_modules", ".next", ".git", "test"].includes(path.basename(file)) && !path.basename(file).startsWith(".env") });
  fs.symlinkSync(path.join(front, "node_modules"), path.join(stage, "node_modules"), "junction");
  const guard = path.join(stage, "offline.cjs");
  fs.writeFileSync(guard, `const net=require('node:net');const fetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{if(process.env.DIZOR_ISOLATED_RUNTIME==='1'&&['localhost','127.0.0.1'].includes(new URL(typeof input==='string'?input:input.url).hostname))return fetch(input,init);throw Error('Isolated fetch blocked');};const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const value=args[0];if(value&&typeof value==='object'&&value.path)return connect.apply(this,args);if(typeof value==='string'&&value.includes('pipe'))return connect.apply(this,args);if(process.env.DIZOR_ISOLATED_RUNTIME==='1'){const normalized=Array.isArray(value)?value[0]:value;const host=typeof normalized==='object'?normalized.host:args[1];if(host===undefined||['localhost','127.0.0.1','::1'].includes(host))return connect.apply(this,args);}throw Error('Isolated TCP blocked');};`);
  const env = {}; for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: apiUrl, NEXT_PUBLIC_SITE_URL: origin, NODE_OPTIONS: `--require=${JSON.stringify(guard)}` });
  const nextBin = path.join(front, "node_modules/next/dist/bin/next");
  const built = await command([nextBin, "build", "--webpack"], env, (t) => { buildLog += t; });
  fs.writeFileSync(path.join(out, "build.txt"), buildLog);
  assert.equal(built.code, 0, buildLog.slice(-4000));
  nextServer = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: stage, env: { ...env, DIZOR_ISOLATED_RUNTIME: "1" }, windowsHide: true });
  nextServer.stdout.on("data", (d) => { serverLog += d; }); nextServer.stderr.on("data", (d) => { serverLog += d; });
  for (let attempt = 0; attempt < 80; attempt++) { try { const r = await fetch(origin + "/admin"); if (r.status === 200) break; } catch {} await sleep(250); if (attempt === 79) throw Error(serverLog); }
  browser = await puppeteer.launch({ executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking", "--disable-sync", "--no-first-run"] });
  page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
  page.on("pageerror", (e) => result.pageErrors.push(e.message));
  page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text())) result.hydrationErrors.push(m.text()); });
  page.on("dialog", (d) => { result.pageErrors.push("diálogo nativo: " + d.message()); d.dismiss(); });
  await page.setRequestInterception(true);
  const network = { handle: null };
  page.on("request", async (r) => {
    const u = new URL(r.url());
    if (!["127.0.0.1", "localhost"].includes(u.hostname) && !["data:", "blob:"].includes(u.protocol)) { result.externalRequests.push(u.origin + u.pathname); return r.abort(); }
    if (network.handle && await network.handle(r)) return;
    r.continue();
  });
  const cookie = async (role) => { const cookies = await page.cookies(); if (cookies.length) await page.deleteCookie(...cookies); const raw = role === "superadmin" ? ctx.superCookie : role === "vendedor" ? ctx.vendorCookie : ctx.adminCookie; await page.setCookie(...raw.split("; ").filter((p) => p.includes("=")).map((p) => { const i = p.indexOf("="); return { name: p.slice(0, i), value: p.slice(i + 1), url: origin, httpOnly: true, sameSite: "Lax" }; })); };
  const text = async (value, timeout = 20000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, value);
  const goto = async (url, value) => { const r = await page.goto(origin + url, { waitUntil: "domcontentloaded" }); assert.ok([200, 304].includes(r.status()), `${url}: ${r.status()}`); if (value) await text(value); };
  const shot = async (name, full = true) => { await page.evaluate(() => scrollTo(0, 0)); await sleep(120); await page.screenshot({ path: path.join(out, name + ".png"), fullPage: full }); result.screenshots.push(name + ".png"); };
  const check = (id, label) => { result.checks.push(`${id} ${label}`); process.stdout.write(`ok - ${id} ${label}\n`); };
  const measure = async (name) => { const m = await page.evaluate(() => ({ width: innerWidth, height: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 })); result.measurements.push({ name, ...m }); return m; };
  const tools = { page, ctx, fixture, origin, out, result, network, cookie, text, goto, shot, check, measure, sleep, MODE };
  await require("./helpers/sprint09EditorFlow.cjs")(tools);
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.hydrationErrors, []); assert.deepEqual(result.externalRequests, []);
  result.passed = true;
 } catch (error) {
  result.passed = false; result.error = error.stack || error.message; console.error(result.error);
  if (page) { try { result.failure = { url: page.url(), active: await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 200)), text: (await page.evaluate(() => document.body.innerText)).slice(0, 3000) }; await page.screenshot({ path: path.join(out, "fallo.png"), fullPage: true }); } catch {} }
 } finally {
  if (browser) await browser.close();
  if (nextServer) { nextServer.kill(); await new Promise((r) => { if (nextServer.exitCode !== null) return r(); nextServer.once("exit", r); setTimeout(r, 5000); }); }
  if (ready) await fixture.close();
  fs.writeFileSync(path.join(out, "navegador.json"), JSON.stringify(result, null, 2));
  // The staging copy holds a junction to the real node_modules: it is left in the OS temp folder, never removed recursively.
  if (!result.passed) process.exitCode = 1;
 }
})();
