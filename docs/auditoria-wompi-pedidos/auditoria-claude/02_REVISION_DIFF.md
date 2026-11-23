# 02 · Revisión del diff respecto a `9289c7b`

## Alcance

- **Diff revisado:** `git diff 9289c7b`, con 22 archivos modificados (+283 y −58 líneas), más 3 archivos nuevos.
- **Otros cambios en el árbol:** solo la carpeta `docs/auditoria-wompi-pedidos/`, que no está bajo seguimiento.
- **Commits posteriores a la base:** ninguno; HEAD sigue en `9289c7b`.
- **Comparación con el diff que entregó Codex:** el árbol coincide con la lista de 25 archivos de `remediacion/07_HANDOFF_AUDITOR_CLAUDE.md`.

## Resultado transversal

Estas preguntas se evaluaron para todos los archivos:

| Pregunta | Resultado |
|---|---|
| ¿Nuevas dependencias? | **No.** No cambia ningún `package.json` ni el lockfile |
| ¿Cambio de modalidad o de llaves? | **No.** Sigue en Payment Links y no se modificó `.env` |
| ¿Cambios de contrato API? | **Solo aditivos y protegidos.** Los detalla la tabla siguiente |
| ¿Migraciones o índices? | **No.** Los esquemas se amplían con campos opcionales y los documentos antiguos siguen siendo legibles. `PaymentEvent.order` pasa de obligatorio a `null` por defecto, lo que es compatible |
| ¿Cambios de negocio no autorizados? | **Hay uno, que requiere aceptación del dueño.** El cliente ya no puede autocancelar un pedido Wompi no pagado. Está dentro de la corrección que recomendaba WP-09 ("alinear el botón con lo ejecutable") y es la causa del FAIL histórico de P23 |
| ¿Algún cambio debe revertirse? | **No.** Ninguno es innecesario ni perjudicial. Dos archivos necesitan corrección puntual (NV-01, NV-02, NV-03) |

Cambios del contrato API:

| Endpoint | Cambio | Quién puede usarlo |
|---|---|---|
| `POST /api/admin/orders/:id/reconcile-wompi` | Acepta `transactionId` en el cuerpo | admin, superadmin |
| `GET /api/admin/orders/payment-events` | Nuevo | admin, superadmin |
| `POST /api/admin/orders/payment-events/:eventId/reprocess` | Nuevo | admin, superadmin |
| `POST /api/admin/orders/:id/incidents/:incidentId/resolve` | Nuevo | admin, superadmin |
| Respuesta del detalle de pedido | Añade `allowedResolutions` | — |
| Respuesta de alertas | Añade `paymentEvents` y `oldPendingPayments` | — |
| `POST /api/webhooks/wompi` | Puede responder 503 si la consulta al proveedor falla. Antes nunca dependía de `GET` | — |

## Clasificación por archivo

