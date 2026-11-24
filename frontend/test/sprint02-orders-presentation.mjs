import test from "node:test";
import assert from "node:assert/strict";
import { financePresentation, formatOrderListDate, isOperationalAction, shortenOrderNumber } from "../src/lib/orderListPresentation.mjs";

test("la referencia larga se abrevia y el resto de números se conserva", () => {
  assert.equal(shortenOrderNumber("DIZ-20261123-ABCDEF1234567890"), "DIZ-…567890");
  assert.equal(shortenOrderNumber("DIZ-PRUEBA-NUEVO0"), "DIZ-PRUEBA-NUEVO0");
  assert.equal(shortenOrderNumber(""), "");
});

test("el pago no convierte una entrega en cobro", () => {
  assert.deepEqual(financePresentation({ paymentStatus: "pendiente", paymentMethod: "wompi" }), { label: "Pago pendiente", tone: "warn" });
  assert.deepEqual(financePresentation({ paymentStatus: "pendiente", paymentMethod: "contra_entrega", orderStatus: "entregado" }), { label: "Recaudo pendiente", tone: "warn" });
  assert.deepEqual(financePresentation({ paymentStatus: "pagado", paymentMethod: "contra_entrega", orderStatus: "entregado" }), { label: "Pagado", tone: "ok" });
  assert.equal(financePresentation({ paymentStatus: "rechazado" }).label, "Rechazado");
  assert.equal(financePresentation({ paymentStatus: "reembolsado" }).label, "Reembolsado");
});

test("solo las transiciones operativas se presentan como acción", () => {
  for (const code of ["prepare", "dispatch", "deliver", "collect"]) assert.equal(isOperationalAction(code), true);
  for (const code of ["review", "closed", "waiting_collection", "waiting_payment", "complete", undefined]) assert.equal(isOperationalAction(code), false);
});

test("la fecha compacta usa hora de Colombia", () => {
  assert.match(formatOrderListDate("2026-11-20T14:00:00Z"), /20/);
  assert.equal(formatOrderListDate(""), "Sin fecha registrada");
});
