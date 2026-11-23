// Segunda auditoría independiente (Claude, 2026-11-23): pruebas adversariales D01–D24
// sobre las rutas modificadas por la segunda remediación (NV-01, NV-02, NV-03).
// Cada aserción expresa el comportamiento SEGURO esperado: un FAIL es un defecto demostrado.
// El proveedor simulado NO copia el evento: cada prueba fija qué responde GET /v1/transactions/{id}.
// AUD_ROOT = raíz del árbol probado (exportación aislada de 23ce3a6 o el repositorio).
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const ROOT = path.resolve(process.env.AUD_ROOT || path.resolve(__dirname, '../../../..'));
const f = require(path.join(ROOT, 'docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs'));
const src = (p) => require(path.join(ROOT, 'backend/src', p));
const obs = (id, data) => console.log(`OBS ${id} ${JSON.stringify(data)}`);
const pub = (tx) => f.provider.tx.set(tx.id, { ...tx });
const reconcile = (o, id, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie, body: id === undefined ? {} : { transactionId: id } });
const reprocess = (r, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie });
const inbox = async () => (await f.api('GET', '/api/admin/orders/payment-events', { cookie: f.cookies.admin })).json.events;
const receipt = (tx, status = tx.status) => f.M.PaymentEvent.findOne({ transactionId: tx.id, status }).lean();
const open = (o) => o.incidents.filter((i) => !i.resolvedAt);
const count = (q) => f.M.Notification.countDocuments(q);
const txCalls = () => f.provider.calls.filter((c) => c.path.startsWith('/v1/transactions/')).length;
const finance = async (id) => f.M.Order.countDocuments({ ...src('services/financeCriteria').reconciledSalesFilter(), _id: id });

// Inyecta una respuesta HTTP o un fallo de transporte SOLO para un ID de transacción.
async function providerFault(id, kind, work) {
  const prev = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.pathname === `/v1/transactions/${encodeURIComponent(id)}`) {
      if (kind === 'timeout') throw Object.assign(new Error('timeout ficticio'), { name: 'TimeoutError' });
      if (kind === 'abort') throw Object.assign(new Error('abort ficticio'), { name: 'AbortError' });
      if (kind === 'network') throw new TypeError('fetch failed (ficticio)');
      if (kind === 'nojson') return new Response('<html>no json</html>', { status: 200 });
      if (kind === 'otherid') return new Response(JSON.stringify({ data: { id: id + '-otro', status: 'APPROVED' } }), { status: 200 });
      return new Response(JSON.stringify({ error: { type: 'FICTICIO' } }), { status: kind });
    }
    return prev(input, init);
  };
  try { return await work(); } finally { globalThis.fetch = prev; }
}

let superCookie;
test.before(async () => {
  await f.setup();
  await f.M.User.create({ name: 'U super2', email: 'super2-aud@example.test', password: 'AuditoriaPrueba123!', role: 'superadmin' });
  superCookie = await f.login('super2-aud@example.test', 'AuditoriaPrueba123!');
});
test.after(async () => { await f.close(); });

// ======================= NV-01 =======================
test('D01 NV-01: APPROVED firmado vs GET PENDING x3 concurrente -> 503, durable, visible, 1 alerta; GET actualizado -> aplica una vez', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  const st = (await Promise.all([1, 2, 3].map(() => f.postEvent(tx)))).map((r) => r.status);
  const r1 = await receipt(tx); const o1 = await f.fresh(order._id);
  const enBandeja = (await inbox()).some((e) => e._id === String(r1._id));
  const alerts = (await f.api('GET', '/api/admin/alerts', { cookie: f.cookies.admin })).json.alerts.paymentEvents.items.some((e) => e.transactionId === tx.id);
  const avisos1 = await count({ paymentEvent: r1._id });
  const retryLag = (await f.postEvent(tx)).status; const avisos2 = await count({ paymentEvent: r1._id });
  pub(tx); const ok = (await f.postEvent(tx)).status; const again = (await f.postEvent(tx)).status;
  const r2 = await receipt(tx); const o2 = await f.fresh(order._id);
  obs('D01', { st, r1: { state: r1.processingState, processedAt: r1.processedAt, obs: r1.providerObservation?.status, lastError: r1.lastError }, enBandeja, alerts, avisos1, retryLag, avisos2, ok, again,
    r2: { state: r2.processingState, lastError: r2.lastError, assoc: r2.associationError }, pago: o2.paymentStatus, stock: await f.stockOf(p) });
  assert.deepEqual(st, [503, 503, 503]); assert.equal(r1.processingState, 'failed'); assert.equal(r1.processedAt, null);
  assert.equal(r1.providerObservation.status, 'PENDING'); assert.ok(r1.lastError); assert.ok(enBandeja); assert.ok(alerts);
  assert.equal(o1.paymentStatus, 'pendiente'); assert.equal(o1.stockDeducted, false);
  assert.equal(avisos1, 1); assert.equal(retryLag, 503); assert.equal(avisos2, 1);
  assert.equal(ok, 200); assert.equal(again, 200); assert.equal(o2.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.equal(r2.processingState, 'processed'); assert.ok(r2.processedAt); assert.equal(r2.lastError, '');
  assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
});