| # | Archivo | Problema que justifica el cambio (¿existía?) | ¿Lo resuelve? | Seguridad, stock o dinero | Cobertura | Clasificación |
|---|---|---|---|---|---|---|
| 1 | `backend/src/app.js:87` | WP-14: el webhook consumía el limitador global (sí existía) | Sí: solo el POST exacto `/webhooks/wompi` sale del global y conserva su limitador de 100/min | Neutro | L01, L02. L02 depende de que L01 corra antes; está documentado en el código | NECESARIO Y CORRECTO |
| 2 | `controllers/adminAlertController.js:42-51` | WP-10: no había alertas de eventos ni de pendientes antiguos (sí) | Sí. Muestra los eventos no procesados y los pedidos pendientes de más de 24 h. Solo lectura y solo admin | Neutro | R18, C01 | NECESARIO Y CORRECTO. Hereda el ruido de NV-03 |
| 3 | `controllers/checkoutController.js:281, 645-661` | WP-12: el mensaje de reintento con checkout fallido no orientaba (sí). WP-09: el botón no se podía ejecutar (sí) | Sí. Con checkout fallido da un 409 orientativo. En Wompi consulta sin cancelar y siempre responde 409. La consulta usa `reconcile:true` | Pago: no cancela un intento que todavía puede aprobarse. Comportamiento de negocio: autocancelación Wompi retirada | C31, C33, R25, R11. El botón del frontend depende de `canSelfCancel` del backend (`cuenta/page.js:665`), verificado | NECESARIO Y CORRECTO. Requiere aceptación del cambio de política |
| 4 | `controllers/orderAdminController.js:43, 195-236` | WP-02: la conciliación exigía un ID que nunca llegaba (sí). WP-03: no había endpoint de resolución (sí). WP-01: no había forma de reprocesar el inbox (sí) | En gran parte. **Defectos:** (a) un ID erróneo crea una incidencia sin salida (líneas 205 y 210), que es **NV-02**; (b) el reproceso no cierra el recibo original cuando el estado consultado cambia la clave, que es **NV-03** | Dinero: nunca asocia por importe, email ni tiempo, y el ID es solo una pista consultada con llave privada (C10). Permisos: correctos (C11) | R04, C09–C13, C01, C04, C08 | NECESARIO PERO DEFECTUOSO |
| 5 | `controllers/wompiWebhookController.js` | WP-01: devolvía 200 antes de guardar cuando el evento no se podía asociar (sí) | Sí. Verifica la firma sobre `rawBody` antes del sanitizador, valida el estado y el inbox es durable antes del 200 | Seguridad: firma intacta (C02) | C01–C06, R01–R03, R19 | NECESARIO Y CORRECTO |
| 6 | `models/notification.js` | Hacía falta un aviso sin pedido para el evento financiero (WP-01/10) | Sí. `order` solo es opcional para `admin.payment_event` | Neutro | R01, R18, R19 | NECESARIO Y CORRECTO |
| 7 | `models/order.js` | Las incidencias no guardaban cómo se resolvieron (WP-03) | Sí. Añade un subdocumento `resolution` con actor, decisión, motivo y evidencia | Neutro | C14–C21 | NECESARIO Y CORRECTO |
| 8 | `models/paymentEvent.js` | El inbox exigía un pedido (WP-01) | Sí. Añade `order` nulo, estado de procesamiento, `associationError`, `source` y `providerObservation`. Sin índices nuevos: la consulta `processedAt:null` recorre la colección, lo que es aceptable con el volumen esperado | Neutro | C01–C08 | NECESARIO Y CORRECTO |
| 9 | `routes/adminOrderRoutes.js` | Rutas de WP-01/02/03 | Sí. `/payment-events` se declara antes de `/:id` y aplica `authorizeRoles("superadmin","admin")` | Permisos: correctos (R01, C11, C14) | — | NECESARIO Y CORRECTO |
| 10 | `server.js:34-35` | WP-13: los prefijos de las llaves no se validaban (sí) | Sí, fallando cerrado sin imprimir los valores | Si el secreto real no tuviera el prefijo `prod_events_`, el servidor no arranca. Es intencional y se verifica en E06 | R16 | NECESARIO Y CORRECTO |
| 11 | `services/notificationDelivery.js` | Entrega y recuperación de un aviso sin pedido | Sí. Comprueba el destinatario actual y lo da por superado si el recibo ya está procesado | Neutro | R18 | NECESARIO Y CORRECTO |
| 12 | `services/notificationEvents.js` (`paymentEventReview`) | Outbox idempotente por recibo | Sí. La clave es `(receipt, evento, destinatario)` y exige transacción | Neutro | C05, C06, R19 | NECESARIO Y CORRECTO |
| 13 | `services/notificationTemplates.js` | Plantilla del aviso nuevo | Sí, escapada | Sin XSS en correo (R16) | R16, Q13 | NECESARIO Y CORRECTO |
| 14 | `services/orderTransitions.js:39-43` | WP-09 | Sí. `canSelfCancel` queda solo para contraentrega | Cambio de negocio: ver fila 3 | R11, C30, C31 | NECESARIO Y CORRECTO, con aceptación del dueño |
| 15 | `services/orderWorkspace.js` | WP-02: el botón de conciliar exigía un `transactionId` guardado. WP-04: faltaban etiquetas | Sí | Neutro | C09 | NECESARIO Y CORRECTO |
| 16 | `services/wompiPaymentService.js` (todo el archivo) | WP-01, WP-04, WP-05 y WP-06 (todos existían) | Sí para los cuatro: C01–C06, C22–C29. **Defectos:** (a) las líneas 113-117 permiten que un estado no final consultado sustituya un estado final firmado, que es **NV-01**; (b) la línea 105 hace depender toda asociación de que `GET` traiga `payment_link_id`, que es **NV-04**. La razón, el checksum oficial que no firma vínculo ni moneda, es legítima (R20, C04) | Dinero: sin aplicación cruzada (C04, C10, C24, C28), sin `pagado` con monto discrepante (C27) y sin rehabilitación tras VOIDED (C23). El stock no cambia de política | R01–R27, C01–C29, C34 | NECESARIO PERO DEFECTUOSO, y RIESGOSO en la dependencia externa (NV-04) |
| 17 | `services/wompiService.js` (`validateConfiguration`) | WP-13 | Sí | Neutro | R16 | NECESARIO Y CORRECTO |
| 18 | `frontend/.../pedido/confirmacion/page.js` | WP-11: el pendiente se mostraba como "¡Gracias por tu compra!" (sí) | En parte. Texto neutro y 8 reconsultas cada 15 s. El sondeo solo lee; ningún parámetro del navegador confirma el pago. Sigue eliminando el `id` de la URL, lo que es correcto mientras E03 no esté verificado | Neutro | Revisado por código. No volví a ejecutar el recorrido en navegador: es la evidencia de Codex, REM-UI06 | NECESARIO Y CORRECTO (parcial respecto a WP-11) |
| 19 | `frontend/.../admin/alertas/page.js` | WP-10 | Sí | Neutro | Código | NECESARIO Y CORRECTO |
| 20 | `frontend/components/admin/OrderDetail.jsx` | WP-02/03 | Sí | Neutro | Código | NECESARIO Y CORRECTO |
| 21 | `frontend/components/admin/OrderNextAction.jsx` | WP-02: hacía falta poder introducir el ID | Sí, con un `pattern` que coincide con el del backend | Neutro. El texto aclara que el ID solo sirve para consultar | Código | NECESARIO Y CORRECTO |
| 22 | `frontend/services/orderAdminService.js` | Clientes de los endpoints nuevos | Sí | Neutro | Código | NECESARIO Y CORRECTO |
| 23 | `backend/src/services/paymentIncidentResolution.js` (nuevo) | WP-03 | Sí. Decisiones por código y rol, motivo de 10 a 1000 caracteres, evidencia contrastada con el `PaymentEvent` APPROVED guardado (importe, moneda y ambiente) y `AuditLog` en la misma transacción | Dinero: ninguna decisión marca `pagado` ni desbloquea por sí sola (C18, C21). **Menores:** NV-05 (consulta HTTP dentro de la transacción, línea 37) y NV-07 (referencia única solo por pedido, líneas 57-59) | C14–C21, C33, R09–R15, R24 | NECESARIO Y CORRECTO (con P3 menores) |
| 24 | `frontend/components/admin/PaymentEventAlerts.jsx` (nuevo) | WP-01/10 | Sí. No ofrece cerrar recibos obsoletos (NV-03) | Neutro | Código, REM-UI03 | NECESARIO Y CORRECTO |
| 25 | `frontend/components/admin/PaymentIncidentActions.jsx` (nuevo) | WP-03 | Sí. Solo ofrece las decisiones de `allowedResolutions` y el backend vuelve a validar | Neutro | Código, REM-UI02/05 | NECESARIO Y CORRECTO |

## ¿Se pudo hacer con menos cambios?

- **`wompiPaymentService.js`.** Se reescribió de forma sustancial (+171 −58 líneas en el diff). Aun así reutiliza las mismas dos fases transaccionales y la misma lógica de stock y cupón, y cada bloque responde a un hallazgo concreto. No veo un diseño claramente más pequeño que cubra a la vez WP-01, 04, 05 y 06.
- **Consulta `GET` antes de aplicar.** Es la única ampliación de diseño. Está justificada por R20 y C04: el checksum oficial firma solo `id`, `status` y `amount`. Introduce NV-01 y NV-04, que deben tratarse con la corrección acotada descrita en 04, no eliminando la defensa.
- **`paymentIncidentResolution.js`.** Su alcance, por código y no "resolver todo", es el mínimo seguro.

## Huella de no modificación

- Calculé el SHA-256 de 3.931 archivos de `docs/`, `backend/src`, `backend/test` y `frontend/src`, excluida `auditoria-claude/`, **antes y después** de ejecutar todas las pruebas: son idénticos.
- Todas las escrituras de evidencias generadas se desviaron a `evidencias/salidas/` mediante `evidencias/preservar-claude.cjs`.
- `backend/logs/` no se tocó.
- No hice commits ni cambios de código.
