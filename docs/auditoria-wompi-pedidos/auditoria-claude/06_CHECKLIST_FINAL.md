# 06 · Checklist final

Ninguna casilla autoriza un despliegue.

**Tipos de evidencia:**
- **SB:** evidencia real de Sandbox.
- **PR:** evidencia real de producción.
- **LO:** prueba local ejecutada.
- **SI:** simulación.
- **DO:** verificación documental.
- **BL:** bloqueo no resuelto.

## 1. Bloqueantes

| ☐ | Tarea | Evidencia actual | Tipo |
|---|---|---|---|
| ☐ | **V-01**: contener el webhook Nequi sin firma en la versión productiva | Plan preparado (`remediacion/06` §V-01). **No ejecutado.** El 410 local (C32) no protege lo desplegado | BL |
| ☐ | **E01**: en una transacción de Link de Sandbox, que el evento **y** `GET /v1/transactions/{id}` traigan `payment_link_id` idéntico (NV-04) | Documentación: en `GET` no está documentado y el ejemplo de evento muestra `null` | DO + BL |
| ☐ | Corregir NV-01 y NV-02 y repetir `adversarial.test.cjs` sin FAIL (salvo los que queden documentados) | C07 y C12 en FAIL | LO |
| ☐ | Aceptación escrita del dueño del cambio de autocancelación Wompi (WP-09) y versionado de P06/P23 | Pendiente | — |

## 2. Dependencias externas E01–E06

| ID | Qué falta | Estado | Tipo |
|---|---|---|---|
| E01 | Evento y `GET` de un Link con su vínculo, importe, moneda y ambiente (payload redactado) | No ejecutado | BL |
| E02 | Firma real recibida por HTTPS público: 200 tras el inbox y la repetición no duplica | No ejecutado | BL |
| E03 | Si el `redirect_url` de un Link recibe el `id` | No documentado. No ejecutado. La remediación no depende de él (correcto) | DO + BL |
| E04 | Rechazo y reintento en el mismo Link; `single_use` tras aprobar | No ejecutado | BL |
| E05 | Mecanismo soportado de cierre o desactivación | Solo `expires_at` y `single_use` documentados; sin PATCH | DO + BL |
| E06 | URL de eventos del panel, TLS, llaves por ambiente, `trust proxy`, replica set, índices, backup | No ejecutado | BL |

## 3. Configuración e infraestructura

| ☐ | Tarea | Tipo |
|---|---|---|
| ☐ | Webhook de producción apuntando a `https://<api>/api/webhooks/wompi`, accesible y con TLS válido | BL |
| ☐ | `WOMPI_ENV=production`, `NODE_ENV=production`, llave `prv_prod_` y secreto `prod_events_`. El arranque falla si no coinciden (R16, LO) | LO + BL |
| ☐ | El secreto de eventos es distinto de la llave privada y del secreto de integridad | BL |
| ☐ | MongoDB destino en replica set (transacciones obligatorias) | BL |
| ☐ | Índices únicos existentes en el destino: `PaymentEvent.key`, `Notification.eventKey`, `Order.orderNumber`, `Order.idempotencyKey`. No hay índices nuevos | LO + BL |
| ☐ | Backup restaurado y probado | BL |
| ☐ | `trust proxy` adecuado detrás del proxy real; limitador del webhook (L01/L02, LO) | LO + BL |

## 4. Operación financiera

| ☐ | Tarea | Tipo |
|---|---|---|
| ☐ | Entrega real de correo (`TRANSACTIONAL_NOTIFICATIONS_ENABLED`, Resend, `ADMIN_NOTIFY_EMAIL`) probada con un buzón | BL |
| ☐ | Responsable y frecuencia de revisión de la bandeja de eventos y de los pendientes de más de 24 h | BL |
| ☐ | Cruce diario entre el panel de Wompi y los pedidos (la recuperación sin webhook es manual) | BL |
| ☐ | Procedimiento escrito de devolución manual con doble control (la atestación no verifica el reembolso) | BL |
| ☐ | Decisión de vigencia del enlace (WP-07) | BL |
| ☐ | Decisión sobre la última unidad (WP-08) | BL |
| ☐ | Decisión sobre checkouts de resultado incierto (WP-12) | BL |
| ☐ | Decisión sobre cupones de uso limitado (WP-15) | BL |
| ☐ | Instrucción al personal: no anular cobros desde el panel de Wompi sin registrar la gestión del pedido | BL |

## 5. Pruebas con medios de Sandbox

Todas están bloqueadas (BL):

| ☐ | Medio | Casos |
|---|---|---|
| ☐ | Tarjeta | Aprobada (4242…) y rechazada (4111…) |
| ☐ | Nequi | Aprobado (3991111111) y rechazado (3992222222) |
| ☐ | PSE | Banco que aprueba y banco que rechaza |
| ☐ | Mismo enlace | Reintento tras un rechazo |
| ☐ | Tarjeta | Anulación de un cobro aprobado: verificar WP-04 con un evento real |
| ☐ | Producción | Compra controlada de bajo monto con devolución manual documentada |

## 6. Regresiones locales que deben quedar en verde tras las correcciones

| ☐ | Conjunto | Tipo |
|---|---|---|
| ☐ | `adversarial.test.cjs` (35 pruebas), con C07, C08, C08c y C12 en PASS | LO |
| ☐ | `regresiones.test.cjs` 27/27 y `limites.test.cjs` 2/2 | LO |
| ☐ | Suite histórica 273/275 más las versiones nuevas de P06 y P23 | LO |
| ☐ | Matriz en modo contrato, donde solo puede quedar X07 mientras WP-07 siga abierto | LO |
