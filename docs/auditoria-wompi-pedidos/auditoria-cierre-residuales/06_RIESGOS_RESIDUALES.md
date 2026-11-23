# 06 · Riesgos residuales

## 1. Locales (no bloquean el cierre local)

| ID | Prioridad | Riesgo | Estado |
|---|---|---|---|
| RC-01 | P3 | El seguimiento financiero de los eventos archivados no tiene salida y mantiene el contador de alertas por encima de cero | Abierto; decisión del dueño (`05`) |
| NV-05 | P3 | Consulta HTTP a Wompi dentro de una transacción de Mongo en `paymentIncidentResolution.js:37` | Abierto, fuera del alcance de este cierre |
| NV-06 | P3 | Aviso "pago no completado" al comprador tras anular un pedido ya enviado | Abierto |
| NV-07 | P3 | La referencia de devolución solo es única dentro del pedido | Abierto |
| OBS-3 (ronda 2) | — | `npm test` depende del arnés guardado en `docs/auditoria-*` | Abierto |
| Integración | — | El trabajo concurrente de checkout y municipios sigue sin commit en el mismo árbol | Revisar y commitear por separado |

## 2. Externos (mantienen el NO-GO de producción)

| ID | Estado | Evidencia |
|---|---|---|
| NV-04 / E01 | **BLOCKED.** Sin una transacción real de Sandbox que demuestre `payment_link_id` en el evento **y** en `GET` (y el formato del ID) | Ninguna nueva en esta ronda |
| V-01 | **ABIERTO.** Sin contención demostrada del webhook Nequi en producción | Ninguna nueva |
| E02–E06 | **BLOCKED.** Firma real, retorno, reintento, vigencia e infraestructura | Solo la creación de un enlace de Sandbox sin transacción (`expiresAt: null`), ya registrada en `auditoria-claude-2/06` |

## 3. Decisiones comerciales pendientes

| Hallazgo | Estado |
|---|---|
| WP-07: enlaces sin vencimiento (X07 FAIL) | Pendiente |
| WP-08: última unidad | Pendiente |
| WP-09: retirada de la autocancelación (P23 original FAIL, P23-v2 PASS) | Aceptación escrita pendiente |
| WP-12: checkout con resultado incierto | Pendiente |
| WP-15: cupones de uso limitado | Pendiente |
| P06: el original exige el comportamiento antiguo | Sustitución formal por P06-v2 pendiente de aprobación |
