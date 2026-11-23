# 03 · Máquina de estados real

Auditoría independiente · 2026-11-23. Fuentes: `models/order.js`, `services/orderTransitions.js`, `services/orderReadiness.js`, `services/orderOperations.js`, `services/wompiPaymentService.js`, `controllers/checkoutController.js`, `controllers/orderAdminController.js`. Las afirmaciones marcadas con un ID de prueba están **ejecutadas** (ver 05).

## 1. Dimensiones de estado (independientes entre sí)

| Campo | Valores | Significado real |
|---|---|---|
| `orderStatus` | `pendiente`, `pago_pendiente`, `pagado`, `en_preparacion`, `enviado`, `entregado`, `cancelado`, `rechazado`, `devuelto` | Estado operativo. `pagado` es etiqueta heredada; el código declara que `paymentStatus` es la fuente (`orderTransitions.js:8`) |
| `paymentStatus` | `pendiente`, `pagado`, `rechazado`, `reembolsado` | Estado económico. **`reembolsado` no lo asigna ningún código** (solo se lee) |
| `checkoutState` | `processing`, `ready`, `failed` | Si el registro del checkout terminó |
| `stockDeducted` | booleano | Si la venta descontó inventario |
| `requiresReview` + `incidents[]` | bandera + lista con `resolvedAt` | Bloquean preparación y exclusión de finanzas |
| `wompi.status` | texto del proveedor | Último estado no aprobado o el aprobado aplicado |

“Preparable” (`canFulfill`, `orderReadiness.js:9-11`) = `stockDeducted` ∧ sin incidencias activas ∧ `checkoutState=ready` ∧ (contraentrega ∨ `paymentStatus=pagado`).

## 2. Transiciones operativas permitidas (`orderTransitions.js:5-14`)

| Desde | Hacia | Condiciones adicionales |
|---|---|---|
| `pendiente`, `pago_pendiente`, `pagado` | `en_preparacion` | Contraentrega o `pagado`; `canFulfill` |
| `pendiente`, `pago_pendiente`, `pagado` | `cancelado` | Solo admin/superadmin (vendedor solo estados operativos `:17-19`) |
| `en_preparacion` | `enviado` | Pago verificado, `canFulfill`, transportadora y guía |
| `en_preparacion` | `cancelado` | admin |
| `enviado` | `entregado`, `devuelto` | — |
| `entregado` | `devuelto` | — |
| `rechazado` | `cancelado` | — (ningún código pone `orderStatus=rechazado`) |
| `cancelado`, `devuelto` | — | finales |

Efectos de `transition` (`orderOperations.js:24-43`): cancelar/devolver con `stockDeducted` repone stock; cancelar/devolver con `pagado` añade `received_payment_pending_resolution`; cancelar Wompi no pagado añade `cancelled_wompi_watch`.

Transiciones automáticas (no administrativas):

| Evento | Efecto |
|---|---|
| Crear pedido Wompi | `pago_pendiente` / `pendiente` / `stockDeducted=false` |
| Crear contraentrega | `pendiente` / `pendiente` / `stockDeducted=true` |
| Wompi APPROVED coherente con stock | `paymentStatus=pagado`, `orderStatus: pendiente|pago_pendiente → pagado`, stock −1 (P01) |
| Wompi APPROVED con anomalía | `paymentStatus=pagado` + incidencia, `orderStatus` sin cambio, sin stock (P19, P21b, P34) |
| Wompi DECLINED/ERROR/VOIDED sobre no pagado | `paymentStatus=rechazado`, `orderStatus` sin cambio (P02, P04, P05) |
| Wompi PENDING | solo `wompi.status=PENDING` (P03) |
| Cualquier no-APPROVED sobre pagado | ignorado (P12, **P04b**) |
| Recaudo contraentrega (admin, tras `entregado`, con referencia/fecha) | `paymentStatus=pagado` (P32) |
| Autocancelación cliente | `cancelado` si `canSelfCancel` y, en Wompi, la última transacción conocida no está aprobada (`checkoutController.js:630-665`) |

