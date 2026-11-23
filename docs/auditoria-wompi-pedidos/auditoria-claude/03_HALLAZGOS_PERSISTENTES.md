# 03 · Estado de los hallazgos WP-01 a WP-15

## Leyenda

**Estados de cierre:**
- **CERRADO (local):** defecto corregido y demostrado con pruebas independientes en el arnés aislado. No equivale a aprobación productiva.
- **PARCIAL:** corregido en su núcleo, con defecto residual o dependencia demostrada.
- **ABIERTO:** sin corrección, o pendiente de una decisión.
- **BLOCKED:** el cierre depende de una verificación externa no ejecutable aquí.

**Prefijos de las pruebas:**
- `C`: mis pruebas adversariales (`evidencias/adversarial.test.cjs`).
- `R`: regresiones de Codex.
- `P` y `X`: matriz original.

---

## WP-01 · P1 · Evento firmado no asociable descartado

| Campo | Valor |
|---|---|
| Estado inicial | 200 antes de guardar: el evento se perdía sin rastro (X01 FAIL) |
| Cambio realizado | El inbox se persiste siempre antes del 200, con `order` nulo, `processingState`, `associationError`, aviso outbox único y reproceso por consulta privada (`wompiPaymentService.js:66-132`, `wompiWebhookController.js`, `orderAdminController.js:220-236`) |
| Evidencia | Recibo durable sin pedido, un solo aviso, visible en alertas, sin datos sensibles (R01, C01). Un fallo de escritura da no-200 (C05, R03, R19). Ocho entregas concurrentes producen un solo recibo y un solo aviso (C06). Un evento malicioso recibe 401 y no persiste nada (C02). La recuperación posterior aplica el pago (C01, C04) |
| Prueba independiente | C01–C08c |
| Resultado | C01–C06 PASS. **C07 FAIL (NV-01):** un APPROVED firmado con `GET` rezagado (PENDING) queda `processed` / `superseded_by_provider_state`; el pedido sigue `pendiente`, sale de la bandeja y el reintento de Wompi responde 200 sin efecto. **C08 y C08c FAIL (NV-03):** recibos obsoletos permanentes |
| Riesgo residual | (1) NV-01. (2) NV-04: la asociación exige `payment_link_id` también en `GET`, campo no documentado oficialmente (verificado el 2026-11-23). Si falta, todo pago queda sin asociar y sin recuperación en la aplicación (C34). (3) Fuera de los 3 reintentos de Wompi en 24 h, la recuperación depende de que alguien revise la bandeja (WP-10) |
| Recomendación | Corregir NV-01 y NV-03 (04 §NV-01, §NV-03). Ejecutar E01 incluyendo la respuesta de `GET` |
| Estado de cierre | **PARCIAL**. Cierre externo **BLOCKED (E01, E02)** |

## WP-02 · P1 · Sin recuperación si el webhook no llega

| Campo | Valor |
|---|---|
| Estado inicial | La conciliación exigía un `transactionId` que solo trae el webhook (P13 FAIL) |
| Cambio realizado | El administrador introduce el ID visto en el panel o el comprobante de Wompi. El servidor lo consulta con la llave privada y aplica solo si el `payment_link_id` consultado corresponde inequívocamente al pedido (`orderAdminController.js:195-214`). No se implementó recuperación desde la URL de retorno, lo cual es correcto mientras E03 no esté verificado |
| Evidencia | Sin ID: 409. Con ID: 200 y pagado una sola vez. Repetición y webhook tardío sin duplicar (C09). ID de otro pedido: 409 y nada aplicado; el dueño real se concilia después (C10). Vendedor y cliente: 403; anónimo: 401 (C11). Conciliación concurrente con dos webhooks: un solo efecto (C13, R04) |
| Prueba independiente | C09–C13 |
| Resultado | C09, C10, C11 y C13 PASS. **C12 FAIL (NV-02):** un ID mal digitado crea `reconciliation_query_failed`; tras conciliar con el ID correcto, el pedido pagado sigue bloqueado (preparar → 409) y la incidencia no tiene ninguna decisión de cierre, ni siquiera para superadmin |
| Riesgo residual | NV-02. Depende de NV-04/E01: sin `payment_link_id` en `GET`, la conciliación por ID devuelve 409 siempre (C34). La detección sigue siendo manual: alerta de pendientes de más de 24 h |
| Recomendación | Corregir NV-02. E01 con `GET`. Procedimiento operativo diario de cruce entre el panel de Wompi y los pedidos |
| Estado de cierre | **PARCIAL**. **BLOCKED (E01)** |

