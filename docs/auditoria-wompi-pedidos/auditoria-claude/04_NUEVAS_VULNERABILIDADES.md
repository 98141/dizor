# 04 · Hallazgos nuevos

Los ID son independientes de los WP-xx. Las pruebas citadas están en `evidencias/adversarial.test.cjs` y su salida en `evidencias/ejec-adversarial.txt`.

| ID | Prioridad | ¿Lo introduce la remediación? | ¿Bloquea producción? |
|---|---|---|---|
| NV-01 | P2 | Sí | Sí (corregir antes de abrir Wompi) |
| NV-02 | P2 | Sí | Sí (corregir antes de abrir Wompi) |
| NV-03 | P3 | Sí | No |
| NV-04 | P1 condicional | Agrava una dependencia previa (E01) | **Sí, hasta ejecutar E01** |
| NV-05 | P3 | Sí | No |
| NV-06 | P3 | Lo expone al cambiar el estado tras VOIDED | No |
| NV-07 | P3 | Sí | No |

---

## NV-01 · P2 · Una lectura rezagada del proveedor degrada un APPROVED firmado y lo da por procesado

**Dónde:** `backend/src/services/wompiPaymentService.js:113-117`. Cuando `trusted.status !== tx.status` y el evento no es VOIDED, se aplica el estado consultado y el recibo firmado se marca `processed` con `superseded_by_provider_state`.

**Escenario (C07, FAIL):**
1. Llega un webhook APPROVED con firma válida.
2. `GET /v1/transactions/{id}` todavía responde PENDING.

Lo observado:

```
first=200, retry=200, paymentStatus=pendiente, stock=5,
receipt.state=processed, processedAt=<fecha>, error=superseded_by_provider_state, enBandeja=false
```

**Impacto:**
- Un pago auténtico no se aplica, sale de la bandeja de eventos y Wompi deja de reintentar porque recibió un 200.
- Solo reaparece como "pendiente de más de 24 h" y solo se recupera si alguien concilia el pedido a mano.
- El mismo mecanismo aplicaría un DECLINED rezagado sobre un APPROVED firmado, dejando el pedido `rechazado`.
- La documentación oficial no dice nada sobre la consistencia entre el evento y `GET` (consultada el 2026-11-23). La probabilidad es desconocida, no nula.

**Corrección mínima:** la observación del proveedor solo puede sustituir al evento firmado si representa un estado **posterior** en el ciclo de vida (PENDING → APPROVED/DECLINED/ERROR → VOIDED, este último solo desde APPROVED). En cualquier otro caso:
1. Guardar `providerObservation`.
2. Poner `processingState = "failed"` con `lastError = "Proveedor aún no refleja el estado firmado"`.
3. Llamar a `paymentEventReview`.
4. Lanzar `AppError(503)`, sin marcar `processedAt`.

**Regresión:**
- C07 en PASS: pedido `pagado` tras el reintento con el proveedor ya actualizado, o recibo no procesado y visible en la bandeja.
- Variante con DECLINED rezagado sobre APPROVED firmado.
- R22 sigue en PASS: VOIDED posterior sí prevalece.

---

## NV-02 · P2 · Un ID mal digitado deja bloqueado sin salida un pedido pagado

**Dónde:**
- `backend/src/controllers/orderAdminController.js:203-206`: cualquier fallo de `getTransaction`, incluido un 404 por ID inexistente, añade `reconciliation_query_failed` con `detail` igual al ID escrito.
- `:209-211`: solo se resuelven las incidencias cuyo `detail` coincide con el ID de la conciliación exitosa.
- `paymentIncidentResolution.js:9-14`: no hay ninguna decisión para ese código.

**Escenario (C12, FAIL):**
1. El administrador escribe el ID con un carácter de más: responde 503.
2. Concilia con el ID correcto: responde 200 y el pedido queda `pagado`.

Lo observado:

```
requiresReview=true, abiertas=[reconciliation_query_failed], resolucionesSuperadmin=[], preparar=409
```

**Impacto:**
- Un pedido pagado y conciliado no se puede preparar ni enviar sin editar la base de datos.
- Es el mismo patrón que motivó WP-03 (P1), disparado por un error de tecleo plausible, por ejemplo un ID de Sandbox usado en producción.

**Corrección mínima:**
1. `wompiService.getTransaction` debe distinguir 404 (ID inexistente o de otro ambiente) de los errores 5xx y timeouts.
2. Ante 404 o un ID inválido, devolver 409 "ID no encontrado en este ambiente" **sin** crear incidencia.
3. Tras una conciliación exitosa, cerrar **todas** las incidencias `reconciliation_query_failed` abiertas del pedido.

Como alternativa al punto 3, añadir la decisión `acknowledge_query_failure` (admin, con motivo) en `decisions()`.

**Regresión:**
- C12 en PASS.
- Un 5xx sigue creando la incidencia y la conciliación posterior la cierra.

---

## NV-03 · P3 · Recibos obsoletos permanentes en la bandeja de eventos

**Dónde:** `orderAdminController.js:225-236` (`reprocessPaymentEvent`). Procesa el estado consultado, que puede tener otra clave (estado o moneda distintos), pero nunca cierra el recibo original. La bandeja lista `processedAt: null` y no hay acción de archivo.

