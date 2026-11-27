"use strict";
// Capture-only flow: current mobile presentation of Finanzas and Marketing (390 px), plus
// heights, on real Next + Express + MongoDB. Used before and after the mobile refinements.
// DIZOR_CAPTURE_PREFIX names the files (antes / despues). Fictitious data only.
const path = require("node:path");

module.exports = async function flow(t) {
  const { page, fixture, ctx, out, result, cookie, goto, sleep } = t;
  const prefix = process.env.DIZOR_CAPTURE_PREFIX || "antes";
  await fixture.makeProduct(5);
  const shot = async (name) => { await page.evaluate(() => scrollTo(0, 0)); await sleep(350); await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`), fullPage: true }); result.screenshots.push(`${prefix}-${name}.png`); };
  const measure = async (name) => result.measurements.push({ name: `${prefix}-${name}`, ...(await page.evaluate(() => ({ width: innerWidth, height: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 }))) });
  await cookie("superadmin");
  const routes = [["finanzas-panel", "/admin/finanzas", "Finanzas"], ["finanzas-costos", "/admin/finanzas?tab=costos", "Costos"], ["finanzas-historial", "/admin/finanzas?tab=historial", "Historial"],
    ["cupones-vacio", "/admin/cupones", "Cupones"]];
  for (const width of [390, 360]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 800 });
    for (const [name, url, wait] of routes) { await goto(url, wait); await sleep(500); if (width === 390) await shot(name); await measure(`${name}-${width}`); }
  }
  for (const [code, value] of [["IRACA10", 10], ["VUELTIAO15", 15]]) await fixture.api("POST", "/api/admin/coupons", { cookie: ctx.superCookie, body: { code, description: `Cupón ficticio ${code}`, type: "percentage", value } });
  for (const width of [390, 360]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 800 });
    for (const [name, url, wait] of [["cupones", "/admin/cupones", "IRACA10"], ["marketing-popup", "/admin/marketing?tab=popup", "Marketing"], ["marketing-newsletter", "/admin/marketing?tab=newsletter", "Marketing"], ["marketing-carritos", "/admin/marketing?tab=carritos", "Marketing"], ["marketing-exportaciones", "/admin/marketing?tab=exports", "Exportaciones"]]) {
      await goto(url, wait); await sleep(500); if (width === 390) await shot(name); await measure(`${name}-${width}`);
    }
  }
};
