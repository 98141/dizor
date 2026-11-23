# 03 · Validaciones con Wompi real (E01–E05)

**Tipos de evidencia:**
- **SB:** Sandbox real.
- **PR:** producción real.
- **LO:** prueba local.
- **SI:** simulación.
- **DO:** documentación oficial.

Revisé los archivos de `preproduccion/evidencias/`:
- `sandbox-transaccion-real.json`, `sandbox-preflight.json`, `sandbox-expiracion-real.json`, `sandbox-real.json` y `sandbox-session.txt`.
- `browser-sandbox-observaciones.json` y la captura `sandbox-aprobado.png`.

Comprobaciones sobre esa evidencia:
- **Coherencia:** las horas, el importe, el estado y los ID redactados (SHA-256 truncado) coinciden entre los archivos y con la captura.
- **Secretos:** ninguno. Busqué llaves `prv_`, secretos `*_events_` y `*_integrity_` y URI de Mongo con credenciales: 0 coincidencias.
- **Datos personales:** la captura solo muestra datos sintéticos y la tarjeta oficial de prueba enmascarada (`****4242`).
- **ID en claro:** la captura muestra el ID completo de la transacción de Sandbox. Es de prueba, no sensible, y sirve para comprobar OBS-1: el formato real (`<dígitos>-<dígitos>-<dígitos>`) cumple el patrón `^[A-Za-z0-9_-]{1,150}$`.

## E01 · Asociación transacción ↔ enlace ↔ pedido

| Requisito | Estado | Tipo |
|---|---|---|
| `GET /v1/transactions/{id}` privado trae `payment_link_id` igual al enlace | **Cumplido en una muestra**: tarjeta aprobada, COP 150.000, Sandbox | SB |
| El webhook firmado trae `payment_link_id` | **No verificado.** No se recibió ningún webhook auténtico (`authenticReceived: 0`) | BL |
| El enlace pertenece a un pedido creado por el checkout actual | **No.** Se pagó un enlace **preexistente** de un piloto, sin pedido en DIZOR. El intento de crear un pedido y su enlace con el código actual **falló con 502** (`sandbox-session.txt`, `checkoutController.js:364`) | BL |
| DIZOR procesa ese pago punta a punta (inbox, pedido `pagado`, stock, aviso) | **No demostrado** | BL |
| Otros medios (PSE, Nequi dentro de Wompi) | No ejecutados | BL |

**Valoración:**
- El riesgo NV-04 ("el `GET` podría no traer el vínculo") **se reduce de forma sustancial**: la muestra real lo trae y coincide exactamente.
- **E01 no está cumplido.** La asociación auténtica, inequívoca y verificable **entre transacción, enlace y pedido** no se ha demostrado con el código que se desplegaría: no hay pedido, ni webhook, ni procesamiento.
- La modalidad Payment Links **no queda descartada**. Queda **pendiente de demostrar**.

## E02 · Webhook auténtico

**BLOCKED.** No hay receptor HTTPS ni URL configurada en el panel de Sandbox (`sandbox-real.json`: `publicHttpsConfigured: false`). Por tanto, siguen sin verificar:
- La firma real.
- Las propiedades firmadas reales.
- El 200 tras guardar en el inbox.
- El reintento del proveedor.
- La idempotencia ante un reenvío real.

## E03 · Redirección

| Hecho | Tipo |
|---|---|
| Tras pagar, el enlace añadió `id` y `env=test` a la `redirect_url` y conservó `order` y `payment` | SB, una muestra |
| La confirmación del navegador solo consulta, nunca confirma pagos (revisado en rondas anteriores; C11) | LO |

Estado: **validado en una muestra.** La aplicación no depende de él, y es correcto que no dependa.

## E04 · Rechazo, reintento y reutilización

**PARCIAL.** Solo se ejecutó una tarjeta aprobada. Sin ejecutar:
- Tarjeta rechazada.
- PENDING.
- PSE y Nequi.
- Rechazo seguido de aprobación en el mismo enlace.
- Reutilización tras APPROVED.

**Hecho real relevante:** tras el pago aprobado, el enlace siguió con `single_use=true` y `active=true`. No se sabe si admite un segundo pago. Las defensas locales lo detectan (`additional_approved_payment`, P20/C16), pero el comportamiento real no está probado.

## E05 · Vigencia

| Hecho | Tipo |
|---|---|
| El API acepta `expires_at` UTC a 24 h y lo devuelve idéntico (HTTP 201) | SB |
| Los enlaces que crea **el código actual no vencen** (`expiresAt: null` en el enlace pagado y en el piloto) | SB + LO (X07 FAIL) |
| Efecto del vencimiento sobre un PENDING, pago tardío o enlace vencido | No ejecutado |
| Cierre o desactivación de un enlace | No documentado ni probado |

Estado: **BLOCKED / WP-07 abierto.** La vigencia no está implementada.

## Hallazgo nuevo derivado de la evidencia real

**FF-02 · P1.** El único intento de **crear un pedido y su enlace con el checkout actual** contra el Sandbox real devolvió **502**, con causa desconocida:
- El arnés no guardó la respuesta del proveedor.
- El pedido quedó `checkoutState: failed`.

En cambio, `createPaymentLink` sí funcionó en el piloto anterior, llamado de forma directa con un objeto mínimo.

Hasta repetirlo con diagnóstico, **no está demostrado que el checkout real pueda iniciar un cobro Wompi**. Además, el resultado en el proveedor es desconocido: podría existir un enlace sin pedido utilizable. Es exactamente el escenario WP-12 ("checkout incierto"), que no tiene recuperación soportada.

## Conclusión

Con la evidencia real disponible, **la integración Wompi no está demostrada punta a punta.** Ni la creación del enlace desde el checkout, ni la recepción del webhook firmado, ni el procesamiento del pedido se han observado en un entorno real.

Esto **obliga a NO-GO.** No es por un defecto demostrado de Payment Links, sino porque **falta la evidencia indispensable** para recibir dinero real.