for (const lag of ['DECLINED', 'ERROR']) test(`D02-${lag} NV-01: APPROVED firmado vs GET ${lag} no degrada el pedido ni marca procesado`, async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: lag });
  const st = (await f.postEvent(tx)).status; const r = await receipt(tx); const o = await f.fresh(order._id);
  obs(`D02-${lag}`, { st, state: r.processingState, processedAt: r.processedAt, pago: o.paymentStatus, wompi: o.wompi.status, notifDeclined: await count({ order: order._id, event: 'payment.declined' }) });
  assert.equal(st, 503); assert.equal(r.processedAt, null); assert.equal(r.processingState, 'failed');
  assert.equal(o.paymentStatus, 'pendiente'); assert.notEqual(o.wompi.status, lag);
  assert.equal(await count({ order: order._id, event: 'payment.declined' }), 0); assert.equal(await f.stockOf(p), 5);
  pub(tx); assert.equal((await f.postEvent(tx)).status, 200); assert.equal((await f.fresh(order._id)).paymentStatus, 'pagado');
});

test('D03 NV-01: DECLINED firmado vs GET PENDING (rezagado) -> 503 sin efecto; GET DECLINED -> rechazado una vez', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'PENDING' });
  const st = (await f.postEvent(tx)).status; const o = await f.fresh(order._id); const r = await receipt(tx);
  pub(tx); const st2 = (await f.postEvent(tx)).status; const o2 = await f.fresh(order._id);
  obs('D03', { st, pago: o.paymentStatus, state: r.processingState, st2, pago2: o2.paymentStatus, declined: await count({ order: order._id, event: 'payment.declined' }) });
  assert.equal(st, 503); assert.equal(o.paymentStatus, 'pendiente'); assert.equal(r.processedAt, null);
  assert.equal(st2, 200); assert.equal(o2.paymentStatus, 'rechazado'); assert.equal(await count({ order: order._id, event: 'payment.declined' }), 1);
});

test('D04 NV-01: DECLINED firmado vs GET APPROVED (no es progresión) -> 503; la conciliación autenticada aplica el cobro una sola vez', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'APPROVED' });
  const st = (await f.postEvent(tx)).status; const o = await f.fresh(order._id);
  const rc = await reconcile(order, tx.id); const rc2 = await reconcile(order, tx.id); const o2 = await f.fresh(order._id);
  obs('D04', { st, pagoTrasWebhook: o.paymentStatus, rc: rc.status, rc2: rc2.status, pago: o2.paymentStatus, stock: await f.stockOf(p) });
  assert.equal(st, 503); assert.equal(o.paymentStatus, 'pendiente');
  assert.equal(rc.status, 200); assert.equal(rc2.status, 200); assert.equal(o2.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
});

