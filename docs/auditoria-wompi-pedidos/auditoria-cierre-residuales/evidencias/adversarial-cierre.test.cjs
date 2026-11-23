// Auditoría independiente del cierre de residuales NR-01..NR-03 (Claude, 2026-11-23).
// Pruebas adversariales F01–F35. Cada aserción expresa el comportamiento SEGURO esperado.
// El proveedor simulado NO copia el evento: cada prueba fija qué responde GET /v1/transactions/{id}.
// AUD_ROOT = raíz del árbol probado (copia aislada del árbol de trabajo).
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const ROOT = path.resolve(process.env.AUD_ROOT || path.resolve(__dirname, '../../../..'));
const f = require(path.join(ROOT, 'docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs'));
const src = (p) => require(path.join(ROOT, 'backend/src', p));
const obs = (id, data) => console.log(`OBS ${id} ${JSON.stringify(data)}`);
const pub = (tx) => f.provider.tx.set(tx.id, { ...tx });
const reconcile = (o, id, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie, body: id === undefined ? {} : { transactionId: id } });
const reprocess = (r, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie });
const archive = (r, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/archive`, { cookie, body });
const reopen = (r, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/reopen`, { cookie, body });
const view = async (v) => (await f.api('GET', `/api/admin/orders/payment-events${v ? '?view=' + v : ''}`, { cookie: f.cookies.admin })).json;
const alerts = async () => (await f.api('GET', '/api/admin/alerts', { cookie: f.cookies.admin })).json;
const receipt = (tx, status = tx.status) => f.M.PaymentEvent.findOne({ transactionId: tx.id, status }).lean();
const ev = (id) => f.M.PaymentEvent.findById(id).lean();
const open = (o) => o.incidents.filter((i) => !i.resolvedAt);
const count = (q) => f.M.Notification.countDocuments(q);
const audits = (q) => src('models/AuditLog').countDocuments(q);
const ms = (d) => (d ? new Date(d).getTime() : null);
const strip = (o) => JSON.parse(JSON.stringify(o));
const REASON = 'Contradicción investigada con el recibo autenticado de la misma transacción';

async function providerFault(id, kind, work) {
  const prev = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.pathname === `/v1/transactions/${encodeURIComponent(id)}`) {
      if (kind === 'timeout') throw Object.assign(new Error('timeout ficticio'), { name: 'TimeoutError' });
      return new Response('{}', { status: kind });
    }
    return prev(input, init);
  };
  try { return await work(); } finally { globalThis.fetch = prev; }
}
// Contradicción permanente reconciliada: 'state' = DECLINED firmado vs GET APPROVED; 'amount' = importe firmado distinto.
async function contradiction(kind) {
  const { order, p } = await f.newWompi(); let tx, r;
  if (kind === 'state') { tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'APPROVED' }); await f.postEvent(tx); }
  else { tx = f.linkTx(order); pub(tx); await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents - 100 }); }
  r = kind === 'state' ? await receipt(tx, 'DECLINED') : await f.M.PaymentEvent.findOne({ transactionId: tx.id, amountInCents: tx.amount_in_cents - 100 }).lean();
  const rc = await reconcile(order, tx.id);
  const proof = await f.M.PaymentEvent.findOne({ transactionId: tx.id, _id: { $ne: r._id }, processedAt: { $ne: null } }).lean();
  return { order, p, tx, r, rc, proof };
}

let superCookie;
test.before(async () => {
  await f.setup();
  await f.M.User.create({ name: 'U super3', email: 'super3-aud@example.test', password: 'AuditoriaPrueba123!', role: 'superadmin' });
  superCookie = await f.login('super3-aud@example.test', 'AuditoriaPrueba123!');
});
test.after(async () => { await f.close(); });

