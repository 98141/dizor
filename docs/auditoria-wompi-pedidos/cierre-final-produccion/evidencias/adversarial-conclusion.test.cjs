// Auditoría final GO/NO-GO (Claude, 2026-11-23): pruebas adversariales G01–G10 sobre la
// operación nueva "concluir seguimiento" (RC-01). Cada aserción expresa el comportamiento SEGURO.
// AUD_ROOT = raíz del árbol probado (copia aislada del árbol de trabajo).
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const ROOT = path.resolve(process.env.AUD_ROOT || path.resolve(__dirname, '../../../..'));
const f = require(path.join(ROOT, 'docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs'));
const src = (p) => require(path.join(ROOT, 'backend/src', p));
const obs = (id, data) => console.log(`OBS ${id} ${JSON.stringify(data)}`);
const pub = (tx) => f.provider.tx.set(tx.id, { ...tx });
const reconcile = (o, id) => f.api('POST', `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie: f.cookies.admin, body: { transactionId: id } });
const archive = (r, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/archive`, { cookie, body });
const conclude = (r, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/conclude-follow-up`, { cookie, body });
const reopen = (r, body) => f.api('POST', `/api/admin/orders/payment-events/${r._id}/reopen`, { cookie: f.cookies.admin, body });
const view = async (v) => (await f.api('GET', `/api/admin/orders/payment-events${v ? '?view=' + v : ''}`, { cookie: f.cookies.admin })).json;
const alerts = async () => (await f.api('GET', '/api/admin/alerts', { cookie: f.cookies.admin })).json;
const ev = (id) => f.M.PaymentEvent.findById(id).lean();
const open = (o) => o.incidents.filter((i) => !i.resolvedAt);
const strip = (o) => JSON.parse(JSON.stringify(o));
const REASON = 'Contradicción investigada con el recibo autenticado de la misma transacción';
const CONC = 'Pago aplicado y verificado; pedido sin incidencias';

async function archived(kind = 'state') {
  const { order, p } = await f.newWompi(); let tx, r;
  if (kind === 'state') { tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'APPROVED' }); await f.postEvent(tx); r = await f.M.PaymentEvent.findOne({ transactionId: tx.id, status: 'DECLINED' }).lean(); }
  else { tx = f.linkTx(order); pub(tx); await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents - 100 }); r = await f.M.PaymentEvent.findOne({ transactionId: tx.id, amountInCents: tx.amount_in_cents - 100 }).lean(); }
  assert.equal((await reconcile(order, tx.id)).status, 200);
  const proof = await f.M.PaymentEvent.findOne({ transactionId: tx.id, _id: { $ne: r._id }, processedAt: { $ne: null } }).lean();
  assert.equal((await archive(r, { reason: REASON, evidenceReceiptId: String(proof._id) })).status, 200);
  return { order, p, tx, r, proof };
}

let superCookie;
test.before(async () => {
  await f.setup();
  await f.M.User.create({ name: 'U super4', email: 'super4-aud@example.test', password: 'AuditoriaPrueba123!', role: 'superadmin' });
  superCookie = await f.login('super4-aud@example.test', 'AuditoriaPrueba123!');
});
test.after(async () => { await f.close(); });

test('G01 concluir caso resuelto: baja solo el seguimiento; pedido, stock, evento y evidencia intactos; AuditLog', async () => {
  const c = await archived('state'); const a0 = await alerts(); const o0 = strip(await f.fresh(c.order._id)); const e0 = strip(await ev(c.r._id));
  const st = (await conclude(c.r, { reason: CONC })).status; const a1 = await alerts(); const o1 = strip(await f.fresh(c.order._id)); const e1 = strip(await ev(c.r._id));
  const { __v: _a, updatedAt: _b, ...oa } = o0; const { __v: _c, updatedAt: _d, ...ob } = o1;
  const { administrativeArchive: x0, updatedAt: _e, __v: _f, ...ea } = e0; const { administrativeArchive: x1, updatedAt: _g, __v: _h, ...eb } = e1;
  const log = await src('models/AuditLog').findOne({ entityId: c.r._id, action: 'payment_event_follow_up_concluded' }).lean();
  obs('G01', { st, seg: [a0.alerts.financialFollowUp.count, a1.alerts.financialFollowUp.count], total: [a0.totalCount, a1.totalCount], cerrados: (await view('closed-follow-up')).events.some((e) => e._id === String(c.r._id)), log: !!log, v: [o0.__v, o1.__v] });
  assert.equal(st, 200); assert.equal(a1.alerts.financialFollowUp.count, a0.alerts.financialFollowUp.count - 1); assert.equal(a1.totalCount, a0.totalCount - 1);
  assert.deepEqual(ob, oa); assert.deepEqual(eb, ea); assert.equal(e1.processedAt, null); assert.equal(x1.financialFollowUp, false); assert.ok(x1.concludedAt);
  assert.ok((await view('closed-follow-up')).events.some((e) => e._id === String(c.r._id))); assert.ok(log); assert.equal(log.newData.conclusionReason, CONC);
});

test('G02 sin archivo, sin motivo, sin sesión o como vendedor/cliente -> rechazado sin cambios', async () => {
  const c = await archived('state');
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'DECLINED' }); pub({ ...tx, status: 'APPROVED' }); await f.postEvent(tx);
  const sinArchivo = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const st = { sinArchivo: (await conclude(sinArchivo, { reason: CONC })).status, sinMotivo: (await conclude(c.r, {})).status, espacios: (await conclude(c.r, { reason: '  ' })).status,
    anon: (await f.api('POST', `/api/admin/orders/payment-events/${c.r._id}/conclude-follow-up`, { body: { reason: CONC } })).status,
    vend: (await conclude(c.r, { reason: CONC }, f.cookies.vendor)).status, cli: (await conclude(c.r, { reason: CONC }, f.cookies.client)).status };
  obs('G02', st); assert.deepEqual(st, { sinArchivo: 409, sinMotivo: 400, espacios: 400, anon: 401, vend: 403, cli: 403 });
  assert.equal((await ev(c.r._id)).administrativeArchive.financialFollowUp, true);
});

test('G03 contradicción de IMPORTE firmado (posible secreto comprometido): ¿se puede concluir?', async () => {
  const c = await archived('amount'); const st = (await conclude(c.r, { reason: CONC })).status;
  obs('G03', { st, nota: 'el importe va firmado: una firma válida con importe distinto del consultado es una señal de seguridad, no solo financiera' });
  assert.ok([200, 409].includes(st));
});

test('G04 incidencia abierta en el pedido (stock sin aplicar) -> 409; la incidencia no se borra', async () => {
  const c = await archived('state');
  await f.M.Order.updateOne({ _id: c.order._id }, { $push: { incidents: { code: 'approved_without_stock', detail: c.tx.id } }, $set: { requiresReview: true } }); // estado forzado en el arnés
  const st = (await conclude(c.r, { reason: CONC })).status; const o = await f.fresh(c.order._id);
  obs('G04', { st, abiertas: open(o).map((i) => i.code) });
  assert.equal(st, 409); assert.ok(open(o).some((i) => i.code === 'approved_without_stock')); assert.equal((await ev(c.r._id)).administrativeArchive.financialFollowUp, true);
});

test('G05 proveedor caído (500/timeout) o GET VOIDED -> no concluye', async () => {
  const c = await archived('state'); const prev = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(typeof input === 'string' ? input : input.url); if (u.pathname.startsWith('/v1/transactions/')) return new Response('{}', { status: 500 }); return prev(input, init); };
  let st1; try { st1 = (await conclude(c.r, { reason: CONC })).status; } finally { globalThis.fetch = prev; }
  pub({ ...c.tx, status: 'VOIDED' }); const st2 = (await conclude(c.r, { reason: CONC })).status;
  obs('G05', { st1, st2 }); assert.equal(st1, 503); assert.equal(st2, 409); assert.equal((await ev(c.r._id)).administrativeArchive.financialFollowUp, true);
});

test('G06 carrera: concluir y webhook VOIDED simultáneos x5 -> nunca un pedido anulado sin incidencia visible', async () => {
  const res = [];
  for (let i = 0; i < 5; i++) {
    const c = await archived('state'); pub({ ...c.tx, status: 'APPROVED' });
    const [k, v] = await Promise.all([conclude(c.r, { reason: CONC }), (async () => { pub({ ...c.tx, status: 'VOIDED' }); return f.postEvent({ ...c.tx, status: 'VOIDED' }); })()]);
    const o = await f.fresh(c.order._id); const e = await ev(c.r._id);
    res.push({ k: k.status, v: v.status, pago: o.paymentStatus, voidAbierto: open(o).some((x) => x.code === 'payment_voided'), concluido: e.administrativeArchive.financialFollowUp === false, preparar: (await f.canPrepare(c.order._id)).status });
  }
  obs('G06', res);
  for (const r of res) { assert.equal(r.pago, 'rechazado'); assert.ok(r.voidAbierto); assert.equal(r.preparar, 409); }
});

test('G07 pedido ya preparado/enviado: la conclusión no cambia su estado operativo ni financiero', async () => {
  const c = await archived('state'); assert.equal((await f.canPrepare(c.order._id)).status, 200);
  const before = strip(await f.fresh(c.order._id)); const st = (await conclude(c.r, { reason: CONC })).status; const after = strip(await f.fresh(c.order._id));
  obs('G07', { st, estado: [before.orderStatus, after.orderStatus], pago: [before.paymentStatus, after.paymentStatus] });
  assert.equal(after.orderStatus, before.orderStatus); assert.equal(after.paymentStatus, before.paymentStatus); assert.equal(after.stockDeducted, before.stockDeducted);
});

test('G08 concluir repetido/concurrente: una decisión; distinto motivo 409; reabrir devuelve a la bandeja', async () => {
  const c = await archived('state');
  const st = (await Promise.all([conclude(c.r, { reason: CONC }), conclude(c.r, { reason: CONC }), conclude(c.r, { reason: CONC })])).map((r) => r.status);
  const otro = (await conclude(c.r, { reason: 'Otro motivo' })).status; const logs = await src('models/AuditLog').countDocuments({ entityId: c.r._id, action: 'payment_event_follow_up_concluded' });
  const ro = (await reopen(c.r, { reason: 'Nueva evidencia' })).status; const enBandeja = (await view()).events.some((e) => e._id === String(c.r._id));
  obs('G08', { st, otro, logs, ro, enBandeja });
  assert.ok(st.every((s) => s === 200)); assert.equal(otro, 409); assert.equal(logs, 1); assert.equal(ro, 200); assert.ok(enBandeja);
});

test('G09 superadmin puede concluir; el registro guarda rol y estado previo', async () => {
  const c = await archived('state'); const st = (await conclude(c.r, { reason: CONC }, superCookie)).status;
  const log = await src('models/AuditLog').findOne({ entityId: c.r._id, action: 'payment_event_follow_up_concluded' }).lean();
  obs('G09', { st, rol: log?.role, previo: log?.previousData?.financialFollowUp });
  assert.equal(st, 200); assert.equal(log.role, 'superadmin'); assert.equal(log.previousData.financialFollowUp, true);
});

test('G10 vista closed-follow-up: vendedor 403; vista desconocida 400', async () => {
  const st = [(await f.api('GET', '/api/admin/orders/payment-events?view=closed-follow-up', { cookie: f.cookies.vendor })).status,
    (await f.api('GET', '/api/admin/orders/payment-events?view=closed', { cookie: f.cookies.admin })).status];
  obs('G10', { st }); assert.deepEqual(st, [403, 400]);
});
