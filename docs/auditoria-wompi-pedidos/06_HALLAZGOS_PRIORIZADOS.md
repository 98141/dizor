# 06 · Hallazgos priorizados

Auditoría independiente · 2026-11-23. Ningún hallazgo se ha corregido (tarea solo de auditoría). Reproducción: `node docs/auditoria-wompi-pedidos/evidencias/auditoria-wompi.cjs` (ver 05 §1).

**No se demostró ningún P0**: webhooks falsificados, manipulación de monto, confirmación manual o desde el cliente y uso de transacciones ajenas quedaron bloqueados. Sí se demostraron cuatro P1 que impiden operar con dinero real con seguridad.

| ID | Sev. | Tipo | Título | Pruebas |
|---|---|---|---|---|
| WP-01 | P1 | Defecto confirmado + verificación bloqueada | Pagos auténticos no asociables se descartan en silencio; la asociación depende de un campo no garantizado | X01, E01 |
| WP-02 | P1 | Defecto confirmado | Sin recuperación de un pago aprobado si el webhook no llega | P13 |
| WP-03 | P1 | Defecto confirmado | Las incidencias no se pueden resolver; pedidos pagados legítimos quedan bloqueados | X06, P20, P22b, P28 |
| WP-04 | P1 | Defecto confirmado | `VOIDED` posterior a `APPROVED` se ignora y el pedido sigue despachable | P04b |
| WP-05 | P2 | Defecto confirmado | `pagado` se escribe antes de validar monto, moneda y coherencia | P21b |
| WP-06 | P2 | Defecto confirmado (no explotable externamente) | Asociación evento→pedido por `$or` sin validar coherencia | P23 |
| WP-07 | P2 | Defecto confirmado | Enlaces sin vencimiento ni cierre al cancelar: cobros sobre pedidos cancelados | X07, P19, X02 |
| WP-08 | P2 | Riesgo realizado | Sin reserva de stock: dos clientes pueden pagar la última unidad | P34, P35 |
| WP-09 | P2 | Defecto confirmado | Autocancelación Wompi ofrecida pero inejecutable; revisión perpetua | P28 |
| WP-10 | P2 | Riesgo | Señales operativas insuficientes para discrepancias financieras | P37, X01, P06 |
| WP-11 | P3 | Riesgo UX | Comunicación al cliente tras Wompi pendiente/rechazado | P38, código |
| WP-12 | P3 | Defecto menor | Fallo al crear enlace bloquea la clave y duplica pedidos | P05b |
| WP-13 | P3 | Riesgo | Prefijos de llaves no validados contra el entorno | código |
| WP-14 | P3 | Riesgo | Webhook sometido a limitación por IP | código |
| WP-15 | P3 | Riesgo | Cupón de uso limitado no se reserva en pedidos Wompi | P22b |

---

## WP-01 · P1 · Pagos auténticos no asociables se descartan en silencio

- **Descripción**: el webhook busca el pedido por `tx.reference`, `tx.sku` o `tx.payment_link_id`. En Links de pago la referencia la genera Wompi y `sku` no existe en el contrato del evento; solo queda `payment_link_id`, que la documentación oficial **no garantiza** (sus ejemplos lo muestran `null`). Si no hay coincidencia, responde 200 y no guarda ninguna evidencia, ni registra, ni alerta.
- **Evidencia**: `backend/src/controllers/wompiWebhookController.js:13-18` (`if (!refs.length) return 200`; `if (!order) return 200`). X01: evento APPROVED firmado sin `payment_link_id` → 200, 0 `PaymentEvent`, pedido `pendiente`. Las pruebas anteriores del repositorio asociaban por `sku` (`docs/auditoria-admin/cierre-fase1/independiente.test.js`, `txFor`), por eso no detectaron el problema.
- **Reproducción segura**: escenario X01 del arnés.
- **Impacto**: si en producción las transacciones de un Link no traen `payment_link_id`, **todos** los pagos Wompi quedarían cobrados y sus pedidos pendientes, sin rastro en el sistema. Aun con el campo poblado, cualquier desajuste (enlace creado a mano en el panel, pedido borrado, error de escritura del `paymentLinkId` tras crear el enlace: `checkoutController.js:384-389` guarda el id fuera de transacción) se pierde en silencio tras 200 (Wompi no reintenta).
- **Causa**: diseño heredado de Widget (referencia = número de pedido) aplicado a Links; respuesta 200 antes de preservar la evidencia.
- **Corrección recomendada**: (1) verificar E01 en Sandbox antes de nada; (2) persistir **todo** evento con firma válida en `PaymentEvent` (o una bandeja de eventos no asociados) antes de responder, con alerta administrativa para los no asociados; (3) si E01 falla, cambiar de modalidad (Web Checkout con `reference = orderNumber` y firma de integridad) o resolver la asociación consultando el enlace.
- **Prueba de regresión**: X01 debe dejar 1 registro y 1 aviso; P01 con una transacción real de Sandbox.
- **Criterio de cierre**: evidencia de Sandbox con `payment_link_id` poblado (o nueva modalidad verificada) y X01 en PASS.