test('D04b NV-03/bandeja: tras conciliar el cobro, el recibo DECLINED contradictorio tiene alguna vía auditada de cierre', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'APPROVED' });
  await f.postEvent(tx); await reconcile(order, tx.id);
  const r = await receipt(tx, 'DECLINED'); const rp = await reprocess(r); const r2 = await receipt(tx, 'DECLINED');
  const quedan = (await inbox()).filter((e) => e._id === String(r._id));
  obs('D04b', { pago: (await f.fresh(order._id)).paymentStatus, reprocesar: rp.status, state: r2.processingState, lastError: r2.lastError, quedanEnBandeja: quedan.length });
  assert.equal(quedan.length, 0, 'Recibo contradictorio permanece en la bandeja y en el contador de alertas sin ninguna acción de cierre auditada');
});

test('D05 NV-01/WP-04: VOIDED firmado vs GET APPROVED (rezagado) sobre pedido pagado -> anulación prevalece', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  const st = (await f.postEvent({ ...tx, status: 'VOIDED' })).status; const o = await f.fresh(order._id);
  obs('D05', { st, pago: o.paymentStatus, wompi: o.wompi.status, abiertas: open(o).map((i) => i.code), finanzas: await finance(order._id) });
  assert.equal(st, 200); assert.equal(o.paymentStatus, 'rechazado'); assert.equal(o.wompi.status, 'VOIDED');
  assert.equal(await finance(order._id), 0); assert.equal((await f.canPrepare(order._id)).status, 409); assert.equal(await f.stockOf(p), 4);
});

test('D06 NV-01/WP-04: VOIDED llega antes; APPROVED tardío con GET VOIDED no rehabilita ni descuenta stock', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'VOIDED' });
  const v = (await f.postEvent({ ...tx, status: 'VOIDED' })).status;
  const a = (await f.postEvent(tx)).status; const a2 = (await f.postEvent(tx)).status; const o = await f.fresh(order._id);
  const rA = await receipt(tx, 'APPROVED');
  obs('D06', { v, a, a2, pago: o.paymentStatus, wompi: o.wompi.status, abiertas: open(o).map((i) => `${i.code}:${i.detail}`), rA: { state: rA?.processingState, err: rA?.associationError }, stock: await f.stockOf(p) });
  assert.equal(o.paymentStatus, 'rechazado'); assert.equal(o.stockDeducted, false); assert.equal(await f.stockOf(p), 5);
  assert.equal(await count({ order: order._id, event: 'payment.approved' }), 0);
  assert.equal(open(o).filter((i) => i.code === 'payment_voided').length, 1);
  assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('D07 NV-01: fallo de Mongo al persistir la discrepancia (update del recibo) -> nunca 200 ni processedAt; reintento deja failed y 1 alerta', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  await f.failpoint({ skip: 1 }, { failCommands: ['update'], errorCode: 2 });
  let st; try { st = (await f.postEvent(tx)).status; } finally { await f.failpoint('off'); }
  const r = await receipt(tx); const st2 = (await f.postEvent(tx)).status; const r2 = await receipt(tx);
  obs('D07', { st, r: { state: r?.processingState, processedAt: r?.processedAt }, st2, r2: { state: r2.processingState, obs: r2.providerObservation?.status }, avisos: await count({ paymentEvent: r2._id }) });
  assert.notEqual(st, 200); assert.ok(r); assert.equal(r.processedAt, null); assert.equal((await f.fresh(order._id)).paymentStatus, 'pendiente');
  assert.equal(st2, 503); assert.equal(r2.processingState, 'failed'); assert.equal(r2.processedAt, null); assert.equal(await count({ paymentEvent: r2._id }), 1);
  assert.ok((await inbox()).some((e) => e._id === String(r2._id)));
});

test('D08 NV-01 concurrencia: 3 webhooks + 2 conciliaciones + 1 reproceso simultáneos tras actualizar GET -> un solo efecto', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  assert.equal((await f.postEvent(tx)).status, 503); const r = await receipt(tx); pub(tx);
  const st = (await Promise.all([f.postEvent(tx), f.postEvent(tx), f.postEvent(tx), reconcile(order, tx.id), reconcile(order, tx.id), reprocess(r)])).map((x) => x.status);
  const o = await f.fresh(order._id); const r2 = await receipt(tx);
  obs('D08', { st, pago: o.paymentStatus, stock: await f.stockOf(p), approved: await count({ order: order._id, event: 'payment.approved' }), state: r2.processingState, recibos: await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), history: o.statusHistory.filter((h) => /APPROVED verificado/.test(h.note)).length });
  assert.ok(st.every((s) => s < 500 || s === 503), 'Ningún 500 inesperado'); assert.equal(o.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1); assert.equal(r2.processingState, 'processed'); assert.ok(r2.processedAt);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
  if (st.some((s) => s !== 200)) { // un reintento posterior debe converger
    assert.equal((await f.postEvent(tx)).status, 200); assert.equal(await f.stockOf(p), 4);
  }
});