## WP-03 · P1 · Incidencias sin resolución

| Campo | Valor |
|---|---|
| Estado inicial | Pedidos pagados legítimos bloqueados sin salida (P20, P22b, X06 FAIL) |
| Cambio realizado | `paymentIncidentResolution.js`: decisiones por código y rol, motivo, evidencia estructurada y `AuditLog` en la misma transacción |
| Evidencia | Vendedor: 403. Admin no puede atestar una devolución (403). Decisión ajena al código: 403. Incidencia de otro pedido: 404 (C14). Rechazados: importe falso, cobro de otro pedido, pago principal, URL http o `javascript:`, fecha futura, moneda distinta y motivo corto (C15). Flujo P20 correcto: devolución del cobro adicional, el pago principal sigue pagado, preparación 200 y un `AuditLog` (C16). Flujo P22b correcto: aceptación explícita del descuento con `usedCount` sin cambios (C17). Aceptar el descuento sobre un pedido no pagado: 409 (C18). Cuatro resoluciones concurrentes: un 200 y un `AuditLog` (C19). Un fallo de `AuditLog` revierte la resolución (R12) |
| Prueba independiente | C14–C21, C33 |
| Resultado | Todas PASS |
| Riesgo residual | NV-02 introduce una incidencia nueva sin salida. La atestación de devolución es declarativa: la aplicación contrasta los campos, pero no verifica el reembolso real (no hay API). NV-05 y NV-07 son P3 |
| Recomendación | Corregir NV-02. Procedimiento escrito de devolución manual con doble control |
| Estado de cierre | **CERRADO (local)** para los códigos originales. La nueva incidencia queda pendiente vía NV-02 |

## WP-04 · P1 · VOIDED ignorado

| Campo | Valor |
|---|---|
| Estado inicial | Un pedido anulado seguía como pagado y se podía despachar (P04b FAIL) |
| Cambio realizado | Un VOIDED de la transacción aplicada pasa el pedido a `rechazado` con la incidencia `payment_voided`. La precedencia es durable frente a un APPROVED antiguo. La excepción por ID aplicado funciona aunque falte el vínculo (`wompiPaymentService.js:11-16, 31-41, 52-58, 87`) |
| Evidencia | Pagado → anulado (3 entregas concurrentes): rechazado, una sola incidencia, un recibo, fuera de finanzas, preparar 409 (C22). APPROVED antiguo con `GET` rezagado en APPROVED: sigue rechazado, también tras conciliar (C23). VOIDED de otra transacción con el vínculo alterado: el pedido pagado no se toca (C24). En preparación: enviar da 409 para admin y vendedor, y cancelar repone el stock (C25). Enviado: rechazado; resolver la anulación no lo vuelve conciliable (C21). Entregado: rechazado, con incidencia y fuera de finanzas (C26) |
| Prueba independiente | C20–C26, C23 con proveedor rezagado |
| Resultado | Todas PASS |
| Riesgo residual | El stock no se repone automáticamente tras una anulación; se repone al cancelar (decisión documentada). La mercancía ya enviada o entregada requiere gestión manual. NV-06: el comprador recibe un aviso de "pago rechazado" tras la anulación de un pedido enviado (con el correo apagado por defecto) |
| Recomendación | NV-06 (P3). Procedimiento para anulaciones sobre pedidos ya despachados |
| Estado de cierre | **CERRADO (local)** |

## WP-05 · P2 · `pagado` antes de validar

| Campo | Valor |
|---|---|
| Estado inicial | Se escribía `pagado` con importe o moneda discrepantes (P21b FAIL) |
| Cambio realizado | Se reconoce el pago solo tras validar identidad, vínculo, importe y moneda dentro de la transacción. El hecho se conserva en `PaymentEvent` y en la incidencia |
| Evidencia | Importe inferior, superior o moneda USD confirmados por el proveedor: nunca `pagado`, stock intacto, preparar 409, fuera de finanzas e incidencia (C27, R06). Pago válido sin stock: `pagado` más bloqueo (R17) |
| Prueba independiente | C27 |
| Resultado | PASS |
| Riesgo residual | El FAIL histórico de P06 exige el comportamiento antiguo y debe versionarse, no revertirse (05 §4) |
| Recomendación | Versionar P06 |
| Estado de cierre | **CERRADO (local)** |

## WP-06 · P2 · Asociación por `$or` sin coherencia