**Escenarios:**
- **C08 (FAIL):** un PENDING sin vínculo se reprocesa con el proveedor en APPROVED. El pedido queda `pagado`, pero queda `PENDING:unassociated` en la bandeja.
- **C08c (FAIL):** un evento con moneda alterada se reprocesa. El pedido queda pagado, pero queda `APPROVED:provider_binding_mismatch` para siempre.

**Impacto:** ruido permanente en la bandeja y en el contador de alertas, lo que causa fatiga de alertas. Un evento manipulado (C08c) debería conservarse como evidencia, pero cerrado.

**Corrección mínima:**
1. En `reprocessPaymentEvent`, si el proceso termina bien y `tx.id === event.transactionId`, marcar el recibo original con `processedAt`, `processingState: "processed"` y `associationError: "superseded_by_provider_state"`, igual que ya hace la línea 116 del webhook.
2. Para un `provider_binding_mismatch`, conservar el `associationError` original.

**Regresión:** C08 y C08c en PASS.

---

## NV-04 · P1 condicional (BLOCKED por E01) · La asociación depende de `payment_link_id` también en `GET`

**Dónde:** `wompiPaymentService.js:101-111`. Si `trusted.payment_link_id !== tx.payment_link_id`, el recibo queda `unassociated`. Lo mismo ocurre en `findAssociation` para `reconcileWompi` y `reprocessPaymentEvent`, porque usan el `tx` devuelto por `GET`.

**Hecho documental (consultado el 2026-11-23):**
- `docs.wompi.co/docs/colombia/seguimiento-de-transacciones/` **no documenta** `payment_link_id` en la respuesta de `GET /v1/transactions/{id}`.
- El ejemplo de evento de `eventos/` lo muestra con valor `null`.

**Escenario (C34):** el webhook trae el vínculo, pero `GET` no lo trae.

```
webhook=200, error=provider_binding_mismatch, conciliar=409, reprocesar=409, pago=pendiente
```

Es seguro, porque nada se aplica a un pedido equivocado. Pero **ningún pago Wompi podría aplicarse, ni automáticamente ni por las vías administrativas nuevas**.

**Impacto:** si E01 demuestra que `GET` no devuelve el vínculo, toda venta Wompi queda cobrada y sin procesar. Antes de la remediación bastaba con que el campo viniera en el evento. Ahora tiene que venir en ambos.

**Corrección:** no se debe cambiar a ciegas.
1. Ejecutar E01 capturando, redactados, el evento **y** la respuesta de `GET` de una transacción de Link en Sandbox.
2. Si `GET` no trae el vínculo, decidir antes del despliegue entre estas opciones:
   - Usar otra fuente autenticada de vínculo documentada por Wompi.
   - Cambiar a Web Checkout con `reference = orderNumber` y firma de integridad.

Lo que no se debe hacer es retirar el contraste, porque reabriría WP-06 (C04).

**Regresión:** C34 con el contrato real que resulte de E01.

---

## NV-05 · P3 · Consulta HTTP al proveedor dentro de una transacción de Mongo

**Dónde:** `paymentIncidentResolution.js:37`. `getTransaction` se llama dentro de `mutateOrder`, que usa `withTransaction`.

**Impacto:**
- Un reintento por conflicto de escritura repite la llamada HTTP.
- La transacción queda abierta hasta 10 s.
- Un error de red sale como 500 genérico, no como 503.

**Corrección mínima:** consultar a Wompi antes de `mutateOrder` y pasar el resultado a la función, revalidando el estado del pedido dentro de la transacción.

**Regresión:** C20 y C21, más un caso con el proveedor caído que devuelva 503 sin abrir una transacción.

## NV-06 · P3 · Aviso "pago no completado" al comprador tras anular un pedido ya enviado

**Dónde:** `notificationEvents.js:67-68`. Un VOIDED deja `paymentStatus = "rechazado"` y se encola `payment.declined` para el comprador, aunque el pedido esté `enviado` o `entregado` (C21: `avisoCompradorPagoRechazado=1`).

**Impacto:** comunicación engañosa al cliente si se activa el correo. Puede incluir una invitación a reintentar con un enlace `single_use` ya consumido.

**Corrección mínima:** no encolar `payment.declined` cuando el VOIDED corresponde a una transacción antes aplicada (`wompi.status` previo APPROVED). Basta con la incidencia administrativa.

**Regresión:** C21 con `payment.declined = 0` y `admin.incident ≥ 1`.

## NV-07 · P3 · La referencia de devolución solo es única dentro del pedido

**Dónde:** `paymentIncidentResolution.js:57-59`.

**Impacto:** la misma referencia y el mismo comprobante podrían atestar devoluciones en pedidos distintos. Mitigación existente: solo puede hacerlo un superadmin, el importe y el ID deben coincidir con un cobro real, y queda en `AuditLog`.

**Corrección mínima:** antes de aceptar la referencia, comprobar en `Order` si alguna otra incidencia ya la usó (`incidents.resolution.evidence.reference`).

**Regresión:** misma referencia en dos pedidos: la segunda responde 409.

---

## Observación preexistente (no introducida)

`wompiPaymentService.js:181`, presente también en `9289c7b`. Una aprobación cierra sola `cancellation_verification_pending`, y el pedido cuyo cliente pidió cancelar pasa a "Por preparar". La intención de cancelar del cliente se pierde. Prioridad P3. Hay que decidir si debe seguir bloqueando hasta que un administrador lo revise.