// ======================= NR-01 =======================
test('F01 NR-01: APPROVED aplicado + fallo 500 + conciliar intento DECLINED -> preparable; conciliar luego el correcto no cambia nada', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  await providerFault('caida-f01', 500, () => reconcile(order, 'caida-f01'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d);
  const rc = await reconcile(order, d.id); const o = await f.fresh(order._id);
  const rc2 = await reconcile(order, tx.id); const o2 = await f.fresh(order._id);
  obs('F01', { rc: rc.status, review: o.requiresReview, abiertas: open(o).map((i) => i.code), rc2: rc2.status, pago: o2.paymentStatus, txPrincipal: o2.wompi.transactionId === tx.id, stock: await f.stockOf(p) });
  assert.equal(rc.status, 200); assert.equal(o.requiresReview, false); assert.equal(open(o).length, 0);
  assert.equal(o2.paymentStatus, 'pagado'); assert.equal(o2.wompi.transactionId, tx.id); assert.equal(await f.stockOf(p), 4);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('F02 NR-01: DECLINED primero, APPROVED después en el mismo enlace, timeout y conciliación del DECLINED -> preparable', async () => {
  const { order, p } = await f.newWompi(); const d = f.linkTx(order, { status: 'DECLINED' }); pub(d);
  assert.equal((await f.postEvent(d)).status, 200); const a = f.linkTx(order); pub(a); assert.equal((await f.postEvent(a)).status, 200);
  await providerFault('caida-f02', 'timeout', () => reconcile(order, 'caida-f02'));
  const rc = await reconcile(order, d.id); const o = await f.fresh(order._id);
  obs('F02', { rc: rc.status, pago: o.paymentStatus, wompi: o.wompi.status, review: o.requiresReview, abiertas: open(o).map((i) => i.code), stock: await f.stockOf(p) });
  assert.equal(o.paymentStatus, 'pagado'); assert.equal(o.wompi.transactionId, a.id); assert.equal(o.requiresReview, false);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('F03 NR-01: varias transacciones (DECLINED, ERROR, APPROVED) y dos pistas fallidas; conciliar el ERROR cierra pistas y desbloquea', async () => {
  const { order } = await f.newWompi(); const d = f.linkTx(order, { status: 'DECLINED' }), e = f.linkTx(order, { status: 'ERROR' }), a = f.linkTx(order);
  for (const t of [d, e, a]) { pub(t); await f.postEvent(t); }
  await providerFault('pista-1', 502, () => reconcile(order, 'pista-1')); await providerFault('pista-2', 'timeout', () => reconcile(order, 'pista-2'));
  const rc = await reconcile(order, e.id); const o = await f.fresh(order._id);
  obs('F03', { rc: rc.status, pago: o.paymentStatus, review: o.requiresReview, cerradas: o.incidents.filter((i) => i.resolvedAt).length, abiertas: open(o).map((i) => i.code) });
  assert.equal(rc.status, 200); assert.equal(o.paymentStatus, 'pagado'); assert.equal(open(o).length, 0); assert.equal(o.requiresReview, false);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('F04 NR-01: incidencia legítima (segundo APPROVED) no se elimina al conciliar un DECLINED; el pedido sigue bloqueado', async () => {
  const { order } = await f.newWompi(); const a = f.linkTx(order); pub(a); await f.postEvent(a);
  const a2 = f.linkTx(order); pub(a2); await f.postEvent(a2);
  await providerFault('caida-f04', 500, () => reconcile(order, 'caida-f04'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d); const rc = await reconcile(order, d.id); const o = await f.fresh(order._id);
  obs('F04', { rc: rc.status, review: o.requiresReview, abiertas: open(o).map((i) => i.code) });
  assert.equal(rc.status, 200); assert.ok(open(o).some((i) => i.code === 'additional_approved_payment')); assert.ok(!open(o).some((i) => i.code === 'reconciliation_query_failed'));
  assert.equal(o.requiresReview, true); assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('F05 NR-01: pago anulado (VOIDED) + fallo + conciliar DECLINED -> sigue bloqueado con payment_voided abierto', async () => {
  const { order } = await f.newWompi(); const a = f.linkTx(order); pub(a); await f.postEvent(a);
  pub({ ...a, status: 'VOIDED' }); await f.postEvent({ ...a, status: 'VOIDED' });
  await providerFault('caida-f05', 500, () => reconcile(order, 'caida-f05'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d); const rc = await reconcile(order, d.id); const o = await f.fresh(order._id);
  obs('F05', { rc: rc.status, pago: o.paymentStatus, review: o.requiresReview, abiertas: open(o).map((i) => i.code) });
  assert.equal(o.paymentStatus, 'rechazado'); assert.ok(open(o).some((i) => i.code === 'payment_voided')); assert.equal(o.requiresReview, true);
  assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('F06 NR-01: pedido NO pagado + fallo + conciliar DECLINED -> no se vuelve preparable ni mueve stock', async () => {
  const { order, p } = await f.newWompi();
  await providerFault('caida-f06', 500, () => reconcile(order, 'caida-f06'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d); const rc = await reconcile(order, d.id); const o = await f.fresh(order._id);
  obs('F06', { rc: rc.status, pago: o.paymentStatus, review: o.requiresReview, stockDeducted: o.stockDeducted });
  assert.notEqual(o.paymentStatus, 'pagado'); assert.equal(o.stockDeducted, false); assert.equal(await f.stockOf(p), 5);
  assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('F07 NR-01: fallo real de Mongo (commitTransaction) durante la conciliación -> nunca desbloqueo parcial; el reintento converge con un AuditLog', async () => {
  const { order, p } = await f.newWompi(); const a = f.linkTx(order); pub(a); await f.postEvent(a);
  await providerFault('caida-f07', 500, () => reconcile(order, 'caida-f07'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d);
  await f.failpoint({ skip: 2 }, { failCommands: ['commitTransaction'], errorCode: 2 });
  let st; try { st = (await reconcile(order, d.id)).status; } finally { await f.failpoint('off'); }
  const mid = await f.fresh(order._id);
  const st2 = (await reconcile(order, d.id)).status; const o = await f.fresh(order._id);
  const logs = await audits({ entityId: order._id, action: 'wompi_query_failures_resolved' });
  obs('F07', { st, mid: { review: mid.requiresReview, abiertas: open(mid).map((i) => i.code) }, st2, review: o.requiresReview, logs, stock: await f.stockOf(p) });
  if (st !== 200) assert.ok(open(mid).some((i) => i.code === 'reconciliation_query_failed'), 'Respuesta fallida pero la incidencia se cerró');
  assert.equal(st2, 200); assert.equal(open(o).length, 0); assert.equal(o.requiresReview, false); assert.equal(logs, 1); assert.equal(await f.stockOf(p), 4);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('F08 NR-01: conciliaciones concurrentes (3 DECLINED + 1 APPROVED + 1 fallida) -> converge, un AuditLog por cierre, sin duplicar stock', async () => {
  const { order, p } = await f.newWompi(); const a = f.linkTx(order); pub(a); await f.postEvent(a);
  await providerFault('caida-f08', 500, () => reconcile(order, 'caida-f08'));
  const d = f.linkTx(order, { status: 'DECLINED' }); pub(d);
  const st = await providerFault('caida-f08b', 500, async () => (await Promise.all([reconcile(order, d.id), reconcile(order, d.id), reconcile(order, d.id), reconcile(order, a.id), reconcile(order, 'caida-f08b')])).map((r) => r.status));
  let o = await f.fresh(order._id); const intermedias = open(o).map((i) => i.code);
  if (open(o).length) { await reconcile(order, a.id); o = await f.fresh(order._id); }
  obs('F08', { st, intermedias, review: o.requiresReview, abiertas: open(o).map((i) => i.code), logs: await audits({ entityId: order._id, action: 'wompi_query_failures_resolved' }), stock: await f.stockOf(p) });
  assert.ok(st.every((s) => [200, 503].includes(s))); assert.equal(open(o).length, 0); assert.equal(o.requiresReview, false);
  assert.equal(await f.stockOf(p), 4); assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

// ======================= NR-02 =======================
test('F10 NR-02: recuperación NV-01 por reproceso (misma clave): identidad, fechas, origen, asociación y observación coherentes; repeticiones no reescriben', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  await f.postEvent(tx); const r0 = await receipt(tx); pub(tx);
  assert.equal((await reprocess(r0)).status, 200); const r1 = await ev(r0._id);
  await new Promise((res) => setTimeout(res, 15));
  const rep = (await Promise.all([reprocess(r0), reprocess(r0), f.postEvent(tx), reconcile(order, tx.id)])).map((x) => x.status);
  const r2 = await ev(r0._id); const o = await f.fresh(order._id);
  const lines = o.statusHistory.map((h) => h.note).filter((n) => n.includes(tx.id));
  obs('F10', { rep, r1: { pAt: r1.processedAt, assoc: r1.associationError, last: r1.lastError, src: r1.source, obs: r1.providerObservation?.status }, r2: { pAt: r2.processedAt, assoc: r2.associationError, last: r2.lastError }, lines });
  for (const k of ['_id', 'key', 'transactionId', 'status', 'amountInCents', 'currency', 'reference', 'environment', 'paymentLinkId', 'checksum', 'providerTimestamp', 'source']) assert.deepEqual(strip(r2[k]), strip(r0[k]), k);
  assert.equal(ms(r2.createdAt), ms(r0.createdAt)); assert.ok(r1.processedAt); assert.equal(ms(r2.processedAt), ms(r1.processedAt), 'processedAt reescrito por repeticiones');
  assert.equal(r2.associationError, ''); assert.equal(r2.lastError, ''); assert.equal(String(r2.order), String(order._id)); assert.equal(r2.providerObservation.status, 'APPROVED');
  assert.ok(!(r2.lastError || '').includes(String(r0._id)), 'referencia circular');
  assert.equal(lines.filter((n) => /^Wompi APPROVED verificado/.test(n)).length, 1, 'Debe haber un único primer procesamiento');
  assert.equal(await f.stockOf(p), 4); assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
});

test('F11 NR-02: sustitución entre recibos distintos: el original apunta al verificado (no a sí mismo) y sus fechas no cambian al repetir', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'PENDING', payment_link_id: null });
  await f.postEvent(tx); const orig = await receipt(tx); const ap = { ...tx, status: 'APPROVED', payment_link_id: order.wompi.paymentLinkId }; pub(ap);
  assert.equal((await reprocess(orig)).status, 200); const o1 = await ev(orig._id); const v1 = await receipt(ap, 'APPROVED');
  await new Promise((res) => setTimeout(res, 15));
  const rep = [(await reprocess(orig)).status, (await reconcile(order, ap.id)).status, (await reprocess(v1)).status];
  const o2 = await ev(orig._id); const v2 = await ev(v1._id);
  obs('F11', { rep, o1: { pAt: o1.processedAt, assoc: o1.associationError, last: o1.lastError }, o2: { pAt: o2.processedAt, last: o2.lastError }, v: { pAt1: v1.processedAt, pAt2: v2.processedAt, assoc: v2.associationError, last: v2.lastError } });
  assert.equal(o1.associationError, 'superseded_by_provider_state'); assert.ok(o1.lastError.includes(String(v1._id))); assert.ok(!o1.lastError.includes(String(orig._id)));
  assert.equal(ms(o2.processedAt), ms(o1.processedAt)); assert.equal(ms(v2.processedAt), ms(v1.processedAt));
  assert.equal(o2.status, 'PENDING'); assert.equal(o2.paymentLinkId, ''); assert.notEqual(v2.associationError, 'superseded_by_provider_state'); assert.equal(v2.lastError, '');
});

test('F12 NR-02: rama del webhook (PENDING firmado, GET APPROVED): original sustituido conserva su primera fecha ante reenvíos y reconsultas', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'PENDING' }); pub({ ...tx, status: 'APPROVED' });
  assert.equal((await f.postEvent(tx)).status, 200); const o1 = await receipt(tx, 'PENDING');
  await new Promise((res) => setTimeout(res, 15));
  const rep = [(await f.postEvent(tx)).status, (await reconcile(order, tx.id)).status, (await reprocess(o1)).status];
  const o2 = await ev(o1._id);
  obs('F12', { rep, o1: { pAt: o1.processedAt, assoc: o1.associationError }, o2: { pAt: o2.processedAt, assoc: o2.associationError, last: o2.lastError } });
  assert.equal(o1.associationError, 'superseded_by_provider_state'); assert.equal(ms(o2.processedAt), ms(o1.processedAt));
  assert.ok(!(o2.lastError || '').includes(String(o1._id)), 'referencia circular');
});

test('F13 NR-02: moneda alterada (C08c) conserva provider_binding_mismatch, apunta al recibo verificado y no se reescribe al repetir', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  await f.postEvent(tx, { mutate: (e) => { e.data.transaction.currency = 'USD'; } }); const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id, currency: 'USD' }).lean();
  assert.equal((await reprocess(r)).status, 200); const r1 = await ev(r._id); await new Promise((res) => setTimeout(res, 15));
  const rep = (await reprocess(r)).status; const r2 = await ev(r._id);
  obs('F13', { rep, r1: { assoc: r1.associationError, last: r1.lastError, pAt: r1.processedAt }, r2: { pAt: r2.processedAt, cur: r2.currency } });
  assert.equal(r1.associationError, 'provider_binding_mismatch'); assert.ok(/Sustituido por recibo/.test(r1.lastError)); assert.ok(!r1.lastError.includes(String(r._id)));
  assert.equal(ms(r2.processedAt), ms(r1.processedAt)); assert.equal(r2.currency, 'USD'); assert.equal(r2.associationError, 'provider_binding_mismatch');
});

// ======================= NR-03 =======================
test('F20 NR-03 permisos: anónimo 401, vendedor/cliente 403 en archivar y reabrir; superadmin puede', async () => {
  const c = await contradiction('state'); const body = { reason: REASON, evidenceReceiptId: String(c.proof._id) };
  const st = { anon: (await f.api('POST', `/api/admin/orders/payment-events/${c.r._id}/archive`, { body })).status, vend: (await archive(c.r, body, f.cookies.vendor)).status,
    cli: (await archive(c.r, body, f.cookies.client)).status, vendReopen: (await reopen(c.r, { reason: 'x' }, f.cookies.vendor)).status };
  const after = await ev(c.r._id); const sup = (await archive(c.r, body, superCookie)).status;
  obs('F20', { st, archivadoTrasIntentos: !!after.administrativeArchive?.active, sup });
  assert.equal(st.anon, 401); assert.equal(st.vend, 403); assert.equal(st.cli, 403); assert.equal(st.vendReopen, 403);
  assert.ok(!after.administrativeArchive?.active); assert.equal(sup, 200);
});

test('F21 NR-03 validación: sin cuerpo, motivo vacío/espacios/>1000, sin evidencia o ID inválido -> 400 sin escribir nada', async () => {
  const c = await contradiction('amount'); const id = String(c.proof._id);
  const bodies = [undefined, {}, { evidenceReceiptId: id }, { reason: '   ', evidenceReceiptId: id }, { reason: 'x'.repeat(1001), evidenceReceiptId: id }, { reason: REASON }, { reason: REASON, evidenceReceiptId: 'no-es-id' }, { reason: REASON, evidenceReceiptId: { $ne: null } }, { reason: { $gt: '' }, evidenceReceiptId: id }];
  const st = []; for (const b of bodies) st.push((await archive(c.r, b)).status);
  const reopenSin = (await reopen(c.r, {})).status;
  obs('F21', { st, reopenSin, auditorias: await audits({ entityId: c.r._id }) });
  assert.ok(st.every((s) => s === 400), JSON.stringify(st)); assert.equal(reopenSin, 400);
  assert.ok(!(await ev(c.r._id)).administrativeArchive?.active); assert.equal(await audits({ entityId: c.r._id }), 0);
});

test('F22 NR-03: archivar un pago sin conciliación (sin recibo autenticado procesado) -> 409 y sigue en la bandeja', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents - 100 });
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const otro = await contradiction('state');
  const st = [(await archive(r, { reason: REASON, evidenceReceiptId: String(r._id) })).status, (await archive(r, { reason: REASON, evidenceReceiptId: String(otro.proof._id) })).status];
  obs('F22', { st, enBandeja: (await view()).events.some((e) => e._id === String(r._id)) });
  assert.ok(st.every((s) => s === 409)); assert.ok((await view()).events.some((e) => e._id === String(r._id)));
});

test('F23 NR-03: un APPROVED firmado (posible cobro perdido) nunca se puede archivar, aunque exista recibo DECLINED autenticado', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'DECLINED' });
  assert.equal((await f.postEvent(tx)).status, 503); const r = await receipt(tx, 'APPROVED');
  const rc = await reconcile(order, tx.id); const proof = await f.M.PaymentEvent.findOne({ transactionId: tx.id, status: 'DECLINED', processedAt: { $ne: null } }).lean();
  const st = (await archive(r, { reason: REASON, evidenceReceiptId: String(proof?._id) })).status;
  const lag = f.linkTx((await f.newWompi()).order); // APPROVED firmado con GET PENDING
  pub({ ...lag, status: 'PENDING' }); await f.postEvent(lag); const rl = await receipt(lag);
  const st2 = (await archive(rl, { reason: REASON, evidenceReceiptId: String(proof?._id) })).status;
  obs('F23', { rc: rc.status, proof: !!proof, st, st2, enBandeja: (await view()).events.filter((e) => [String(r._id), String(rl._id)].includes(e._id)).length });
  assert.equal(st, 409); assert.equal(st2, 409); assert.equal((await view()).events.filter((e) => [String(r._id), String(rl._id)].includes(e._id)).length, 2);
});

test('F24 NR-03: evento de otro pedido o evidencia de otra transacción -> 409', async () => {
  const a = await contradiction('state'), b = await contradiction('amount');
  const cruzada = (await archive(a.r, { reason: REASON, evidenceReceiptId: String(b.proof._id) })).status;
  await f.M.PaymentEvent.updateOne({ _id: a.r._id }, { $set: { order: b.order._id } }); // manipulación deliberada del arnés
  const otroPedido = (await archive(a.r, { reason: REASON, evidenceReceiptId: String(a.proof._id) })).status;
  await f.M.PaymentEvent.updateOne({ _id: a.r._id }, { $set: { order: null } });
  obs('F24', { cruzada, otroPedido });
  assert.equal(cruzada, 409); assert.equal(otroPedido, 409); assert.ok(!(await ev(a.r._id)).administrativeArchive?.active);
});

test('F25 NR-03: el archivo no confirma pago, no desbloquea, no cambia importes, stock, cupones, avisos ni evidencia', async () => {
  for (const kind of ['state', 'amount']) {
    const c = await contradiction(kind); const before = { order: strip(await f.fresh(c.order._id)), ev: strip(await ev(c.r._id)), notif: await count({}), stock: await f.stockOf(c.p) };
    const st = (await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) })).status;
    const after = { order: strip(await f.fresh(c.order._id)), ev: strip(await ev(c.r._id)), notif: await count({}), stock: await f.stockOf(c.p) };
    const { administrativeArchive, updatedAt, __v, ...evRest } = after.ev; const { administrativeArchive: _a, updatedAt: _u, __v: _v, ...evBefore } = before.ev;
    obs(`F25-${kind}`, { st, orderIgual: JSON.stringify(before.order) === JSON.stringify(after.order), evIgual: JSON.stringify(evBefore) === JSON.stringify(evRest), archivo: administrativeArchive, notif: [before.notif, after.notif] });
    assert.equal(st, 200); assert.deepEqual(after.order, before.order); assert.deepEqual(evRest, evBefore); assert.equal(after.notif, before.notif); assert.equal(after.stock, before.stock);
    assert.equal(after.ev.processedAt, null); assert.equal(administrativeArchive.active, true); assert.equal(administrativeArchive.financialFollowUp, true);
    assert.equal(String(administrativeArchive.actor), String(f.users.admin._id)); assert.equal(administrativeArchive.reason, REASON);
  }
});

test('F26 NR-03: archivo repetido y concurrente es una sola decisión; cambiar motivo exige reabrir', async () => {
  const c = await contradiction('state'); const body = { reason: REASON, evidenceReceiptId: String(c.proof._id) };
  const st = (await Promise.all([archive(c.r, body), archive(c.r, body), archive(c.r, body), archive(c.r, { ...body, reason: 'Otro motivo concurrente' })])).map((r) => r.status);
  const again = (await archive(c.r, body)).status; const distinto = (await archive(c.r, { ...body, reason: 'Motivo distinto' })).status;
  const logs = await audits({ entityId: c.r._id, action: 'payment_event_archived' });
  obs('F26', { st, again, distinto, logs, motivo: (await ev(c.r._id)).administrativeArchive.reason });
  assert.ok(st.filter((s) => s === 200).length >= 1); assert.ok(st.every((s) => [200, 409].includes(s))); assert.equal(logs, 1);
  assert.ok([200, 409].includes(again)); assert.equal(distinto, 409);
});

test('F27 NR-03: archivar y luego recibir el webhook de nuevo y un VOIDED nuevo: sin efecto indebido; el VOIDED se procesa y queda visible', async () => {
  const c = await contradiction('state');
  assert.equal((await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) })).status, 200);
  const re = (await f.postEvent(c.tx)).status; const r2 = await ev(c.r._id); const o = await f.fresh(c.order._id);
  pub({ ...c.tx, status: 'VOIDED' }); const v = (await f.postEvent({ ...c.tx, status: 'VOIDED' })).status; const o2 = await f.fresh(c.order._id);
  const fu = await view('financial-follow-up');
  obs('F27', { re, archivo: r2.administrativeArchive?.active, pAt: r2.processedAt, pago: o.paymentStatus, v, pagoTrasVoid: o2.paymentStatus, abiertas: open(o2).map((i) => i.code), seguimiento: fu.events.some((e) => e._id === String(c.r._id)) });
  assert.notEqual(re, 200); assert.equal(r2.processedAt, null); assert.equal(r2.administrativeArchive.active, true); assert.equal(o.paymentStatus, 'pagado');
  assert.equal(v, 200); assert.equal(o2.paymentStatus, 'rechazado'); assert.ok(open(o2).some((i) => i.code === 'payment_voided'));
  assert.ok(fu.events.some((e) => e._id === String(c.r._id)));
});