| Campo | Valor |
|---|---|
| Estado inicial | `$or` entre referencia, `sku` y vínculo: un pago podía aplicarse a otro pedido (P23 FAIL) |
| Cambio realizado | Asociación solo por `payment_link_id` único. La referencia contradictoria bloquea. Una transacción ya asociada a otro pedido bloquea. El vínculo y la moneda se contrastan con `GET` privado |
| Evidencia | Referencia de otro pedido (C03). Vínculo alterado hacia B (C04). VOIDED con vínculo alterado (C24). Transacción ya aplicada a A que llega con el vínculo de B (C28). Enlace duplicado (C29). En ningún caso se paga un pedido incorrecto |
| Prueba independiente | C03, C04, C24, C28, C29 |
| Resultado | PASS |
| Riesgo residual | NV-04: el contraste exige el campo en `GET` |
| Recomendación | E01 |
| Estado de cierre | **CERRADO (local)**; **BLOCKED (E01)** |

## WP-07 · P2 · Enlaces sin vencimiento ni cierre

| Campo | Valor |
|---|---|
| Estado inicial | Sin `expires_at` ni desactivación (X07 FAIL) |
| Cambio realizado | Ninguno en la creación. La autocancelación Wompi se retiró para no prometer un cierre que no existe |
| Evidencia | X07 sigue en FAIL (matriz en modo contrato). La documentación de hoy confirma que solo existen `expires_at` y `single_use`, sin endpoint de desactivación |
| Prueba independiente | X07 (repetida). C33: un pago tardío sobre un pedido cancelado vuelve a bloquear con `approved_after_cancellation` y stock intacto |
| Resultado | FAIL (vigencia). La contención es correcta |
| Riesgo residual | Cobros sobre pedidos cancelados: ahora detectados y con salida (devolución atestada), pero no evitados |
| Recomendación | Decisión comercial de vigencia más E05 |
| Estado de cierre | **ABIERTO** (decisión y E05) |

## WP-08 · P2 · Sin reserva de stock en Wompi

| Campo | Valor |
|---|---|
| Estado inicial | Dos clientes pueden pagar la última unidad (P34, riesgo realizado) |
| Cambio realizado | Ninguno, por decisión comercial pendiente |
| Evidencia | P34 y P35 en PASS en la matriz: inventario nunca negativo y uno de los pedidos con `approved_without_stock` |
| Prueba independiente | Matriz P34 (repetida) |
| Resultado | PASS técnico con riesgo residual |
| Riesgo residual | Un cliente cobrado sin producto. Ahora tiene salida: reponer y conciliar, o cancelar y atestar la devolución |
| Recomendación | Decisión del dueño |
| Estado de cierre | **ABIERTO** (decisión) |

## WP-09 · P2 · Autocancelación Wompi inejecutable

| Campo | Valor |
|---|---|
| Estado inicial | El botón se ofrecía pero devolvía 409, y la revisión quedaba perpetua (P28 FAIL) |
| Cambio realizado | `canSelfCancel` solo aplica a contraentrega, así que el botón desaparece para Wompi. La vigilancia se archiva con `acknowledge_closed_watch` |
| Evidencia | Cliente: 409 sin cambio de estado. Cliente ajeno: 404 (C31). Flujo P28 correcto: el admin cancela, archiva las dos incidencias y `requiresReview` queda en false (C33). Contraentrega intacta (C30) |
| Prueba independiente | C30, C31, C33 |
| Resultado | PASS |
| Riesgo residual | Cambio de política para el cliente: ya no puede cancelar un Wompi pendiente por sí mismo. P23 histórico en FAIL. Es preexistente que, si el pago se aprueba después, la incidencia `cancellation_verification_pending` se cierre sola y el pedido pase a preparación (`wompiPaymentService.js:181`): la intención de cancelar del cliente se pierde (P3, preexistente) |
| Recomendación | Aceptación escrita del dueño y versionado de P23 |
| Estado de cierre | **CERRADO (local)**, condicionado a la aceptación de la política |

## WP-10 · P2 · Señales operativas insuficientes

| Campo | Valor |
|---|---|
| Estado inicial | Sin alerta de eventos no asociados ni de pendientes antiguos |
| Cambio realizado | Bandeja de eventos, alerta de pendientes de más de 24 h y aviso outbox por recibo, sin activar el correo |
| Evidencia | C01, R18, R19 |
| Prueba independiente | C01, C06 |
| Resultado | PASS (persistencia y consulta) |
| Riesgo residual | NV-01 hace que un caso no aparezca en la bandeja. NV-03 deja ruido permanente. La entrega real sigue sin verificar y las banderas siguen apagadas |
| Recomendación | NV-01, NV-03 y activación del correo en un entorno autorizado |
| Estado de cierre | **PARCIAL**; **BLOCKED (entrega)** |

