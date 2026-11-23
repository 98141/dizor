# Correcciones mínimas

## NR-01 · bandera coherente al cerrar fallos

`backend/src/controllers/orderAdminController.js:228`: dentro de la misma transacción existente que resuelve las incidencias y registra AuditLog, recalcular revisión cuando se cierran fallos de consulta, aunque el intento consultado sea DECLINED. No hay limpieza global: sin fallos cerrados y sin APPROVED se conserva la bandera histórica. Las incidencias activas siguen bloqueando. No se modifica reconocimiento financiero ni la identidad del pago principal.

Antes: D13 y Z01 FAIL. Después: D13 y Z01 PASS; N08 y R26 permanecen PASS. D16/Z01 cubren consultas concurrentes; Z01 comprueba preparación y un solo AuditLog de cierre.

## NR-02 · identidad y primera fecha

- `orderAdminController.js:283`: solo escribir metadatos de sustitución si los identificadores del original y del verificado difieren. Si coinciden, conservar asociación y limpiar lastError de recuperación.
- `backend/src/services/wompiPaymentService.js:142` y `:228`: conservar el primer processedAt con `||=`. La rama de sustitución de estado guarda también bajo transacción para no perder una fecha ante carreras.
- `wompiPaymentService.js:214` y `:222`: una consulta repetida se describe como “Reconsulta”; se conserva el historial anterior y la observación privada más reciente. No se vuelve a describir como primer procesamiento.

No se añade metadata nueva para NR-02. Se mantienen claves originales, estado, moneda, importe, checksum, origen y fecha de creación. Un recibo diferente sigue permitiendo sustitución verificada; provider_binding_mismatch continúa preservado.

Antes: D17b/D18/Z02 FAIL. Después: PASS. D17/D19/D20/D23, N11/N12 y C08c conservan sus resultados aprobados; cubren recuperación, cambio de estado/moneda, fallos y concurrencia. Z02 compara fechas en milisegundos y verifica stock/aviso únicos.

## NR-03 · archivo administrativo separado del hecho financiero

`backend/src/models/paymentEvent.js:18` añade únicamente el objeto opcional `administrativeArchive` a la colección existente. Actor, motivo, fecha, referencia al recibo probatorio y reapertura no caben en los campos financieros actuales sin falsificar su significado. `processedAt`, `processingState`, `associationError`, evidencia original y observación original permanecen intactos al archivar/reabrir. No hay colección, migración ni dependencia nueva. Las decisiones anteriores permanecen en AuditLog aunque se vuelva a archivar.

`backend/src/services/paymentEventArchive.js:22` exige:

1. Admin/superadmin, motivo no vacío de hasta 1000 caracteres y evidencia identificada.
2. Mismo ambiente y transacción; recibo probatorio distinto, procesado, asociado inequívocamente. Debe proceder de consulta privada, o ser un webhook procesado con observación privada que coincida íntegramente con sus campos de estado/vínculo/importe/moneda. Que el recibo se haya creado primero por webhook no elimina la evidencia autenticada posterior.
3. Contradicción terminal: DECLINED/ERROR firmado frente a APPROVED/VOIDED consultado, o diferencia de importe/moneda frente a una observación terminal. PENDING, rezago de un APPROVED frente a GET PENDING, falta de asociación confiable y falta de prueba se rechazan. No se amplían las reglas financieras de progresión existentes.
4. Evidencia probatoria que coincida con la observación privada del contradictorio; si el original tiene pedido, ambos pedidos deben coincidir.

Evento y AuditLog se guardan con `inTransaction`; el conflicto de escritura de Mongo serializa decisiones concurrentes. Repetir mismo motivo y evidencia no genera otra decisión; cambiarla exige reapertura. Una falla al insertar AuditLog revierte también la metadata del evento (Z08).

`paymentEventArchive.js:58` permite reapertura motivada y auditada, conservando la decisión anterior. El reproceso administrativo exige reabrir primero (`orderAdminController.js:260`); después vuelve a consultar al proveedor por el mecanismo existente. Los webhooks y la conciliación financiera conservan sus verificaciones, y no se bloquea la llegada de evidencia nueva.

## API y operación

Rutas de `backend/src/routes/adminOrderRoutes.js:17` (todas restringidas a admin/superadmin):

| Operación | Entrada / resultado |
|---|---|
| GET `/api/admin/orders/payment-events` | Bandeja pendiente, excluye archivos administrativos; devuelve events y count |
| GET misma ruta `?view=financial-follow-up` | Archivos con seguimiento financiero abierto, incluso si luego llega evidencia nueva |
| GET misma ruta `?view=verified&transactionId=...` | Recibos probatorios procesados; no consulta ni cambia dinero |
| POST `/api/admin/orders/payment-events/:eventId/archive` | `{reason,evidenceReceiptId}` |
| POST `/api/admin/orders/payment-events/:eventId/reopen` | `{reason}` |

`adminAlertController.js:47` mantiene un grupo de seguimiento financiero incluido en el total de alertas. **Todo archivo sigue en supervisión financiera**: no hay nueva operación que declare un reembolso o cierre económico. Sin prueba confiable, el evento permanece en la bandeja principal. La política es deliberadamente conservadora para no ocultar un posible cobro.

`frontend/src/components/admin/PaymentEventAlerts.jsx:17` permite investigar, seleccionar la prueba, justificar, archivar y reabrir en la tarjeta existente. Los contadores se actualizan tras la operación. `frontend/src/services/orderAdminService.js:8` añade acceso a esas acciones y `frontend/src/app/admin/alertas/page.js:162` pasa el contador financiero. No hay rediseño ni cambios del checkout.

Archivo y reapertura no escriben Order, stock, cupones ni notificaciones de aprobación. No confirman pago ni cambian condiciones de despacho. Z03 compara todo el pedido antes/después; Z07 conserva un bloqueo financiero real.