test('F28 NR-03: reprocesar archivado -> 409; reabrir (auditado) lo devuelve a la bandeja y el reproceso vuelve a consultar sin cerrar en falso', async () => {
  const c = await contradiction('amount'); await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) });
  const rp = (await reprocess(c.r)).status; const ro = (await reopen(c.r, { reason: 'Nueva evidencia del proveedor' })).status;
  const ro2 = (await reopen(c.r, { reason: 'Repetida' })).status;
  const enBandeja = (await view()).events.some((e) => e._id === String(c.r._id)); const rp2 = (await reprocess(c.r)).status; const r = await ev(c.r._id);
  const logs = await audits({ entityId: c.r._id, action: 'payment_event_reopened' });
  obs('F28', { rp, ro, ro2, enBandeja, rp2, pAt: r.processedAt, logs, archivo: r.administrativeArchive });
  assert.equal(rp, 409); assert.equal(ro, 200); assert.equal(ro2, 200); assert.equal(logs, 1); assert.ok(enBandeja);
  assert.equal(rp2, 503); assert.equal(r.processedAt, null); assert.equal(r.administrativeArchive.active, false); assert.ok(r.administrativeArchive.reopenedAt);
});

test('F29 NR-03: fallo real de Mongo al insertar AuditLog -> ni archivo ni auditoría; el reintento registra una decisión', async () => {
  const c = await contradiction('state');
  await f.failpoint({ times: 1 }, { failCommands: ['insert'], errorCode: 2 });
  let st; try { st = (await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) })).status; } finally { await f.failpoint('off'); }
  const mid = await ev(c.r._id); const logsMid = await audits({ entityId: c.r._id });
  const st2 = (await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) })).status;
  obs('F29', { st, archivoTrasFallo: !!mid.administrativeArchive?.active, logsMid, st2, logs: await audits({ entityId: c.r._id, action: 'payment_event_archived' }) });
  assert.ok(st >= 500); assert.ok(!mid.administrativeArchive?.active); assert.equal(logsMid, 0);
  assert.equal(st2, 200); assert.equal(await audits({ entityId: c.r._id, action: 'payment_event_archived' }), 1);
});

