# 04 · Seguridad de la integración Wompi

Auditoría independiente · 2026-11-23. Documentación oficial consultada el 2026-11-23 (todas respondieron HTTP 200): eventos, transacciones, seguimiento-de-transacciones, widget-checkout-web, ambientes-y-llaves, reintento-de-pago, datos-de-prueba-en-sandbox y links-de-pago (`https://docs.wompi.co/docs/colombia/<ruta>/`).

## 1. Firma de eventos

| Requisito oficial (docs “eventos”) | Implementación | Estado |
|---|---|---|
| Concatenar en orden los valores de `signature.properties` (rutas sobre `data`), luego `timestamp`, luego secreto de eventos; SHA-256 | `wompiService.js:92-109`: lee las propiedades dinámicamente, concatena, añade `timestamp` y `WOMPI_EVENTS_SECRET` | VERIFICADO (P01, P09, P10) |
| Checksum en `X-Event-Checksum` o `signature.checksum` | `wompiWebhookController.js:8`, `wompiService.js:79` | VERIFICADO |
| Secreto de eventos distinto de llaves pública/privada | variable propia `WOMPI_EVENTS_SECRET`; evento firmado con la llave privada → 401 | VERIFICADO (P09) |
| “Las propiedades pueden variar” | lectura dinámica; además exige que incluyan id, status y amount (`:93`) | VERIFICADO (P10: propiedades reducidas → 401). Riesgo menor: si Wompi dejara de firmar alguno de los tres, todos los eventos se rechazarían (fallo seguro) |
| Comparación | mayúsculas normalizadas y `timingSafeEqual` (`:110-118`) | VERIFICADO. La docs no dice si distingue mayúsculas; normalizar es seguro |
| Respuesta 200; reintentos máx. 3 en 24 h si no es 200 | 200 solo tras aplicar; 5xx si falla el almacenamiento o la aplicación | VERIFICADO (P14) |
| Anti-replay | ventana 26 h y −60 s (`:70, 84-90`) + idempotencia por clave (env, id, status, monto, moneda) | VERIFICADO (P10, P11). Un replay dentro de 26 h es inocuo |

Observación: la firma se verifica sobre el cuerpo ya procesado por el sanitizador global (`app.js:117-141`, `xss(mongoSanitize(...))`). Para los campos firmados hoy (id, estado, monto) no hay alteración. **RIESGO P3** si Wompi firmara campos de texto con caracteres que el filtro XSS altere.

## 2. Llaves y ambientes

| Control | Evidencia | Estado |
|---|---|---|
| Llave privada solo en backend; nunca en frontend | búsqueda en `frontend/src`: sin `prv_`/`WOMPI_PRIVATE_KEY`; el frontend solo recibe `paymentUrl` | VERIFICADO (código) |
| Base URL por `WOMPI_ENV` | `wompiService.js:3-8` | VERIFICADO (código) |
| Eventos de otro entorno ignorados | `environment` debe ser `prod` con `WOMPI_ENV=production` | VERIFICADO (P25) |
| `NODE_ENV=production` exige `WOMPI_ENV=production` | `server.js:28-31` | VERIFICADO (código) |
| Coherencia de prefijos (`prv_prod_`, `prod_events_`) con el entorno | no se valida | RIESGO P3 (WP-13). Fallo mayormente seguro: un secreto `test_` firmaría distinto y los eventos `prod` darían 401 → pagos sin confirmar |
| Secretos en logs | el manejador de errores registra mensaje y pila, no cabeceras ni cuerpo (`errorMiddleware.js`); `PaymentEvent` guarda el checksum recibido (no secreto) | VERIFICADO (código) |
| Datos de tarjeta | nunca llegan al backend (pago en dominio de Wompi) | VERIFICADO (código) |
| Configuración real del panel Wompi (URL de eventos, llaves productivas) | sin acceso | NO VERIFICADO (E06) |

## 3. Autenticidad de la confirmación

- **Solo el webhook firmado o una consulta autenticada (`GET /v1/transactions/{id}` con llave privada) cambian el estado de pago.** La redirección del navegador no tiene endpoint que la procese (P08); el admin no puede confirmar Wompi a mano (P26).
- **Asociación evento → pedido** (`wompiWebhookController.js:13-18`): `Order.findOne({ paymentMethod:"wompi", $or:[{orderNumber: tx.reference}, {orderNumber: tx.sku}, {"wompi.paymentLinkId": tx.payment_link_id}] })`.
  - En Links de pago la referencia es generada por Wompi y `sku` no está en el contrato del evento → en la práctica todo depende de `payment_link_id`.
  - **DEFECTO CONFIRMADO (X01, WP-01)**: si no hay coincidencia se responde 200 y no se guarda nada.
  - **DEFECTO CONFIRMADO (P23, WP-06)**: si la referencia coincide con un pedido más antiguo distinto del dueño del enlace, el pago se aplica a ese otro pedido sin incidencia. No es explotable por un tercero sin el secreto de integridad (crear transacciones con referencia elegida exige firma de integridad, docs “transacciones”), pero el código no valida la coherencia.
  - `processTransaction` no comprueba que `tx.payment_link_id` coincida con `order.wompi.paymentLinkId`.