## WP-02 · P1 · Sin recuperación de un pago aprobado si el webhook no llega

- **Descripción**: la conciliación administrativa exige `wompi.transactionId`, que solo escribe el webhook. Si el evento nunca llega (URL mal configurada, 3 reintentos agotados, caída prolongada, 429), no hay ninguna vía: el frontend **borra** el `id` de transacción que Wompi añade a la redirección, el backend no tiene endpoint para recibirlo, no hay tarea de conciliación periódica, el admin no puede introducir un id y la API de Links no lista transacciones (no documentado).
- **Evidencia**: `orderAdminController.js:194-205` (`:198` 409); `orderWorkspace.js:41` (`canReconcile` requiere `transactionId`); `frontend/src/app/(shop)/pedido/confirmacion/page.js:528-531`; `checkoutController.js:648-650`. P13: tx aprobada en el proveedor, conciliación 409, cliente ve `pendiente`.
- **Impacto**: cliente cobrado, pedido nunca preparado, sin señal en el sistema; requiere que el cliente reclame y que alguien cruce manualmente el panel de Wompi con la base de datos.
- **Corrección recomendada**: capturar el `id` de la redirección y enviarlo a un endpoint que **solo** consulte `GET /v1/transactions/{id}` con llave privada y verifique `payment_link_id` = enlace del pedido antes de aplicar; permitir al admin conciliar introduciendo un id verificado; tarea periódica que liste pedidos Wompi pendientes antiguos para revisión.
- **Prueba de regresión**: P13 → `pagado` vía consulta autenticada; intento con id de otro enlace → rechazado.
- **Criterio de cierre**: P13 en PASS y E03 verificado en Sandbox.

## WP-03 · P1 · Incidencias sin resolución; pedidos pagados bloqueados

- **Descripción**: `incidents[].resolvedAt` solo se rellena automáticamente para `payment_processing_failed`, `approved_without_stock` (misma tx) y `cancellation_verification_pending` cuando llega un APPROVED coherente (`wompiPaymentService.js:68-71`). No existe ruta ni controlador para cerrar las demás. Mientras exista una incidencia abierta, `canFulfill` es falso y el pedido sale de finanzas.
- **Evidencia**: X06 (rutas `adminOrderRoutes.js` sin resolución; ningún controlador escribe `resolvedAt`); P20 (pago adicional: pedido legítimo pagado, preparar 409); P22b (cupón excedido: pagado, preparar 409); P28 (cancelado con `requiresReview` permanente); `orderReadiness.js:9-11`.
- **Impacto**: pedidos pagados que no pueden despacharse desde la aplicación; la bandeja “Requieren revisión” crece sin salida y oculta discrepancias reales; la única salida es editar la base de datos a mano, sin auditoría.
- **Corrección recomendada**: acción administrativa (admin/superadmin) de resolución por incidencia con motivo obligatorio, evidencia (p. ej. id de devolución en Wompi), registro en `statusHistory` y `AuditLog`; reglas por código (p. ej. `additional_approved_payment` solo se cierra registrando la devolución).
- **Prueba de regresión**: P20/P22b → resolver con motivo → preparar 200; vendedor → 403; incidencia resuelta auditada.
- **Criterio de cierre**: P20, P22b, P28 y X06 en PASS.

## WP-04 · P1 · `VOIDED` tras `APPROVED` se ignora y el pedido sigue despachable