## 3. Transiciones prohibidas verificadas

| Prohibición | Resultado |
|---|---|
| Cliente/vendedor/anónimo fija `pagado` | 403/401 (P26) |
| Admin confirma manualmente un pago Wompi | 409 “Wompi no admite confirmación manual” (P26) |
| Inyectar `paymentStatus/orderStatus/stockDeducted/wompi` en el checkout | ignorado (P26) |
| Preparar Wompi pendiente/rechazado | 409 (P02, P03) |
| Recaudo contraentrega antes de entregar o sin evidencia | 409/400 (P32) |
| Un estado pagado retrocede por evento tardío | no retrocede (P12) |
| Pedido de otro usuario | 404 (P27) |

## 4. Mapeo Wompi → estados internos

| Wompi (docs oficiales) | Interno observado | Correcto | Nota |
|---|---|---|---|
| PENDING — “aún está siendo procesada” | sin cambio de `paymentStatus`; `wompi.status=PENDING` | Sí | No hay distinción visible entre “esperando que el cliente pague” y “PSE en proceso” (`wompi.status` solo lo ve el admin en datos crudos) |
| APPROVED — “pago completado” | `pagado` **siempre**, incluso con monto/moneda distintos | **Parcial** | P21b: `pagado` con 1 COP; cliente ve “Aprobado” (WP-05) |
| DECLINED | `rechazado` | Sí | Pedido sigue abierto; reintento posible en el mismo enlace (P18) |
| ERROR | `rechazado` | Sí | Se trata como rechazo definitivo de ese intento |
| VOIDED — “anulada (solo tarjetas)” | `rechazado` si no estaba pagado; **ignorado si estaba pagado** | **No** | P04b: pedido sigue `pagado` y pasa a preparación (WP-04) |
| Evento sin pedido asociable | descartado, 200 | **No** | X01 (WP-01) |
| Otros tipos (`nequi_token.updated`, …) o entorno distinto | 200 ignorado | Sí | P25 |

## 5. Contraentrega

`pendiente/pendiente/stockDeducted=true` desde la creación; preparable de inmediato (P31). El recaudo es un acto separado, solo admin, tras `entregado`, con referencia y fecha no futura (P32). Finanzas solo cuenta el pedido como venta cuando se registra el recaudo (`financeCriteria.js`). No genera transacción ni enlace Wompi (P31: 0 llamadas al proveedor).

## 6. Cancelaciones y reintentos

- **Cancelar ≠ reembolsar**: ninguna ruta llama a anulación o reembolso del proveedor (P29: 0 llamadas; P40 N/A).
- **Reintento**: tras `DECLINED`, el mismo enlace (`single_use` solo se cierra tras APROBADO según docs) admite otra transacción; el sistema la aplica (P18) y conserva ambas en `PaymentEvent`, pero `Order.wompi.transactionId` solo guarda la última.
- **El enlace sigue vivo tras cancelar** y no caduca (`expires_at` no se envía): un pago posterior entra como `approved_after_cancellation` (P19, X02).
- **Autocancelación Wompi**: se ofrece al cliente (`canSelfCancel=true`) pero falla siempre si no hay transacción registrada y deja una incidencia que nadie puede cerrar (P28).

## 7. Contradicciones encontradas

1. `paymentStatus=pagado` se escribe **antes** de las validaciones (`wompiPaymentService.js:25-31`), contradiciendo el propio comentario “paymentStatus remains authoritative” y el principio de evidencia consistente.
2. `orderStatus=pagado` (etiqueta operativa) coexiste con `paymentStatus=pagado` y un cobro anulado (P04b).
3. `incidents[].resolvedAt` existe en el modelo, pero solo se rellena automáticamente para tres códigos (`wompiPaymentService.js:68-71`); el resto de códigos no tiene salida (X06).
4. `canSelfCancel` (UI) y `cancelMyOrder` (servidor) no coinciden para pedidos Wompi sin transacción (P28).
5. `reembolsado` y `orderStatus=rechazado` están en los enums pero nada los asigna.