test('F30 NR-03: AuditLog completo (actor, rol, motivo, evidencia, estado previo) en archivo y reapertura', async () => {
  const c = await contradiction('state'); await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) }, superCookie);
  await reopen(c.r, { reason: 'Revisión adicional' });
  const AuditLog = src('models/AuditLog'); const a = await AuditLog.findOne({ entityId: c.r._id, action: 'payment_event_archived' }).lean(); const r = await AuditLog.findOne({ entityId: c.r._id, action: 'payment_event_reopened' }).lean();
  obs('F30', { a: { role: a?.role, reason: a?.newData?.reason, ev: String(a?.newData?.evidenceReceipt), type: a?.entityType }, r: { role: r?.role, prevActive: r?.previousData?.active, reopenReason: r?.newData?.reopenReason } });
  assert.equal(a.role, 'superadmin'); assert.ok(a.userId); assert.equal(a.newData.reason, REASON); assert.equal(String(a.newData.evidenceReceipt), String(c.proof._id)); assert.equal(a.entityType, 'payment_event');
  assert.equal(r.role, 'admin'); assert.equal(r.previousData.active, true); assert.equal(r.newData.reopenReason, 'Revisión adicional'); assert.equal(r.newData.active, false);
});

test('F31 NR-03: el archivo no oculta: sale de la bandeja principal pero queda en seguimiento financiero y en el total de alertas', async () => {
  const before = await alerts(); const c = await contradiction('amount');
  const mid = await alerts(); await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) }); const after = await alerts();
  obs('F31', { total: [before.totalCount, mid.totalCount, after.totalCount], pend: [before.alerts.paymentEvents.count, mid.alerts.paymentEvents.count, after.alerts.paymentEvents.count], seg: [before.alerts.financialFollowUp.count, mid.alerts.financialFollowUp.count, after.alerts.financialFollowUp.count] });
  assert.equal(after.alerts.paymentEvents.count, mid.alerts.paymentEvents.count - 1); assert.equal(after.alerts.financialFollowUp.count, mid.alerts.financialFollowUp.count + 1);
  assert.ok(after.alerts.financialFollowUp.items.some((e) => e._id === String(c.r._id)));
});