## WP-11 · P3 · Comunicación al cliente

| Campo | Valor |
|---|---|
| Estado inicial | Un pendiente se mostraba como compra exitosa |
| Cambio realizado | Título neutro y sondeo acotado (8 × 15 s) |
| Evidencia | Revisión de código (`confirmacion/page.js:104-105, 544-559`) y evidencia de Codex REM-UI06. No ejecuté el navegador |
| Prueba independiente | Ninguna propia |
| Resultado | NO VERIFICADO independientemente (UI) |
| Riesgo residual | Sigue sin opción de reintento en el sitio |
| Recomendación | Decidir el reintento |
| Estado de cierre | **PARCIAL** |

## WP-12 · P3 · Fallo al crear el enlace

| Campo | Valor |
|---|---|
| Estado inicial | La clave quedaba bloqueada; una clave nueva creaba un segundo pedido (P05b) |
| Cambio realizado | Mensaje 409 orientativo con el número de pedido, más `archive_failed_checkout` |
| Evidencia | P05b PASS en la matriz |
| Prueba independiente | Matriz P05b |
| Resultado | PASS técnico con riesgo residual |
| Riesgo residual | Si el timeout ocurrió después de crearse el enlace, pueden existir un enlace pagable y un segundo pedido |
| Recomendación | Decisión operativa más soporte de Wompi |
| Estado de cierre | **ABIERTO** (externo) |

## WP-13 · P3 · Prefijos de llaves

| Campo | Valor |
|---|---|
| Estado inicial | No se validaban |
| Cambio realizado | `validateConfiguration` al arrancar |
| Evidencia | R16 |
| Prueba independiente | R16 reproducida |
| Resultado | PASS |
| Riesgo residual | La configuración real no está verificada (E06) |
| Recomendación | E06 |
| Estado de cierre | **CERRADO (local)** |

## WP-14 · P3 · Limitación de tasa del webhook

| Campo | Valor |
|---|---|
| Estado inicial | El webhook consumía el limitador global |
| Cambio realizado | Se excluye del global solo el POST exacto del webhook |
| Evidencia | L01, L02 |
| Prueba independiente | Reproducidas |
| Resultado | PASS |
| Riesgo residual | `trust proxy` en el hosting real (E06) |
| Recomendación | E06 |
| Estado de cierre | **CERRADO (local)** |

## WP-15 · P3 · Cupón de uso limitado

| Campo | Valor |
|---|---|
| Estado inicial | Sin reserva; el pedido pagado quedaba bloqueado (P22b) |
| Cambio realizado | Salida operativa `accept_discount`, sin tocar `usedCount` |
| Evidencia | C17 |
| Prueba independiente | C17 |
| Resultado | PASS |
| Riesgo residual | Se puede conceder un descuento por encima del límite (asumido de forma explícita) |
| Recomendación | Decisión comercial |
| Estado de cierre | **ABIERTO** (decisión). La salida operativa existe |

---

## Reevaluación de pruebas en verde con riesgo residual

| Prueba | Resultado verde | Por qué no basta | Estado tras la remediación |
|---|---|---|---|
| **P19** (= P30) | Una aprobación tardía tras cancelar queda en disputa con incidencia, sin stock ni venta | El enlace sigue activo, así que el cliente **puede seguir pagando un pedido cancelado** | Mejorado: ahora tiene salida auditada (C33) y vuelve a bloquear aunque se haya archivado la vigilancia. **Riesgo financiero abierto** hasta resolver WP-07 |
| **P34** | Inventario nunca negativo, una sola venta | **Un cliente queda cobrado sin producto** | Sin cambios de política. Salida: reponer y conciliar (R17) o devolución atestada. **Abierto (WP-08)** |
| **P05b** | Error controlado, sin pago ni stock | Si el timeout ocurrió después de que Wompi creó el enlace, el pedido fallido puede ser pagable y la clave nueva duplica el pedido | Mensaje mejorado y archivo operativo, pero el enlace no es consultable por pedido. **Abierto (WP-12)** |
| **P37** | Avisos encolados correctamente | **Nada sale del sistema** con la configuración actual (correo apagado) | La bandeja amplía las señales, pero NV-01 escapa de ellas y la entrega no está verificada. **Abierto (WP-10)** |
