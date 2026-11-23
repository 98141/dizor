// Pruebas adversariales independientes (auditoría Claude, 2026-11-23).
// Cada aserción expresa el comportamiento SEGURO esperado: un FAIL es un defecto demostrado.
// El proveedor simulado NO copia automáticamente el evento: cada prueba fija qué responde GET.
const test = require('node:test'), assert = require('node:assert/strict');
const f = require('./fixture-claude.cjs');
const obs = (id, data) => console.log(`OBS ${id} ${JSON.stringify(data)}`);
const pub = (tx) => f.provider.tx.set(tx.id, { ...tx });
const reconcile = (o, id, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie, body: id === undefined ? {} : { transactionId: id } });
const resolve = (o, incidentId, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/incidents/${incidentId}/resolve`, { cookie, body });
const inbox = async () => (await f.api('GET', '/api/admin/orders/payment-events', { cookie: f.cookies.admin })).json.events;
const finance = async (id) => f.M.Order.countDocuments({ ...require('../../../../backend/src/services/financeCriteria').reconciledSalesFilter(), _id: id });
const canFulfill = (o) => require('../../../../backend/src/services/orderReadiness').canFulfill(o);
const refundEvidence = (tx, extra = {}) => ({ transactionId: tx.id, reference: 'DEV-AUD-' + Date.now(), url: 'https://example.test/comprobante',
  amountInCents: tx.amount_in_cents, currency: 'COP', recordedAt: new Date(Date.now() - 60000).toISOString(), ...extra });
let superCookie;

test.before(async () => {
  await f.setup();
  await f.M.User.create({ name: 'U super', email: 'super-aud@example.test', password: 'AuditoriaPrueba123!', role: 'superadmin' });
  superCookie = await f.login('super-aud@example.test', 'AuditoriaPrueba123!');
});
test.after(async () => { await f.close(); });

// ---------------- WP-01 ----------------
test('C01 WP-01: APPROVED sin payment_link_id queda durable, visible, alertado una vez y recuperable', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order, { payment_link_id: null });
  assert.equal((await f.postEvent(tx)).status, 200);
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  assert.equal(r.processingState, 'unassociated'); assert.equal(r.order, null); assert.equal(r.associationError, 'missing_payment_link');
  assert.equal(await f.M.Notification.countDocuments({ paymentEvent: r._id }), 1);
  const alerts = await f.api('GET', '/api/admin/alerts', { cookie: f.cookies.admin });
  assert.ok(alerts.json.alerts.paymentEvents.items.some(e => e.transactionId === tx.id));
  pub({ ...tx, payment_link_id: order.wompi.paymentLinkId });
  const rp = await f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie: f.cookies.admin });
  assert.equal(rp.status, 200, rp.text);
  const o = await f.fresh(order._id); assert.equal(o.paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.ok(!(await inbox()).some(e => e.transactionId === tx.id));
});

test('C02 WP-01: eventos no auténticos (firma, secreto, repetición antigua, propiedades) -> 401 y nada persistido', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const codes = [
    (await f.postEvent(tx, { secret: 'test_events_falso' })).status,
    (await f.postEvent(tx, { checksum: 'A'.repeat(64) })).status,
    (await f.postEvent(tx, { noHeader: true })).status,
    (await f.postEvent(tx, { timestamp: Math.floor(Date.now() / 1000) - 27 * 3600 })).status,
    (await f.postEvent(tx, { properties: ['transaction.id', 'transaction.status'] })).status,
  ];
  obs('C02', { codes });
  assert.deepEqual(codes, [401, 401, 401, 401, 401]);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 0);
  assert.equal((await f.fresh(order._id)).paymentStatus, 'pendiente');
});

test('C03 WP-01: referencia que apunta a otro pedido -> sin aplicar a ninguno y evidencia conservada', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const tx = f.linkTx(a.order, { reference: b.order.orderNumber }); pub(tx);
  assert.equal((await f.postEvent(tx)).status, 200);
  assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente'); assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pendiente');
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  assert.equal(r.associationError, 'contradictory_reference'); assert.equal(r.processedAt, null);
});

test('C04 WP-01/06: vínculo no firmado alterado hacia otro pedido -> ninguno pagado; reproceso aplica al dueño real', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const tx = f.linkTx(a.order); pub(tx);
  const res = await f.postEvent(tx, { mutate: e => { e.data.transaction.payment_link_id = b.order.wompi.paymentLinkId; } });
  assert.equal(res.status, 200);
  assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente'); assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pendiente');
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean(); assert.equal(r.associationError, 'provider_binding_mismatch');
  const rp = await f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie: f.cookies.admin });
  assert.equal(rp.status, 200, rp.text);
  assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pagado'); assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pendiente');
});

test('C05 WP-01: escritura fallida del inbox -> no-200; reintento -> un solo recibo y un solo aviso', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { payment_link_id: null });
  await f.failpoint({ times: 1 }, { failCommands: ['findAndModify'], errorCode: 2 });
  const first = (await f.postEvent(tx)).status; await f.failpoint('off');
  const second = (await f.postEvent(tx)).status;
  obs('C05', { first, second });
  assert.notEqual(first, 200); assert.equal(second, 200);
  const rs = await f.M.PaymentEvent.find({ transactionId: tx.id }).lean(); assert.equal(rs.length, 1);
  assert.equal(await f.M.Notification.countDocuments({ paymentEvent: rs[0]._id }), 1);
});

test('C06 WP-01: 8 entregas concurrentes del mismo evento no asociable -> 1 recibo, 1 aviso', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { payment_link_id: null });
  const st = (await Promise.all(Array.from({ length: 8 }, () => f.postEvent(tx)))).map(r => r.status);
  obs('C06', { st });
  const rs = await f.M.PaymentEvent.find({ transactionId: tx.id }).lean(); assert.equal(rs.length, 1);
  assert.equal(await f.M.Notification.countDocuments({ paymentEvent: rs[0]._id }), 1);
});

test('C07 WP-01 NUEVO: APPROVED firmado con consulta del proveedor rezagada (PENDING) no debe perderse en silencio', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order);
  pub({ ...tx, status: 'PENDING' }); // el GET aún no refleja la aprobación ya firmada
  const first = (await f.postEvent(tx)).status;
  const retry = (await f.postEvent(tx)).status; // reintento de Wompi o reenvío
  pub(tx); // el proveedor ya muestra APPROVED; ningún proceso automático lo recoge
  const o = await f.fresh(order._id);
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id, status: 'APPROVED' }).lean();
  const enBandeja = (await inbox()).some(e => e.transactionId === tx.id && e.status === 'APPROVED');
  obs('C07', { first, retry, paymentStatus: o.paymentStatus, stock: await f.stockOf(p), receipt: { state: r?.processingState, processedAt: r?.processedAt, error: r?.associationError }, enBandeja });
  assert.ok(o.paymentStatus === 'pagado' || (r && r.processedAt === null && enBandeja),
    'Un APPROVED auténtico quedó marcado como procesado sin aplicarse ni alertar');
});

test('C08 WP-01: reproceso cuyo estado actual difiere del evento deja limpia la bandeja', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order, { status: 'PENDING', payment_link_id: null });
  await f.postEvent(tx); const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  pub({ ...tx, status: 'APPROVED', payment_link_id: order.wompi.paymentLinkId });
  const rp = await f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie: f.cookies.admin });
  const o = await f.fresh(order._id); const quedan = (await inbox()).filter(e => e.transactionId === tx.id);
  obs('C08', { reprocess: rp.status, paymentStatus: o.paymentStatus, quedanEnBandeja: quedan.map(e => `${e.status}:${e.processingState}`) });
  assert.equal(o.paymentStatus, 'pagado');
  assert.equal(quedan.length, 0, 'El recibo original sigue pendiente para siempre aunque el pago ya se concilió');
});

test('C08c WP-01: recibo con moneda alterada queda en bandeja sin forma de cerrarlo tras conciliar', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  await f.postEvent(tx, { mutate: e => { e.data.transaction.currency = 'USD'; } });
  const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id, currency: 'USD' }).lean();
  const rp = await f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie: f.cookies.admin });
  const quedan = (await inbox()).filter(e => e.transactionId === tx.id);
  obs('C08c', { reprocess: rp.status, paymentStatus: (await f.fresh(order._id)).paymentStatus, quedan: quedan.map(e => `${e.status}:${e.associationError}`) });
  assert.equal(quedan.length, 0, 'Evidencia de manipulación sin cierre operativo: ruido permanente en la bandeja');
});

// ---------------- WP-02 ----------------
test('C09 WP-02: webhook perdido -> conciliación por ID del panel aplica una vez; webhook tardío no duplica', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const sinId = await reconcile(order); // sin ID: el admin debe aportarlo
  const conId = await reconcile(order, tx.id); const repetida = await reconcile(order, tx.id);
  const tardio = await f.postEvent(tx);
  obs('C09', { sinId: sinId.status, conId: conId.status, repetida: repetida.status, tardio: tardio.status });
  assert.equal(conId.status, 200, conId.text); assert.equal(repetida.status, 200); assert.equal(tardio.status, 200);
  assert.equal((await f.fresh(order._id)).paymentStatus, 'pagado'); assert.equal(await f.stockOf(p), 4);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('C10 WP-02: ID de transacción de otro pedido -> 409, nada aplicado; el dueño real se concilia después', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const txB = f.linkTx(b.order); pub(txB);
  const r = await reconcile(a.order, txB.id);
  assert.equal(r.status, 409);
  assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente'); assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pendiente');
  assert.equal((await f.postEvent(txB)).status, 200);
  assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pagado'); assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente');
  assert.equal((await f.canPrepare(a.order._id)).status, 409);
});

test('C11 WP-02: permisos de conciliación y bandeja (vendedor, cliente, anónimo)', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const st = [(await reconcile(order, tx.id, f.cookies.vendor)).status, (await reconcile(order, tx.id, f.cookies.client)).status,
    (await f.api('POST', `/api/admin/orders/${order._id}/reconcile-wompi`, { body: { transactionId: tx.id } })).status,
    (await f.api('GET', '/api/admin/orders/payment-events', { cookie: f.cookies.vendor })).status];
  obs('C11', { st });
  assert.ok(st.every(s => s === 401 || s === 403)); assert.equal((await f.fresh(order._id)).paymentStatus, 'pendiente');
});

test('C12 WP-02/03 NUEVO: un ID mal digitado no debe dejar bloqueado para siempre un pedido pagado', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const typo = await reconcile(order, tx.id + 'x');
  const ok = await reconcile(order, tx.id);
  const o = await f.fresh(order._id);
  const dto = (await f.api('GET', `/api/admin/orders/${order._id}`, { cookie: superCookie })).json;
  const inc = (dto.order || dto.data || dto).incidents?.find(i => i.code === 'reconciliation_query_failed');
  const prep = await f.canPrepare(order._id);
  obs('C12', { typo: typo.status, ok: ok.status, paymentStatus: o.paymentStatus, requiresReview: o.requiresReview,
    abiertas: o.incidents.filter(i => !i.resolvedAt).map(i => i.code), resolucionesSuperadmin: inc?.allowedResolutions, preparar: prep.status });
  assert.equal(o.paymentStatus, 'pagado');
  assert.equal(prep.status, 200, 'Pedido pagado y conciliado queda bloqueado por la incidencia del ID erróneo, sin decisión disponible');
});

test('C13 WP-02: conciliación y dos webhooks concurrentes -> un solo efecto', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx);
  const st = (await Promise.all([reconcile(order, tx.id), f.postEvent(tx), f.postEvent(tx), reconcile(order, tx.id)])).map(r => r.status);
  obs('C13', { st });
  assert.equal(await f.stockOf(p), 4); assert.equal((await f.fresh(order._id)).paymentStatus, 'pagado');
  const o = await f.fresh(order._id); assert.equal(o.statusHistory.filter(h => /APPROVED verificado/.test(h.note)).length >= 1, true);
});

// ---------------- WP-03 ----------------
test('C14 WP-03: vendedor, admin sin rol suficiente e incidencia de otro pedido no resuelven', async () => {
  const { order } = await f.newWompi(); const t1 = f.linkTx(order), t2 = f.linkTx(order); pub(t1); pub(t2);
  await f.postEvent(t1); await f.postEvent(t2);
  const other = await f.newWompi(); const o = await f.fresh(order._id); const i = o.incidents.find(x => x.code === 'additional_approved_payment');
  const st = [
    (await resolve(o, i._id, { decision: 'manual_refund_confirmed', reason: 'Devuelto por fuera', evidence: refundEvidence(t2) }, f.cookies.vendor)).status,
    (await resolve(o, i._id, { decision: 'manual_refund_confirmed', reason: 'Devuelto por fuera', evidence: refundEvidence(t2) }, f.cookies.admin)).status,
    (await resolve(o, i._id, { decision: 'accept_discount', reason: 'Intento de desbloqueo genérico' }, superCookie)).status,
    (await resolve(other.order, i._id, { decision: 'manual_refund_confirmed', reason: 'Devuelto por fuera', evidence: refundEvidence(t2) }, superCookie)).status,
  ];
  obs('C14', { st });
  assert.deepEqual(st, [403, 403, 403, 404]); assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('C15 WP-03: evidencia falsificada o incoherente de devolución es rechazada', async () => {
  const { order } = await f.newWompi(); const t1 = f.linkTx(order), t2 = f.linkTx(order); pub(t1); pub(t2);
  await f.postEvent(t1); await f.postEvent(t2);
  const ajeno = await f.newWompi(); const tA = f.linkTx(ajeno.order); pub(tA); await f.postEvent(tA);
  const o = await f.fresh(order._id); const i = o.incidents.find(x => x.code === 'additional_approved_payment');
  const body = (ev) => ({ decision: 'manual_refund_confirmed', reason: 'Devolución externa registrada', evidence: ev });
  const st = {
    importe: (await resolve(o, i._id, body(refundEvidence(t2, { amountInCents: 1 })), superCookie)).status,
    otroPedido: (await resolve(o, i._id, body(refundEvidence(tA)), superCookie)).status,
    pagoPrincipal: (await resolve(o, i._id, body(refundEvidence(t1)), superCookie)).status,
    http: (await resolve(o, i._id, body(refundEvidence(t2, { url: 'http://example.test/x' })), superCookie)).status,
    javascript: (await resolve(o, i._id, body(refundEvidence(t2, { url: 'javascript:alert(1)' })), superCookie)).status,
    futuro: (await resolve(o, i._id, body(refundEvidence(t2, { recordedAt: new Date(Date.now() + 86400000).toISOString() })), superCookie)).status,
    moneda: (await resolve(o, i._id, body(refundEvidence(t2, { currency: 'USD' })), superCookie)).status,
    motivoCorto: (await resolve(o, i._id, { ...body(refundEvidence(t2)), reason: 'ok' }, superCookie)).status,
  };
  obs('C15', st);
  assert.ok(Object.values(st).every(s => s >= 400 && s < 500));
  const after = await f.fresh(order._id); assert.ok(after.incidents.find(x => x.code === 'additional_approved_payment').resolvedAt === null);
});

test('C16 WP-03 (P20 corregido): pago adicional devuelto con evidencia exacta -> despacho del pago principal habilitado y auditado', async () => {
  const { order, p } = await f.newWompi(); const t1 = f.linkTx(order), t2 = f.linkTx(order); pub(t1); pub(t2);
  await f.postEvent(t1); await f.postEvent(t2);
  const o = await f.fresh(order._id); const i = o.incidents.find(x => x.code === 'additional_approved_payment');
  const r = await resolve(o, i._id, { decision: 'manual_refund_confirmed', reason: 'Devolución externa del cobro duplicado', evidence: refundEvidence(t2) }, superCookie);
  assert.equal(r.status, 200, r.text);
  const after = await f.fresh(order._id);
  assert.equal(after.paymentStatus, 'pagado'); assert.equal(after.wompi.transactionId, t1.id); assert.equal(await f.stockOf(p), 4);
  const Audit = require('../../../../backend/src/models/AuditLog');
  assert.equal(await Audit.countDocuments({ action: 'payment_incident_resolved', entityId: order._id }), 1);
  assert.equal((await f.canPrepare(order._id)).status, 200);
});

test('C17 WP-03/15 (P22b corregido): cupón de un uso cobrado dos veces -> aceptación explícita, usedCount intacto', async () => {
  const code = 'AUDC' + Date.now().toString(36).toUpperCase();
  await f.M.Coupon.create({ code, type: 'percentage', value: 10, maxUses: 1 });
  const a = await f.newWompi(3, 150000, { couponCode: code }), b = await f.newWompi(3, 150000, { couponCode: code });
  const ta = f.linkTx(a.order), tb = f.linkTx(b.order); pub(ta); pub(tb); await f.postEvent(ta); await f.postEvent(tb);
  const ob = await f.fresh(b.order._id); const i = ob.incidents.find(x => x.code === 'coupon_reconciliation');
  assert.ok(i); assert.equal((await f.canPrepare(b.order._id)).status, 409);
  const vend = await resolve(ob, i._id, { decision: 'accept_discount', reason: 'Asumimos el descuento cobrado' }, f.cookies.vendor);
  const ok = await resolve(ob, i._id, { decision: 'accept_discount', reason: 'Asumimos el descuento cobrado' });
  obs('C17', { vend: vend.status, ok: ok.status });
  assert.equal(vend.status, 403); assert.equal(ok.status, 200, ok.text);
  assert.equal((await f.M.Coupon.findOne({ code }).lean()).usedCount, 1);
  assert.equal((await f.canPrepare(b.order._id)).status, 200);
});

test('C18 WP-03: aceptar descuento no habilita un pedido sin pago verificado', async () => {
  const { order } = await f.newWompi();
  await f.M.Order.updateOne({ _id: order._id }, { $set: { requiresReview: true }, $push: { incidents: { code: 'coupon_reconciliation', detail: 'X' } } });
  const o = await f.fresh(order._id);
  const r = await resolve(o, o.incidents[0]._id, { decision: 'accept_discount', reason: 'Intento sin pago verificado' });
  assert.equal(r.status, 409); assert.equal((await f.canPrepare(order._id)).status, 409);
});

test('C19 WP-03: resoluciones simultáneas -> una sola resolución y un solo AuditLog', async () => {
  const code = 'AUDD' + Date.now().toString(36).toUpperCase();
  await f.M.Coupon.create({ code, type: 'percentage', value: 10, maxUses: 1 });
  const a = await f.newWompi(3, 150000, { couponCode: code }), b = await f.newWompi(3, 150000, { couponCode: code });
  const ta = f.linkTx(a.order), tb = f.linkTx(b.order); pub(ta); pub(tb); await f.postEvent(ta); await f.postEvent(tb);
  const ob = await f.fresh(b.order._id); const i = ob.incidents.find(x => x.code === 'coupon_reconciliation');
  const st = (await Promise.all(Array.from({ length: 4 }, () => resolve(ob, i._id, { decision: 'accept_discount', reason: 'Asumimos el descuento cobrado' })))).map(r => r.status);
  obs('C19', { st });
  assert.equal(st.filter(s => s === 200).length, 1);
  const Audit = require('../../../../backend/src/models/AuditLog');
  assert.equal(await Audit.countDocuments({ action: 'payment_incident_resolved', entityId: b.order._id }), 1);
});

test('C20 WP-03/04: registrar anulación exige pedido cerrado/enviado y confirmación VOIDED del proveedor', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  pub({ ...tx, status: 'VOIDED' }); await f.postEvent({ ...tx, status: 'VOIDED' });
  let o = await f.fresh(order._id); const i = o.incidents.find(x => x.code === 'payment_voided');
  const abierto = await resolve(o, i._id, { decision: 'record_void_review', reason: 'Anulación revisada en panel' });
  await f.api('PATCH', `/api/admin/orders/${order._id}/status`, { cookie: f.cookies.admin, body: { orderStatus: 'cancelado' } });
  pub(tx); // el proveedor (simulado incoherente) dice APPROVED: no debe aceptarse como anulación confirmada
  const sinVoid = await resolve(o, i._id, { decision: 'record_void_review', reason: 'Anulación revisada en panel' });
  obs('C20', { abierto: abierto.status, sinVoid: sinVoid.status });
  assert.equal(abierto.status, 409); assert.equal(sinVoid.status, 409);
});

test('C21 WP-03/04: anulación sobre pedido enviado; resolverla no equivale a pago conciliado', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  await f.M.Order.updateOne({ _id: order._id }, { $set: { orderStatus: 'enviado', carrier: 'interrapidisimo', trackingNumber: 'GUIA-AUD-1' } });
  pub({ ...tx, status: 'VOIDED' }); await f.postEvent({ ...tx, status: 'VOIDED' });
  let o = await f.fresh(order._id); const i = o.incidents.find(x => x.code === 'payment_voided');
  const r = await resolve(o, i._id, { decision: 'record_void_review', reason: 'Gestión de cobro del envío en curso' });
  o = await f.fresh(order._id);
  const buyerDeclined = await f.M.Notification.countDocuments({ order: order._id, event: 'payment.declined' });
  obs('C21', { resolver: r.status, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, requiresReview: o.requiresReview,
    finanzas: await finance(order._id), canFulfill: canFulfill(o), stock: await f.stockOf(p), avisoCompradorPagoRechazado: buyerDeclined });
  assert.equal(r.status, 200, r.text); assert.equal(o.paymentStatus, 'rechazado'); assert.equal(await finance(order._id), 0); assert.equal(canFulfill(o), false);
});

// ---------------- WP-04 ----------------
test('C22 WP-04: APPROVED -> VOIDED (x3 concurrente) bloquea, sale de finanzas, una incidencia', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  assert.equal(await finance(order._id), 1);
  pub({ ...tx, status: 'VOIDED' });
  await Promise.all(Array.from({ length: 3 }, () => f.postEvent({ ...tx, status: 'VOIDED' })));
  const o = await f.fresh(order._id);
  assert.equal(o.paymentStatus, 'rechazado'); assert.equal(o.incidents.filter(x => x.code === 'payment_voided').length, 1);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id, status: 'VOIDED' }), 1);
  assert.equal(await finance(order._id), 0); assert.equal((await f.canPrepare(order._id)).status, 409); assert.equal(await f.stockOf(p), 4);
});

test('C23 WP-04: APPROVED antiguo tras VOIDED, aunque el GET (rezagado) diga APPROVED, no rehabilita', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  pub({ ...tx, status: 'VOIDED' }); await f.postEvent({ ...tx, status: 'VOIDED' });
  pub(tx); // lectura rezagada del proveedor
  await f.postEvent(tx, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
  const rc = await reconcile(order, tx.id);
  const o = await f.fresh(order._id);
  obs('C23', { reconcile: rc.status, paymentStatus: o.paymentStatus, wompi: o.wompi.status });
  assert.equal(o.paymentStatus, 'rechazado'); assert.equal((await f.canPrepare(order._id)).status, 409); assert.equal(await finance(order._id), 0);
});

test('C24 WP-04: VOIDED de la transacción de otro pedido con vínculo alterado no anula al pedido pagado', async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const ta = f.linkTx(a.order); pub(ta); await f.postEvent(ta);
  const tb = f.linkTx(b.order, { status: 'VOIDED' }); pub(tb);
  const r = await f.postEvent(tb, { mutate: e => { e.data.transaction.payment_link_id = a.order.wompi.paymentLinkId; } });
  const oa = await f.fresh(a.order._id), ob = await f.fresh(b.order._id);
  obs('C24', { status: r.status, A: oa.paymentStatus, B: ob.paymentStatus });
  assert.equal(oa.paymentStatus, 'pagado'); assert.equal((await f.canPrepare(a.order._id)).status, 200);
});

test('C25 WP-04: pedido en preparación + VOIDED -> no puede enviarse; cancelar repone stock', async () => {
  const { order, p } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  assert.equal((await f.canPrepare(order._id)).status, 200);
  pub({ ...tx, status: 'VOIDED' }); await f.postEvent({ ...tx, status: 'VOIDED' });
  await f.M.Order.updateOne({ _id: order._id }, { $set: { carrier: 'interrapidisimo', trackingNumber: 'GUIA-AUD-2' } });
  const enviar = await f.api('PATCH', `/api/admin/orders/${order._id}/status`, { cookie: f.cookies.admin, body: { orderStatus: 'enviado' } });
  const enviarVend = await f.api('PATCH', `/api/admin/orders/${order._id}/status`, { cookie: f.cookies.vendor, body: { orderStatus: 'enviado' } });
  const cancelar = await f.api('PATCH', `/api/admin/orders/${order._id}/status`, { cookie: f.cookies.admin, body: { orderStatus: 'cancelado' } });
  obs('C25', { enviar: enviar.status, enviarVend: enviarVend.status, cancelar: cancelar.status, stock: await f.stockOf(p) });
  assert.equal(enviar.status, 409); assert.equal(enviarVend.status, 409); assert.equal(cancelar.status, 200); assert.equal(await f.stockOf(p), 5);
});

test('C26 WP-04: pedido entregado + VOIDED -> rechazado, incidencia y fuera de finanzas', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); pub(tx); await f.postEvent(tx);
  await f.M.Order.updateOne({ _id: order._id }, { $set: { orderStatus: 'entregado' } });
  pub({ ...tx, status: 'VOIDED' }); await f.postEvent({ ...tx, status: 'VOIDED' });
  const o = await f.fresh(order._id);
  assert.equal(o.paymentStatus, 'rechazado'); assert.ok(o.incidents.some(x => x.code === 'payment_voided' && !x.resolvedAt)); assert.equal(await finance(order._id), 0);
});

// ---------------- WP-05 / WP-06 ----------------
test('C27 WP-05: importe inferior, superior y moneda distinta (confirmados por el proveedor) nunca quedan como pagado', async () => {
  const out = {};
  for (const [k, mod] of Object.entries({ inferior: o => ({ amount_in_cents: Math.round(o.total * 100) - 100 }), superior: o => ({ amount_in_cents: Math.round(o.total * 100) + 100 }), moneda: () => ({ currency: 'USD' }) })) {
    const { order, p } = await f.newWompi(); const tx = f.linkTx(order, mod(order)); pub(tx);
    const st = (await f.postEvent(tx)).status; const o = await f.fresh(order._id);
    out[k] = { st, pago: o.paymentStatus, stock: await f.stockOf(p), inc: o.incidents.map(i => i.code), prep: (await f.canPrepare(order._id)).status, fin: await finance(order._id) };
  }
  obs('C27', out);
  for (const v of Object.values(out)) { assert.notEqual(v.pago, 'pagado'); assert.equal(v.stock, 5); assert.equal(v.prep, 409); assert.equal(v.fin, 0); assert.ok(v.inc.includes('payment_amount_or_currency_mismatch')); }
});

test('C28 WP-06: transacción ya aplicada a A no puede aplicarse a B aunque llegue con el vínculo de B', async () => {
  const a = await f.newWompi(), b = await f.newWompi(1, 90000); const ta = f.linkTx(a.order); pub(ta); await f.postEvent(ta);
  const forged = { ...ta, amount_in_cents: Math.round(b.order.total * 100), payment_link_id: b.order.wompi.paymentLinkId };
  pub(forged); // proveedor simulado incoherente: peor caso
  const r = await f.postEvent(forged);
  const ob = await f.fresh(b.order._id);
  obs('C28', { status: r.status, B: ob.paymentStatus, err: (await f.M.PaymentEvent.findOne({ transactionId: ta.id, amountInCents: forged.amount_in_cents }).lean())?.associationError });
  assert.notEqual(ob.paymentStatus, 'pagado');
});

test('C29 WP-06: dos pedidos con el mismo enlace -> ambiguo, ninguno pagado', async () => {
  const a = await f.newWompi(), b = await f.newWompi();
  await f.M.Order.updateOne({ _id: b.order._id }, { $set: { 'wompi.paymentLinkId': a.order.wompi.paymentLinkId } });
  const tx = f.linkTx(a.order); pub(tx); await f.postEvent(tx);
  assert.equal((await f.fresh(a.order._id)).paymentStatus, 'pendiente'); assert.equal((await f.fresh(b.order._id)).paymentStatus, 'pendiente');
  assert.equal((await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean()).associationError, 'ambiguous_payment_link');
});

// ---------------- Regresiones ----------------
test('C30 Regresión: contraentrega conserva reserva, autocancelación y reposición', async () => {
  const p = await f.makeProduct(5);
  const r = await f.createOrder(p, { paymentMethod: 'contra_entrega' }, f.cookies.client);
  assert.equal(r.status, 201, r.text); assert.equal(await f.stockOf(p), 4);
  const c = await f.api('PATCH', `/api/checkout/orders/${r.json.order.id}/cancel`, { cookie: f.cookies.client });
  assert.equal(c.status, 200, c.text); assert.equal(await f.stockOf(p), 5);
});

test('C31 Regresión/WP-09: cliente no cancela Wompi con intento PENDING conocido ni cambia su estado', async () => {
  const p = await f.makeProduct(5); const r = await f.createOrder(p, {}, f.cookies.client); const order = await f.fresh(r.json.order.id);
  const tx = f.linkTx(order, { status: 'PENDING' }); pub(tx); await f.postEvent(tx);
  const c = await f.api('PATCH', `/api/checkout/orders/${order._id}/cancel`, { cookie: f.cookies.client });
  const otro = await f.api('PATCH', `/api/checkout/orders/${order._id}/cancel`, { cookie: f.cookies.client2 });
  const o = await f.fresh(order._id);
  obs('C31', { propio: c.status, ajeno: otro.status, orderStatus: o.orderStatus, paymentStatus: o.paymentStatus });
  assert.equal(c.status, 409); assert.equal(otro.status, 404); assert.notEqual(o.orderStatus, 'cancelado');
});

test('C32 Regresión: Nequi y transferencia siguen bloqueados en servidor', async () => {
  const p = await f.makeProduct(5);
  const st = [(await f.createOrder(p, { paymentMethod: 'nequi_api' })).status, (await f.createOrder(p, { paymentMethod: 'transferencia' })).status,
    (await f.api('POST', '/api/webhooks/nequi', { body: { orderId: 'x', status: 'APPROVED' } })).status];
  obs('C32', { st });
  assert.ok(st[0] >= 400 && st[1] >= 400 && st[2] >= 400); assert.equal(await f.stockOf(p), 5);
});

test('C33 WP-09/03 (P28 corregido): cancelación antes del pago tiene salida administrativa y un pago tardío vuelve a bloquear', async () => {
  const p = await f.makeProduct(5); const r = await f.createOrder(p, {}, f.cookies.client); const order = await f.fresh(r.json.order.id);
  const cli = await f.api('PATCH', `/api/checkout/orders/${order._id}/cancel`, { cookie: f.cookies.client });
  const adm = await f.api('PATCH', `/api/admin/orders/${order._id}/status`, { cookie: f.cookies.admin, body: { orderStatus: 'cancelado' } });
  let o = await f.fresh(order._id); const st = [];
  for (const i of o.incidents.filter(x => !x.resolvedAt)) st.push((await resolve(o, i._id, { decision: 'acknowledge_closed_watch', reason: 'Vigilancia asumida por administración' })).status);
  o = await f.fresh(order._id); const antes = o.requiresReview;
  const tx = f.linkTx(o); pub(tx); await f.postEvent(tx);
  const d = await f.fresh(order._id);
  obs('C33', { cli: cli.status, adm: adm.status, resoluciones: st, requiresReviewTrasArchivar: antes, tardio: { pago: d.paymentStatus, estado: d.orderStatus, review: d.requiresReview, inc: d.incidents.filter(i => !i.resolvedAt).map(i => i.code) }, stock: await f.stockOf(p) });
  assert.equal(cli.status, 409); assert.equal(adm.status, 200); assert.ok(st.every(s => s === 200)); assert.equal(antes, false);
  assert.equal(d.requiresReview, true); assert.ok(d.incidents.some(i => i.code === 'approved_after_cancellation' && !i.resolvedAt)); assert.equal(await f.stockOf(p), 5);
});

test('C34 E01 (dependencia): si la consulta privada no trae payment_link_id, nada se aplica a otro pedido (y no hay recuperación en la app)', async () => {
  const { order } = await f.newWompi(); const tx = f.linkTx(order); const { payment_link_id, ...sinLink } = tx; pub(sinLink);
  const w = (await f.postEvent(tx)).status; const r = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const rc = await reconcile(order, tx.id);
  const rp = await f.api('POST', `/api/admin/orders/payment-events/${r._id}/reprocess`, { cookie: f.cookies.admin });
  const o = await f.fresh(order._id);
  obs('C34', { webhook: w, error: r.associationError, conciliar: rc.status, reprocesar: rp.status, pago: o.paymentStatus });
  assert.notEqual(o.paymentStatus, 'pagado'); assert.equal((await f.canPrepare(order._id)).status, 409);
});