- **Descripción**: cualquier estado no aprobado sobre un pedido `pagado` se ignora (`wompiPaymentService.js:80`), incluido `VOIDED` de la **misma** transacción aprobada. La docs define VOIDED como transacción anulada (tarjetas).
- **Evidencia**: P04b: evento VOIDED guardado en `PaymentEvent`, pedido sigue `pagado/pagado`, sin incidencia, **`en_preparacion` → 200**.
- **Impacto**: si se anula un cobro con tarjeta (desde el panel de Wompi o vía API por cualquier motivo), el sistema seguirá mostrándolo pagado, contándolo como venta y permitiendo despacharlo. Escalaría a P0 si el negocio usa la anulación desde el panel como forma de cancelar.
- **Corrección recomendada**: tratar `VOIDED` del `transactionId` aplicado como evento financiero: incidencia bloqueante, salida de finanzas y estado económico no pagado; nunca ignorarlo.
- **Prueba de regresión**: P04b → preparar 409 y finanzas 0.
- **Criterio de cierre**: P04b en PASS.

## WP-05 · P2 · `pagado` antes de validar

- **Descripción**: ante un APPROVED, `paymentStatus=pagado` se escribe con `updateOne` antes de comprobar monto, moneda, transacción adicional o cancelación.
- **Evidencia**: `wompiPaymentService.js:25-31` vs `:40-49`. P21b: APPROVED de 100 centavos → `pagado`; el cliente ve `pagado` (“Aprobado”, “Total pagado” en `confirmacion/page.js:34, 478`); preparación bloqueada (409).
- **Impacto**: estado económico que afirma un pago completo con evidencia inconsistente; contradice el principio rector. No explotable como se probó (el monto del enlace lo fija Wompi) y la preparación queda bloqueada.
- **Corrección recomendada**: registrar el hecho financiero (`PaymentEvent`, incidencia) sin `paymentStatus=pagado` cuando monto/moneda/enlace no coinciden; usar un estado económico de disputa.
- **Regresión / cierre**: P21b en PASS.

## WP-06 · P2 · Asociación por `$or` sin coherencia

- **Descripción**: `findOne` con `$or` por referencia, sku o enlace devuelve el primer documento en orden natural; `processTransaction` no verifica que `payment_link_id` coincida con el enlace del pedido.
- **Evidencia**: `wompiWebhookController.js:13-17`; P23: con B más antiguo, el pago con el enlace de A queda aplicado a B sin incidencia.
- **Impacto**: aplicación del dinero a otro pedido si alguna vez una referencia coincide con un número de pedido (p. ej. migrar a Widget/Web Checkout manteniendo este código). No explotable por terceros sin el secreto de integridad.
- **Corrección**: un único criterio de asociación según la modalidad, con verificación cruzada y rechazo/incidencia ante contradicción.
- **Regresión / cierre**: P23 en PASS.

## WP-07 · P2 · Enlaces sin vencimiento ni cierre

- **Descripción**: no se envía `expires_at` (campo documentado) y ninguna acción desactiva el enlace al cancelar (la docs no documenta la desactivación). La autocancelación del cliente solo consulta la última transacción conocida.
- **Evidencia**: `wompiService.js:22-31`; X07 (`expires_at` nulo); P19 (enlace activo tras cancelar); X02 (cliente cancela tras rechazo y paga después → `cancelado`+`pagado`).
- **Impacto**: cobros sobre pedidos cancelados o con precios/stock ya cambiados; devoluciones manuales. Detectados con incidencia (no hay pérdida silenciosa).
- **Corrección**: vigencia acotada en el enlace; verificar con Wompi un mecanismo de desactivación (E05); impedir autocancelación mientras el enlace siga activo.
- **Regresión / cierre**: X07 y X02 en PASS.

## WP-08 · P2 · Sin reserva de stock en Wompi

- **Descripción**: política existente: el stock de Wompi se descuenta al aprobar (`checkoutController.js:332-333`). Dos compradores pueden pagar la misma última unidad.
- **Evidencia**: P34: ambos `pagado`, stock 0, uno con `approved_without_stock`. P35: recuperable solo si se repone stock.
- **Impacto**: en piezas artesanales únicas, cobro sin producto y devolución manual. Inventario consistente (nunca negativo).
- **Corrección**: decisión comercial (reserva temporal ligada a la vigencia del enlace, o aviso explícito); sin imponerla aquí.
- **Cierre**: política documentada y aceptada; si se adopta reserva, P34 sin cobros excedentes.