// ======================= NV-02 =======================
test('D09 NV-02: formatos inválidos -> 409, sin incidencia, sin historial y sin llamada al proveedor', async () => {
  const { order } = await f.newWompi(); const before = await f.fresh(order._id); const calls = txCalls();
  const bad = ['', ' ', 'a/b', '../x', 'x'.repeat(151), 'ñandú', 'id con espacio', {}, [], 123, null, true];
  const st = []; for (const id of bad) st.push((await reconcile(order, id)).status);
  const sinCampo = (await reconcile(order)).status; const after = await f.fresh(order._id);
  obs('D09', { st, sinCampo, llamadas: txCalls() - calls, incidencias: after.incidents.length, historial: after.statusHistory.length - before.statusHistory.length });
  assert.ok(st.every((s) => s === 409)); assert.equal(sinCampo, 409); assert.equal(txCalls() - calls, 0);
  assert.deepEqual(after.incidents, before.incidents); assert.equal(after.statusHistory.length, before.statusHistory.length); assert.equal(after.requiresReview, false);
});

test('D10 NV-02: 404 del proveedor -> 409 controlado, sin incidencia permanente; luego el ID correcto concilia', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const nf = await reconcile(order, tx.id + 'x'); const o = await f.fresh(order._id);
  const ok = await reconcile(order, tx.id); const o2 = await f.fresh(order._id);
  obs('D10', { nf: nf.status, msg: nf.json?.message, incidencias: o.incidents.length, ok: ok.status, pago: o2.paymentStatus });
  assert.equal(nf.status, 409); assert.equal(o.incidents.length, 0); assert.equal(o.requiresReview, false);
  assert.equal(ok.status, 200); assert.equal(o2.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('D11 NV-02: 401/403/429/500/502/503, timeout, abort, red, JSON inválido e identidad ajena -> 503 con incidencia trazada; nunca 409', async () => {
  const kinds = [401, 403, 429, 500, 502, 503, 'timeout', 'abort', 'network', 'nojson', 'otherid']; const out = [];
  for (const kind of kinds) {
    const { order } = await f.newWompi(); const id = `falla-${kind}-${Date.now()}`;
    const r = await providerFault(id, kind, () => reconcile(order, id)); const r2 = await providerFault(id, kind, () => reconcile(order, id));
    const o = await f.fresh(order._id); const inc = open(o).filter((i) => i.code === 'reconciliation_query_failed');
    const hist = o.statusHistory.filter((h) => /Consulta Wompi fallida/.test(h.note));
    out.push({ kind, st: r.status, st2: r2.status, inc: inc.length, detalle: inc[0]?.detail === id, hist: hist.length, nota: hist[0]?.note, fuga: r.text.includes(process.env.WOMPI_PRIVATE_KEY) || r.text.includes('Bearer') });
  }
  obs('D11', out);
  for (const x of out) { assert.equal(x.st, 503, x.kind); assert.equal(x.st2, 503); assert.equal(x.inc, 1); assert.ok(x.detalle); assert.equal(x.hist, 1); assert.equal(x.fuga, false); }
});

test('D12 NV-02: dos fallos con IDs distintos y conciliación con el ID real -> cierre completo, auditable y desbloqueo', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  await providerFault('pista-a', 500, () => reconcile(order, 'pista-a')); await providerFault('pista-b', 'timeout', () => reconcile(order, 'pista-b'));
  const before = await f.fresh(order._id); const ok = await reconcile(order, tx.id); const o = await f.fresh(order._id);
  const AuditLog = src('models/AuditLog'); const logs = await AuditLog.find({ entityId: order._id, action: 'wompi_query_failures_resolved' }).lean();
  obs('D12', { ok: ok.status, abiertas: open(o).map((i) => i.code), res: o.incidents.map((i) => ({ d: i.detail, dec: i.resolution?.decision, ev: i.resolution?.evidence?.transactionId })), logs: logs.length, prev: logs[0]?.previousData });
  assert.equal(ok.status, 200); assert.equal(open(o).length, 0); assert.equal(o.incidents.length, 2);
  for (const [i, inc] of o.incidents.entries()) {
    assert.equal(inc.detail, before.incidents[i].detail); assert.equal(String(inc.createdAt), String(before.incidents[i].createdAt));
    assert.equal(inc.resolution.decision, 'reconciled_with_provider'); assert.equal(inc.resolution.evidence.transactionId, tx.id);
    assert.equal(String(inc.resolution.actor), String(f.users.admin._id));
  }
  assert.equal(logs.length, 1); assert.equal(logs[0].previousData.incidents.length, 2); assert.equal(logs[0].newData.transactionId, tx.id);
  assert.equal(o.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4); assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('D13 NV-02: pedido pagado + fallo transitorio + conciliación con un intento DECLINED del mismo enlace -> no queda bloqueado sin incidencia', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); assert.equal((await f.postEvent(tx)).status, 200);
  await providerFault('transitorio', 500, () => reconcile(order, 'transitorio'));
  const declined = f.linkTx(order, { status: 'DECLINED' }); pub(declined);
  const rc = await reconcile(order, declined.id); const o = await f.fresh(order._id);
  const prep = await f.canPrepare(order._id);
  const salida = prep.status === 200 ? null : (await reconcile(order)).status; // reconciliar sin ID usa wompi.transactionId
  const prep2 = prep.status === 200 ? null : (await f.canPrepare(order._id)).status;
  obs('D13', { rc: rc.status, pago: o.paymentStatus, requiresReview: o.requiresReview, abiertas: open(o).map((i) => i.code), preparar: prep.status, salidaSinId: salida, prepararTrasSalida: prep2, stock: await f.stockOf(p) });
  assert.equal(rc.status, 200); assert.equal(o.paymentStatus, 'pagado'); assert.equal(open(o).length, 0);
  assert.equal(prep.status, 200, 'Pedido pagado, sin incidencias abiertas, queda con requiresReview=true y no se puede preparar');
});

test('D14 NV-02: ID de la compra de otro pedido -> 409, sin incidencias ni pago en ninguno; el dueño real se aplica después', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const tb = f.linkTx(b.order); pub(tb);
  const r = await reconcile(a.order, tb.id); const oa = await f.fresh(a.order._id), ob = await f.fresh(b.order._id);
  const w = (await f.postEvent(tb)).status; const ob2 = await f.fresh(b.order._id);
  obs('D14', { r: r.status, aInc: oa.incidents.map((i) => i.code), aPago: oa.paymentStatus, bPagoAntes: ob.paymentStatus, w, bPago: ob2.paymentStatus });
  assert.equal(r.status, 409); assert.equal(oa.incidents.length, 0); assert.equal(oa.paymentStatus, 'pendiente'); assert.equal(ob.paymentStatus, 'pendiente');
  assert.equal(w, 200); assert.equal(ob2.paymentStatus, 'pagado'); assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente');
});