test('F32 NR-03 (impacto original): tras conciliar y archivar una contradicción ya resuelta, ¿puede el total de alertas volver a su valor previo?', async () => {
  // Solo los grupos de eventos de pago: crear un pedido también suma en otros grupos (p. ej. pedidos nuevos).
  const pay = (a) => a.alerts.paymentEvents.count + a.alerts.financialFollowUp.count;
  const before = pay(await alerts()); const c = await contradiction('state');
  await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) }); const after = pay(await alerts());
  const o = await f.fresh(c.order._id);
  obs('F32', { pagoAntes: before, pagoDespues: after, pedido: { pago: o.paymentStatus, abiertas: open(o).length, preparable: (await f.canPrepare(c.order._id)).status } });
  assert.equal(after, before, 'El archivo traslada el evento a "seguimiento financiero", que cuenta en el total sin acción de cierre: el contador no vuelve a su valor previo');
});

test('F33 NR-03: evidencia inválida: el propio evento, un recibo no procesado o de otro ambiente -> 409', async () => {
  const c = await contradiction('state');
  const pendiente = await f.M.PaymentEvent.create({ key: 'np-' + Date.now(), transactionId: c.tx.id, status: 'APPROVED', amountInCents: c.tx.amount_in_cents, currency: 'COP', environment: 'test', source: 'provider_query', processingState: 'associated', order: c.order._id, paymentLinkId: c.order.wompi.paymentLinkId });
  const prod = await f.M.PaymentEvent.create({ key: 'pr-' + Date.now(), transactionId: c.tx.id, status: 'APPROVED', amountInCents: c.tx.amount_in_cents, currency: 'COP', environment: 'prod', source: 'provider_query', processingState: 'processed', processedAt: new Date(), order: c.order._id, paymentLinkId: c.order.wompi.paymentLinkId });
  const st = []; for (const id of [c.r._id, pendiente._id, prod._id]) st.push((await archive(c.r, { reason: REASON, evidenceReceiptId: String(id) })).status);
  obs('F33', { st }); assert.ok(st.every((s) => s === 409)); assert.ok(!(await ev(c.r._id)).administrativeArchive?.active);
});