- **Una transacción no se reutiliza para otro pedido**: la clave del evento queda ligada al primer pedido; repetirla con el enlace de otro pedido no lo paga (P24).
- **Monto y moneda**: se comparan con `Math.round(order.total*100)` y `COP` (`wompiPaymentService.js:44-46`) — pero **después** de escribir `pagado` (P21b, WP-05).

## 4. Integridad del monto

| Ataque (entorno aislado) | Resultado |
|---|---|
| Enviar `unitPrice`, `lineTotal`, `total`, `subtotal`, `discountTotal` manipulados | Ignorados; total 150 000 y enlace 15 000 000 centavos (P21) |
| Cupón inexistente / vencido | 400 (P22) |
| Descuento inyectado en el cuerpo | Ignorado (P22) |
| Cupón de un uso en dos pedidos Wompi | Ambos cobrados con descuento; el segundo queda con incidencia irresoluble (P22b, WP-03) |
| Cambiar cantidades a no enteras/negativas | Rechazo `Ítem de carrito inválido` (`cartService.js:18-20`; cubierto por la suite existente) |
| Cambio de precio después de crear el enlace | El enlace conserva el monto del pedido (fijado en el proveedor); sin vencimiento puede pagarse semanas después (X07) |
| Transacción aprobada con monto menor | Detectada, no despachable, pero **marcada `pagado`** y visible como “Aprobado” al cliente (P21b) |
| Cambiar la referencia del evento | Sin efecto sin firma (P10); con firma válida y vínculos contradictorios → asociación errónea (P23) |
| Transacción de otro pedido | No confirma el otro pedido (P24) |

Conversión: `amount_in_cents = Math.round(total*100)`; precios enteros en COP; IVA con `Math.round`. Envío incluido → `shippingCost=0` (`settingsService.js:44`).

## 5. Autorización y exposición de datos

| Superficie | Resultado |
|---|---|
| Consulta de pedido ajeno por id, por número sin token, con token falso, por otro usuario | 404 (P27) |
| Cancelación de pedido ajeno | 404 (P27) |
| Rutas `/api/admin/orders/*` como cliente | 403 (P27) |
| Conciliación como vendedor | 403 (P39) |
| Mass assignment en checkout | sin efecto (P26); `buyer`/`shippingAddress` restringidos por esquema estricto |
| CORS | origen único `CLIENT_URL`, `credentials: true` (`app.js:60-65`). Cookies de sesión: CSRF no evaluado en profundidad; las rutas sensibles exigen JSON y sesión (riesgo bajo, fuera del foco de pagos) |
| Errores 5xx | mensaje genérico en producción; el checkout nunca devuelve pila (`errorMiddleware.js:156`; P05b sin fuga) |
| Limitación de tasa | webhook: 100/min + global 300/15 min por IP (WP-14). Lookup/track: 15/15 min |
| Métodos desactivados | `nequi_api`, `nequi_manual`, `efectivo`, `tarjeta`, `transferencia`, mayúsculas, vacíos y arrays → 400 sin crear pedido; endpoints Nequi → 410 (P33) |

## 6. Resumen de ataques y defensas

| Vector | Defensa | Estado |
|---|---|---|
| Webhook falsificado / sin firma / secreto erróneo | checksum | **Bloqueado** (P09) |
| Evento manipulado tras firmar | checksum | **Bloqueado** (P10) |
| Replay | ventana + idempotencia | **Bloqueado/inocuo** (P10, P11) |
| Redirección manipulada | sin efecto de estado | **Bloqueado** (P08) |
| Cliente fija `pagado` | permisos | **Bloqueado** (P26) |
| Precio/cupón manipulado | recálculo en servidor | **Bloqueado** (P21, P22) |
| Sandbox en producción | `environment` | **Bloqueado** (P25) |
| IDOR | filtros por dueño/token | **Bloqueado** (P27) |
| Pérdida silenciosa de evento auténtico | — | **Vulnerable** (X01) |
| Evento con vínculos contradictorios | — | **Vulnerable, no explotable externamente** (P23) |
| Anulación del cobro ignorada | — | **Vulnerable** (P04b) |
