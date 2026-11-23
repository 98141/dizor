# 06 · Bloqueos externos y riesgos comerciales

**Tipos de evidencia:**
- **SB:** evidencia real de Sandbox.
- **PR:** evidencia real de producción.
- **LO:** prueba local ejecutada.
- **SI:** simulación.
- **DO:** documentación oficial.
- **BL:** bloqueo sin resolver.

**Ningún mock ni ninguna prueba local de esta auditoría cuenta como SB ni como PR.**

## 1. NV-04 / E01: `payment_link_id` en el evento **y** en `GET /v1/transactions/{id}`

| Aspecto | Estado |
|---|---|
| Qué exige el código | La asociación se hace solo por `payment_link_id`. El contraste del webhook exige que el `GET` privado traiga el mismo vínculo, la misma moneda y el mismo importe (`wompiPaymentService.js:122`). La conciliación y el reproceso usan el `tx` del `GET` (`findAssociation`). Codex no lo flexibilizó, que es lo correcto |
| Documentación oficial (DO, consultada el 2026-11-23 en la ronda anterior) | `payment_link_id` **no está documentado** en la respuesta de `GET /v1/transactions/{id}`, y el ejemplo de evento lo muestra con valor `null` |
| Prueba local (LO) | C34 PASS: sin vínculo en `GET`, nada se aplica a otro pedido (fallo seguro), pero el pago no se aplica ni por webhook, ni por conciliación, ni por reproceso |
| Evidencia real | **Ninguna.** Ni Codex ni yo ejecutamos una transacción de Sandbox. El frente de checkout creó un enlace en Sandbox, pero **sin transacción** (§3). No acredita E01 |
| Estado | **BLOCKED. Mantiene el NO-GO de producción** |

**Procedimiento E01**, a cargo de un operador autorizado, con las llaves de Sandbox y nunca de producción:
1. Crear un Payment Link de Sandbox con un pedido ficticio.
2. Pagar con el medio de prueba oficial (tarjeta `4242…`).
3. Capturar el evento recibido por HTTPS. Redactar email, teléfono, dirección, tokens y cabeceras.
4. Consultar `GET /v1/transactions/{id}` desde el backend con la llave privada.
5. Comparar `id`, `payment_link_id`, `amount_in_cents`, `currency`, `status` y el ambiente.
6. Comprobar además que el `id` cumple `^[A-Za-z0-9_-]{1,150}$` (OBS-1).
7. Distinguir lo que **garantiza la documentación** de lo **observado** en esa transacción: un solo ejemplo no prueba una garantía general.

**Si `GET` no trae el vínculo**, mantener el NO-GO y elegir una alternativa con soporte oficial. Estas dos se ajustan a la documentación de Wompi:
- **Web Checkout** con `reference = orderNumber` y firma de integridad (`reference + amount_in_cents + currency + integrity_secret`). La referencia queda firmada y se devuelve en el evento y en `GET`.
- Pedir a Wompi por escrito un campo de asociación garantizado para Links en ambas vías.

**No se debe** eliminar la validación de asociación ni sustituirla por importe, correo o proximidad temporal: reabriría WP-06 (C04, C24, C28).

## 2. V-01: webhook Nequi antiguo en producción

| Aspecto | Estado |
|---|---|
| Local (LO) | La ruta responde 410 (C32 PASS). Además, el commit `23ce3a6` incluye `paymentMethods.js`, que impide ofrecer Nequi en el checkout público aunque se activen sus banderas (`checkout.test.js` PASS) |
| Producción (PR) | **Sin evidencia.** Un cambio en el repositorio local no protege la versión desplegada |
| Estado | **ABIERTO / BLOCKED.** Ejecutar la contención descrita en `remediacion/06` §V-01 y conservar la evidencia (petición de prueba sin firma contra producción con respuesta 410 o 404, y versión desplegada) |

## 3. E02 a E06

| ID | Qué falta | Estado | Tipo |
|---|---|---|---|
| E02 | Firma real recibida por HTTPS público: 200 tras el inbox; la repetición no duplica | No ejecutado | BL |
| E03 | Si el `redirect_url` de un Link recibe el `id` de la transacción | No documentado; no ejecutado. La remediación no depende de él | DO + BL |
| E04 | Rechazo y reintento en el mismo Link; `single_use` tras aprobar | No ejecutado | BL |
| E05 | Vigencia y desactivación del enlace | **Nueva evidencia real (SB), parcial:** `docs/checkout-evidencias/sandbox-link.json` es una creación real de enlace en el API de Sandbox hecha por el frente de checkout, sin transacción. Respondió `expiresAt: null`. Confirma que los enlaces creados hoy **no vencen** (WP-07 abierto). Sigue sin existir un endpoint documentado para desactivarlos | SB (parcial) + BL |
| E06 | URL de eventos del panel, TLS, llaves por ambiente, `trust proxy`, replica set, índices y backup en el destino | No ejecutado. Nota: el `.env` local tiene llaves de Sandbox (`prv_test_`), según el propio script del frente de checkout; no lo abrí | BL |

**Aviso de seguridad.** El script `docs/checkout-evidencias/sandbox-link.cjs` lee `backend/.env` y llama al API real de Sandbox. Tiene un guardarraíl que rechaza las llaves de producción. Aun así, ejecutarlo crea enlaces reales en la cuenta Sandbox. **No lo ejecuté.**

## 4. Riesgos comerciales pendientes

No implemento soluciones; solo documento su estado.

| Hallazgo | Impacto | Estado | Evidencia |
|---|---|---|---|
| WP-07 · Enlaces sin vencimiento | Un enlace antiguo puede pagarse días después, con precio y stock desactualizados. El sistema lo detecta (`approved_after_cancellation`, `approved_without_stock`), pero el dinero ya está cobrado y hay que devolverlo a mano | **ABIERTO.** Decisión del dueño sobre `expires_at` | X07 FAIL (LO), `expiresAt: null` (SB) |
| WP-08 · Última unidad | Dos clientes pueden pagar la misma unidad. Uno queda cobrado sin producto, con su incidencia (P34, Q05) | **ABIERTO.** Decisión: reserva temporal o aceptación con devolución | P34 y Q05 PASS (lo detectan, no lo impiden) |
| WP-12 · Checkout con resultado incierto | Si falla la creación del enlace, el pedido queda `failed` con vigilancia. Existe una salida administrativa (`archive_failed_checkout`) | **ABIERTO** (externo y decisión) | P05b PASS |
| WP-15 · Cupones de uso limitado | Dos pagos pueden consumir el mismo cupón de un solo uso. Se detecta (`coupon_reconciliation`) y se resuelve con `accept_discount` | **ABIERTO** (decisión). La salida operativa existe | C17 PASS, P22b FAIL en el flujo antiguo |
| WP-09 · Autocancelación | El cliente ya no puede autocancelar un Wompi pendiente. P23-v2 documenta la conducta | **Aceptación escrita del dueño PENDIENTE** | P23 FAIL (original) y P23-v2 PASS |