test('D15 NV-02 permisos: vendedor/cliente/anónimo no concilian, reprocesan, resuelven ni confirman Wompi; admin no confirma Wompi a mano', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  await providerFault('perm', 500, () => reconcile(order, 'perm')); const o = await f.fresh(order._id); const inc = open(o)[0];
  const ev = await f.M.PaymentEvent.create({ key: 'perm-' + Date.now(), transactionId: tx.id, status: 'APPROVED', amountInCents: tx.amount_in_cents, currency: 'COP', environment: 'test', processingState: 'unassociated' });
  const st = {
    vendConcilia: (await reconcile(order, tx.id, f.cookies.vendor)).status, cliConcilia: (await reconcile(order, tx.id, f.cookies.client)).status,
    anonConcilia: (await f.api('POST', `/api/admin/orders/${order._id}/reconcile-wompi`, { body: { transactionId: tx.id } })).status,
    vendReprocesa: (await reprocess(ev, f.cookies.vendor)).status, vendBandeja: (await f.api('GET', '/api/admin/orders/payment-events', { cookie: f.cookies.vendor })).status,
    vendResuelve: (await f.api('POST', `/api/admin/orders/${order._id}/incidents/${inc._id}/resolve`, { cookie: f.cookies.vendor, body: { decision: 'reconciled_with_provider', reason: 'x' } })).status,
    adminResuelveManual: (await f.api('POST', `/api/admin/orders/${order._id}/incidents/${inc._id}/resolve`, { cookie: f.cookies.admin, body: { decision: 'reconciled_with_provider', reason: 'forzar' } })).status,
    vendConfirma: (await f.api('PATCH', `/api/admin/orders/${order._id}/payment`, { cookie: f.cookies.vendor, body: {} })).status,
    adminConfirma: (await f.api('PATCH', `/api/admin/orders/${order._id}/payment`, { cookie: f.cookies.admin, body: { reference: 'x', receivedAt: new Date().toISOString() } })).status,
  };
  const o2 = await f.fresh(order._id);
  obs('D15', { st, pago: o2.paymentStatus, abiertas: open(o2).map((i) => i.code) });
  for (const k of ['vendConcilia', 'cliConcilia', 'anonConcilia', 'vendReprocesa', 'vendBandeja', 'vendResuelve']) assert.ok([401, 403].includes(st[k]), k);
  assert.ok(st.adminResuelveManual >= 400, 'La decisión interna reconciled_with_provider no debe poder forzarse por la API de resolución');
  assert.ok([403, 409].includes(st.vendConfirma)); assert.equal(st.adminConfirma, 409);
  assert.equal(o2.paymentStatus, 'pendiente'); assert.equal(open(o2).filter((i) => i.code === 'reconciliation_query_failed').length, 1);
});