test('F34 NR-03: la vista "verified" y los listados no aceptan inyección ni exponen datos de otro ambiente', async () => {
  const st = [(await f.api('GET', '/api/admin/orders/payment-events?view=verified', { cookie: f.cookies.admin })).status,
    (await f.api('GET', '/api/admin/orders/payment-events?view=verified&transactionId[$ne]=x', { cookie: f.cookies.admin })).status,
    (await f.api('GET', '/api/admin/orders/payment-events?view=otra', { cookie: f.cookies.admin })).status,
    (await f.api('GET', '/api/admin/orders/payment-events?view=financial-follow-up', { cookie: f.cookies.vendor })).status];
  obs('F34', { st }); assert.deepEqual(st, [400, 400, 400, 403]);
});

test('F35 NR-03: un pago sin asociación confiable (sin vínculo) no puede archivarse aunque tenga observación terminal', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'DECLINED', payment_link_id: null }); pub({ ...tx, status: 'APPROVED' });
  await f.postEvent(tx); const r = await receipt(tx, 'DECLINED');
  await f.M.PaymentEvent.updateOne({ _id: r._id }, { $set: { providerObservation: { status: 'APPROVED', paymentLinkId: '', amountInCents: tx.amount_in_cents, currency: 'COP', checkedAt: new Date() } } }); // observación forzada
  const st = (await archive(r, { reason: REASON, evidenceReceiptId: String(r._id) })).status;
  obs('F35', { st, enBandeja: (await view()).events.some((e) => e._id === String(r._id)) });
  assert.equal(st, 409); assert.ok((await view()).events.some((e) => e._id === String(r._id)));
});