## WP-09 · P2 · Autocancelación Wompi inejecutable y revisión perpetua

- **Descripción**: `canSelfCancel` devuelve verdadero para Wompi `pago_pendiente`, pero el servidor responde 409 si no hay `transactionId` y añade `cancellation_verification_pending`. Toda cancelación de Wompi no pagado añade `cancelled_wompi_watch`, que nunca se cierra.
- **Evidencia**: `orderTransitions.js:39-41`; `checkoutController.js:644-650`; `orderOperations.js:38-40`; `frontend/src/app/(auth)/cuenta/page.js:665`; P28.
- **Impacto**: botón roto para el cliente; pedidos cancelados sin dinero quedan para siempre en “Requieren revisión”.
- **Corrección**: alinear el botón con lo ejecutable; incidencias de vigilancia con cierre automático o manual (WP-03).
- **Regresión / cierre**: P28 en PASS.

## WP-10 · P2 · Señales operativas insuficientes

- **Descripción**: las señales existentes son de consulta (bandeja de revisión, página de alertas). Los correos dependen de `TRANSACTIONAL_NOTIFICATIONS_ENABLED=true`, Resend y `ADMIN_NOTIFY_EMAIL` (`server.js:36-38`); sin bandera, ni siquiera corre la recuperación de incidencias. No hay alerta para: evento no asociado (WP-01), webhooks 5xx repetidos (solo log), pagos pendientes antiguos, pedidos Wompi sin evento tras N horas.
- **Evidencia**: P37 (avisos encolados correctamente, entrega no verificada); `notificationDelivery.js:139-170`; X01.
- **Impacto**: discrepancias financieras detectadas solo si alguien revisa el panel.
- **Corrección**: alertas push (correo u otro canal) para discrepancias financieras, eventos no asociados y errores persistentes de aplicación; revisar periódicamente pendientes antiguos.
- **Cierre**: alerta demostrada en entorno autorizado para X01, P14(b) y P21b.

## WP-11 · P3 · Comunicación al cliente

- Pago pendiente titula “¡Gracias por tu compra!” (P38); sin actualización automática; tras rechazo o abandono no hay botón de reintento en el sitio (solo en el correo, si está activado); el carrito se vacía antes de redirigir a Wompi (`checkout/page.js:314-321`).
- Corrección: título neutro para pendiente, sondeo acotado del estado, reintento con enlace vigente verificado. Cierre: prueba E2E.

## WP-12 · P3 · Fallo al crear enlace

- P05b: la misma clave queda en 409 permanente (“Conserva la misma clave e inténtalo después”) aunque el pedido ya es `failed`; el reintento con clave nueva crea otro pedido y el fallido queda en revisión sin salida.
- Corrección: permitir reintentar la creación del enlace para el mismo pedido o cerrar el fallido de forma controlada.

## WP-13 · P3 · Prefijos de llaves

- `server.js:28-31` exige `WOMPI_ENV=production` en producción, pero no valida que las llaves sean `prv_prod_`/`prod_events_`. Un error deja los pagos sin confirmar (fallo cerrado). Corrección: validación al arrancar.

## WP-14 · P3 · Limitación de tasa del webhook

- `/api/webhooks/wompi` está bajo el limitador global (300/15 min por IP, `app.js:105`) y `webhookLimiter` (100/min). Un 429 consume uno de los 3 reintentos de Wompi. Riesgo bajo al volumen actual. Corrección: excluir el webhook del limitador global y verificar `trust proxy` en el destino.

## WP-15 · P3 · Cupones de uso limitado

- En Wompi el cupón se valida al crear y se consume al aprobar (`checkoutController.js:296-329`, `wompiPaymentService.js:74-79`); varios pedidos simultáneos pueden obtener el descuento (P22b). Corrección: reservar o decidir la política (ya listada como pendiente en `docs/auditoria-admin/CHECKLIST_DESPLIEGUE_PENDIENTE.md`).