test('D16 NV-02 concurrencia: fallos y éxitos de conciliación simultáneos convergen; un éxito posterior siempre desbloquea', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const prev = globalThis.fetch; let n = 0;
  globalThis.fetch = async (input, init) => { const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.pathname === '/v1/transactions/caida-concurrente') { n++; await new Promise((r) => setTimeout(r, 30)); return new Response('{}', { status: 500 }); } return prev(input, init); };
  let st; try { st = (await Promise.all([reconcile(order, 'caida-concurrente'), reconcile(order, tx.id), reconcile(order, 'caida-concurrente'), reconcile(order, tx.id)])).map((r) => r.status); } finally { globalThis.fetch = prev; }
  const mid = await f.fresh(order._id); const final = await reconcile(order, tx.id); const o = await f.fresh(order._id);
  obs('D16', { st, n, abiertasIntermedias: open(mid).map((i) => i.code), final: final.status, abiertas: open(o).map((i) => i.code), stock: await f.stockOf(p), approved: await count({ order: order._id, event: 'payment.approved' }) });
  assert.ok(st.every((s) => [200, 503].includes(s))); assert.equal(final.status, 200); assert.equal(open(o).length, 0);
  assert.equal(o.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4); assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

// ======================= NV-03 =======================
test('D17 NV-03: reproceso del recibo failed de NV-01 (misma clave) tras actualizar GET -> pagado, fuera de bandeja', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  await f.postEvent(tx); const r = await receipt(tx); pub(tx);
  const rp = await reprocess(r); const r2 = await receipt(tx); const o = await f.fresh(order._id);
  obs('D17', { rp: rp.status, pago: o.paymentStatus, stock: await f.stockOf(p), state: r2.processingState, assoc: r2.associationError, lastError: r2.lastError, mismoRecibo: (r2.lastError || '').includes(String(r._id)) });
  assert.equal(rp.status, 200); assert.equal(o.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.ok(r2.processedAt); assert.equal(r2.processingState, 'processed'); assert.ok(!(await inbox()).some((e) => e._id === String(r._id)));
});

test('D17b NV-03 metadatos: un recibo aplicado por sí mismo no se registra como "sustituido por" sí mismo', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub({ ...tx, status: 'PENDING' });
  await f.postEvent(tx); const r = await receipt(tx); pub(tx); await reprocess(r); const r2 = await receipt(tx);
  obs('D17b', { assoc: r2.associationError, lastError: r2.lastError });
  assert.notEqual(r2.associationError, 'superseded_by_provider_state', 'El recibo se aplicó a sí mismo pero queda etiquetado como sustituido');
  assert.ok(!(r2.lastError || '').includes(`Sustituido por recibo ${r._id}`), 'lastError afirma que el recibo fue sustituido por sí mismo');
});

test('D18 NV-03: reprocesar un recibo ya procesado es idempotente (sin stock, avisos ni metadatos alterados)', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  const r = await receipt(tx); const o = await f.fresh(order._id);
  const rp = await reprocess(r); const r2 = await receipt(tx); const o2 = await f.fresh(order._id);
  obs('D18', { rp: rp.status, antes: { assoc: r.associationError, lastError: r.lastError, processedAt: r.processedAt }, despues: { assoc: r2.associationError, lastError: r2.lastError, processedAt: r2.processedAt },
    historial: o2.statusHistory.length - o.statusHistory.length, stock: await f.stockOf(p), approved: await count({ order: order._id, event: 'payment.approved' }) });
  assert.equal(await f.stockOf(p), 4); assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1);
  assert.equal(String(r2.processedAt), String(r.processedAt));
  assert.equal(r2.associationError, r.associationError, 'Reprocesar un recibo normal lo re-etiqueta como sustituido');
});

test('D19 NV-03: importe firmado distinto del consultado -> sin efecto financiero; reproceso 503 conserva la evidencia', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const w = (await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents - 100 })).status;
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const rp = await reprocess(r); const r2 = await f.M.PaymentEvent.findById(r._id).lean(); const o = await f.fresh(order._id);
  obs('D19', { w, r: { state: r.processingState, err: r.associationError }, rp: rp.status, r2: { state: r2.processingState, err: r2.associationError, processedAt: r2.processedAt, amount: r2.amountInCents }, pago: o.paymentStatus });
  assert.equal(o.paymentStatus, 'pendiente'); assert.equal(await f.stockOf(p), 5);
  assert.equal(rp.status, 503); assert.equal(r2.processedAt, null); assert.equal(r2.associationError, 'provider_binding_mismatch'); assert.equal(r2.amountInCents, tx.amount_in_cents - 100);
});

test('D19b NV-03/bandeja: tras conciliar el pedido con el ID real, el recibo de importe contradictorio tiene vía de cierre auditada', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents - 100 }); const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const rc = await reconcile(order, tx.id); const rp = await reprocess(r);
  const quedan = (await inbox()).filter((e) => e._id === String(r._id));
  obs('D19b', { rc: rc.status, pago: (await f.fresh(order._id)).paymentStatus, rp: rp.status, quedanEnBandeja: quedan.length });
  assert.equal(rc.status, 200);
  assert.equal(quedan.length, 0, 'El recibo contradictorio queda abierto para siempre: no hay decisión de archivo auditada');
});

test('D20 NV-03: fallo de commit de Mongo durante el reproceso -> original no cerrado en falso; reintento cierra sin doble efecto', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order, { status: 'PENDING', payment_link_id: null });
  await f.postEvent(tx); const r = await receipt(tx); pub({ ...tx, status: 'APPROVED', payment_link_id: order.wompi.paymentLinkId });
  await f.failpoint({ skip: 2 }, { failCommands: ['commitTransaction'], errorCode: 2 });
  let st; try { st = (await reprocess(r)).status; } finally { await f.failpoint('off'); }
  const mid = await f.M.PaymentEvent.findById(r._id).lean(); const omid = await f.fresh(order._id); const smid = await f.stockOf(p);
  const st2 = (await reprocess(r)).status; const fin = await f.M.PaymentEvent.findById(r._id).lean();
  obs('D20', { st, original: { processedAt: mid.processedAt, state: mid.processingState }, pagoIntermedio: omid.paymentStatus, stockIntermedio: smid, st2, final: { processedAt: fin.processedAt, state: fin.processingState }, stock: await f.stockOf(p), approved: await count({ order: order._id, event: 'payment.approved' }) });
  if (st !== 200) assert.equal(mid.processedAt, null, 'Respuesta no exitosa pero el recibo original quedó cerrado');
  assert.equal(st2, 200); assert.ok(fin.processedAt); assert.equal(await f.stockOf(p), 4);
  assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1); assert.equal((await f.fresh(order._id)).paymentStatus, 'pagado');
});

test('D21 NV-03: recibo sin vínculo cuya transacción pertenece a otro pedido -> se aplica al dueño real y no toca al otro', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const tb = f.linkTx(b.order, { payment_link_id: null });
  await f.postEvent(tb); const r = await receipt(tb); pub({ ...tb, payment_link_id: b.order.wompi.paymentLinkId });
  const rp = await reprocess(r); const oa = await f.fresh(a.order._id), ob = await f.fresh(b.order._id); const r2 = await f.M.PaymentEvent.findById(r._id).lean();
  obs('D21', { rp: rp.status, a: oa.paymentStatus, b: ob.paymentStatus, original: { processedAt: !!r2.processedAt, order: String(r2.order) === String(b.order._id) } });
  assert.equal(rp.status, 200); assert.equal(oa.paymentStatus, 'pendiente'); assert.equal(oa.incidents.length, 0); assert.equal(ob.paymentStatus, 'pagado'); assert.ok(r2.processedAt);
});

test('D22 NV-03: reproceso con GET caído (500/404/timeout) -> 503 y el recibo original queda intacto en la bandeja', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { payment_link_id: null }); await f.postEvent(tx); const r = await receipt(tx);
  const st = []; for (const k of [500, 404, 'timeout']) st.push((await providerFault(tx.id, k, () => reprocess(r))).status);
  const r2 = await f.M.PaymentEvent.findById(r._id).lean();
  obs('D22', { st, state: r2.processingState, err: r2.associationError, processedAt: r2.processedAt });
  assert.ok(st.every((s) => s === 503)); assert.equal(r2.processedAt, null); assert.equal(r2.associationError, r.associationError); assert.equal(r2.processingState, r.processingState);
  assert.ok((await inbox()).some((e) => e._id === String(r._id)));
});

test('D23 NV-03 concurrencia: 3 reprocesos + 2 webhooks tardíos sobre un recibo sin vínculo -> un solo efecto y cierre', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order, { status: 'PENDING', payment_link_id: null }); await f.postEvent(tx); const r = await receipt(tx);
  const ap = { ...tx, status: 'APPROVED', payment_link_id: order.wompi.paymentLinkId }; pub(ap);
  const st = (await Promise.all([reprocess(r), reprocess(r), reprocess(r), f.postEvent(ap), f.postEvent(ap)])).map((x) => x.status);
  const r2 = await f.M.PaymentEvent.findById(r._id).lean();
  obs('D23', { st, stock: await f.stockOf(p), approved: await count({ order: order._id, event: 'payment.approved' }), original: { processedAt: !!r2.processedAt, state: r2.processingState } });
  assert.equal(await f.stockOf(p), 4); assert.equal(await count({ order: order._id, event: 'payment.approved' }), 1); assert.equal((await f.fresh(order._id)).paymentStatus, 'pagado');
  if (!r2.processedAt) assert.equal((await reprocess(r)).status, 200);
  assert.ok((await f.M.PaymentEvent.findById(r._id).lean()).processedAt);
});

test('D24 NV-03: un evento de otro ambiente no se reprocesa ni se cierra', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order);
  const ev = await f.M.PaymentEvent.create({ key: 'prod-' + Date.now(), transactionId: tx.id, status: 'APPROVED', amountInCents: tx.amount_in_cents, currency: 'COP', environment: 'prod', processingState: 'unassociated' });
  pub(tx); const rp = await reprocess(ev); const ev2 = await f.M.PaymentEvent.findById(ev._id).lean();
  obs('D24', { rp: rp.status, processedAt: ev2.processedAt, pago: (await f.fresh(order._id)).paymentStatus });
  assert.equal(rp.status, 409); assert.equal(ev2.processedAt, null); assert.equal((await f.fresh(order._id)).paymentStatus, 'pendiente');
});
