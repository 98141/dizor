# 05 · Matriz de pruebas

Auditoría independiente · 2026-11-23.

## 1. Entorno y método

| Aspecto | Valor |
|---|---|
| Arnés | `evidencias/auditoria-wompi.cjs` (independiente; carga `backend/src` sin modificarlo) |
| Base de datos | `MongoMemoryReplSet` 1 nodo, mongod 8.3.2, `127.0.0.1`, `enableTestCommands=1` para inyectar fallos (`failCommand`) |
| Proveedor | Wompi **simulado** en proceso: crea enlaces, sirve `GET /v1/transactions/:id` y `GET /v1/payment_links/:id`. Red externa bloqueada; hosts externos intentados: ninguno |
| Eventos | firmados con el algoritmo oficial y un secreto aleatorio por ejecución |
| Transacciones de prueba | modelo realista de Payment Link: referencia generada (`wompi_gen_…`), **sin `sku`**, con `payment_link_id` (salvo cuando se indica) |
| Datos | ficticios; usuarios `*-aud@example.test`; no se lee `.env` ni Atlas |
| Limitadores | elevados solo dentro del proceso del arnés (no se evalúa limitación de tasa aquí) |
| Resultados | `evidencias/resultados-auditoria-wompi.json` (ejecución final 2026-11-23T14:50Z), salida en `evidencias/ejecucion-auditoria-wompi.txt` |

Comandos (PowerShell, desde la raíz del repo):

```powershell
$env:MMS_DIR = '<carpeta con node_modules/mongodb-memory-server>'
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
node docs/auditoria-wompi-pedidos/evidencias/auditoria-wompi.cjs        # matriz de esta auditoría
cd backend; node --test --test-concurrency=1 test/*.test.js             # suite existente
```

Nota: la suite existente sobrescribe tres JSON de evidencias de `docs/auditoria-admin`; tras ejecutarla se restauraron con `git checkout --` para no alterar evidencias previas.

**Criterio**: cada escenario afirma el comportamiento correcto esperado por la auditoría. PASS/FAIL solo para escenarios ejecutados. BLOCKED = no ejecutable sin Sandbox real/credenciales. Ninguna fila se marca PASS por lectura de código.

## 2. Suite existente del repositorio

`node --test test/*.test.js`: **275 pruebas, 275 aprobadas, 0 fallidas** (177 s). Resumen en `evidencias/suite-existente-resumen.txt`. Limitación detectada: el fixture de esas pruebas (`docs/auditoria-admin/cierre-fase1/independiente.test.js`, `txFor`) asocia las transacciones por `sku: order.orderNumber`, campo que **no figura en el contrato oficial de eventos**. Por eso esas pruebas no demuestran que los pagos reales de un Link se asocien (ver WP-01).

## 3. Matriz

| ID | Escenario | Método | Esperado | Observado | Resultado | Riesgo residual |
|---|---|---|---|---|---|---|
| P01 | Pago aprobado | Pedido Wompi por API; evento APPROVED firmado vinculado solo por `payment_link_id`; intento de preparar | Enlace = total×100 COP `single_use`; sin stock al crear; tras evento `pagado`, stock −1, 1 evento, preparable | Exacto: 15 000 000 COP, stock 3→3→2, `pagado/pagado`, 1 `PaymentEvent` procesado, avisos `payment.approved` y `admin.ready`, preparar 200 | **PASS** | Depende de que Wompi pueble `payment_link_id` (E01) |
| P02 | Pago rechazado | DECLINED firmado | `rechazado`, sin stock, no preparable, aviso | `rechazado`, `pago_pendiente`, stock 3, preparar 409, `payment.declined` encolado | **PASS** | Sin reintento en el sitio (WP-11) |
| P03 | Pago pendiente | PENDING firmado | Sigue pendiente, no preparable | `pendiente`, `wompi.status=PENDING`, preparar 409 | **PASS** | Sin alerta por pendientes antiguos (WP-10) |
| P04 | Anulado sobre pendiente | VOIDED firmado | No pagado | `rechazado` | **PASS** | — |
| P04b | VOIDED tras APPROVED (misma tx) | APPROVED y luego VOIDED firmado | Reflejar la anulación y bloquear despacho | Sigue `pagado/pagado`, sin incidencia, `requiresReview=false`; el evento VOIDED se guarda pero se ignora; **preparar 200** | **FAIL** | Despacho de pedido con cobro anulado (WP-04) |
| P05 | Error del proveedor (ERROR) | ERROR firmado | No pagado | `rechazado`, sin stock | **PASS** | — |
| P05b | Timeout al crear enlace | Fallo simulado de `POST /payment_links` | Error controlado, sin pago ni stock | 502 sin fuga, pedido `failed` + incidencia, stock intacto; misma clave → 409; clave nueva → 2.º pedido | **PASS** | Pedidos fallidos en revisión perpetua (WP-12, WP-03) |
| P06 | Cliente cierra el checkout | Sin evento; lookup cliente; detalle admin | Pendiente en ambos lados | Cliente `pendiente`; admin “Esperando confirmación del pago”; `canReconcile=false` | **PASS** | Indefinidamente pendiente; sin vencimiento (X07) |
| P07 | Regresa sin pagar | Lookup con parámetros de retorno | Pendiente | `pendiente` | **PASS** | — |
| P08 | Redirección manipulada | Lookup con `id`, `status`, `paymentStatus` inyectados; GET con query | Sin cambio | 200/401, estado y `transactionId` intactos | **PASS** | — |
| P09 | Webhook falsificado | Sin checksum, aleatorio, secreto erróneo, firmado con llave privada | 401 sin efecto | 401 ×4, 0 eventos | **PASS** | — |
| P10 | Firma inválida | Alterar status, monto, timestamp; propiedades reducidas; 27 h; futuro | 401 | 401 ×6 | **PASS** | — |
| P11 | Webhook duplicado | 2 secuenciales + 6 concurrentes idénticos | Un efecto | stock −1, 1 evento, 1 aviso, 1 movimiento | **PASS** | — |
| P12 | Fuera de orden | APPROVED→PENDING→DECLINED(otra tx); PENDING antiguo tras APPROVED | No retrocede | Sigue `pagado`, stock correcto | **PASS** | Excepto VOIDED (P04b) |
| P13 | Webhook perdido | Tx aprobada en el proveedor sin evento; conciliación admin | Vía autenticada de recuperación | Conciliación **409 “No hay transacción Wompi consultable”**; botón oculto; cliente ve `pendiente` | **FAIL** | Dinero cobrado sin pedido procesable (WP-02) |
| P14 | Error de MongoDB | `failCommand` en (a) inbox y (b) descuento de stock; reintento | No-2xx, dinero registrado, reintento sin duplicar | (a) 500 sin efectos; (b) 500, `pagado` + `payment_processing_failed`, stock intacto; reintento 200, stock −1, incidencia resuelta | **PASS** | Solo 3 reintentos de Wompi en 24 h |
| P15 | Respuesta perdida (misma clave) | Repetir solicitud con la misma clave | Mismo pedido y enlace | 201 → 200, mismo pedido y URL, 1 enlace | **PASS** | — |
| P16 | Doble clic | 5 simultáneas, misma clave | 1 pedido, 1 enlace | `[409,409,201,409,409]`, 1 pedido, 1 enlace | **PASS** | — |
| P17 | Dos pestañas | 2 claves distintas, misma unidad | Dos intentos independientes (diseño) | 2 pedidos con enlace, stock 1 sin reservar | **PASS** | Ver P34 |
| P18 | Reintento tras rechazo | DECLINED t1 → APPROVED t2 en el mismo enlace | `pagado` con t2; historial de ambos | `pagado`, `transactionId=t2`, 2 `PaymentEvent`, notas con t1 y t2 | **PASS** | El pedido solo guarda la última tx |
| P19 | Aprobación tardía (= P30) | Admin cancela; luego APPROVED | Dinero en disputa con incidencia, sin stock ni venta | `cancelado`+`pagado`, `approved_after_cancellation`, stock intacto, 0 en finanzas; **enlace sigue activo, 0 llamadas de desactivación** | **PASS** | Cobros evitables (WP-07) |
| P20 | Dos aprobadas en un pedido | 2 APPROVED distintas | Detectar y permitir despachar tras resolución | Incidencia `additional_approved_payment`, stock −1 una vez; **preparar 409 sin forma de resolver** | **FAIL** | Pedido pagado bloqueado (WP-03) |
| P21 | Monto manipulado | Precios/total/descuento en el cuerpo | Ignorados | total 150 000, enlace 15 000 000 | **PASS** | — |
| P21b | APPROVED con monto menor | APPROVED de 100 centavos | No `pagado`; incidencia; no despachable | **`pagado`**; cliente ve `pagado`; incidencia; preparar 409 | **FAIL** | Estado económico falso (WP-05) |
| P22 | Cupón manipulado | Inexistente, vencido, descuento inyectado | 400 / ignorado | 400, 400, total intacto | **PASS** | — |
| P22b | Cupón de un uso ×2 | 2 pedidos Wompi con el mismo cupón `maxUses=1`, ambos pagados | Detectar y permitir resolución | `usedCount=1`; B pagado con descuento, `coupon_reconciliation`, **preparar 409 sin resolución** | **FAIL** | Pedido pagado bloqueado (WP-03, WP-15) |
| P23 | Vínculos contradictorios | Evento con `payment_link_id` de A y `reference` = número de B, en ambos órdenes de creación | Nunca aplicarlo a otro pedido | Si B es más antiguo, **B queda `pagado` con el dinero de A**, sin incidencia | **FAIL** | No explotable sin secreto de integridad (WP-06) |
| P24 | Tx de otro pedido | Repetir tx de A con el enlace de B | B no pagado | 200 idempotente, B `pendiente` | **PASS** | — |
| P25 | Sandbox en producción | `WOMPI_ENV=production`, evento `environment=test` | Ignorado | 200, `pendiente` | **PASS** | Prefijos de llaves sin validar (WP-13) |
| P26 | Marcar pagado desde cliente | PATCH pago como cliente/vendedor/admin/anónimo; inyección en checkout | Nadie | 403/403/409/401; inyección ignorada | **PASS** | — |
| P27 | Pedido ajeno | GET/cancel/lookup ajeno; admin como cliente | 404/403 | 404 ×5, 403 | **PASS** | — |
| P28 | Cancelación antes del pago | Cliente ve botón y cancela; luego admin cancela | Ofrecido = ejecutable; sin revisión perpetua | Botón ofrecido, cliente **409** + incidencia; admin 200; queda `requiresReview=true` con 2 incidencias abiertas para siempre; enlace activo | **FAIL** | Ruido en revisión, UX rota (WP-09) |
| P29 | Cancelación después del pago | Cliente cancela pagado; admin cancela | Cliente no; admin repone stock, sin reembolso automático | 409; 200; stock repuesto; `received_payment_pending_resolution`; 0 llamadas al proveedor | **PASS** | Devolución 100 % manual |
| P30 | Pago aprobado tras cancelar | — | — | Cubierto por P19 (mismo escenario) | (duplicado) | — |
| P31 | Contraentrega | Crear COD | Sin pago, stock comprometido, sin Wompi, preparable | Exacto; 0 llamadas Wompi | **PASS** | — |
| P32 | COD sin pago anticipado | Recaudo antes de entregar, vendedor, sin evidencia, válido | 409/403/400/200 | 409/403/400/200 → `pagado` | **PASS** | — |
| P33 | Métodos deshabilitados | 10 variantes de método; Nequi; Wompi sin configurar | 400 sin pedido; 410 | Todo 400, 0 pedidos, Nequi 410; sin secreto solo se ofrece COD | **PASS** | — |
| P34 | Última unidad | 2 COD concurrentes; 2 Wompi pagados para stock 1 | Inventario nunca negativo, una venta, cobro excedente detectado | COD 201/409; Wompi: ambos `pagado`, stock 0, uno `approved_without_stock` | **PASS** | **Un cliente cobrado sin producto** (WP-08) |
| P35 | Stock agotado durante el checkout | Stock a 0, APPROVED, reponer, conciliar | Pago reconocido sin venta parcial; conciliación completa | Exacto | **PASS** | Requiere reponer stock real |
| P36 | Repetición con inventario | Evento + 2 conciliaciones + evento | Un descuento | stock −1, 1 venta | **PASS** | — |
| P37 | Alerta administrativa | Aprobado, revisión, rechazado; alertas y bandeja | Aviso listo / incidencia / bandeja | `admin.ready`, `admin.incident`, en bandeja y alertas; rechazo sin aviso admin | **PASS** | Entrega real del correo no verificada (WP-10) |
| P38 | Mensaje de rechazo | Lookup + función real `confirmationCopy` del frontend | Rechazo explícito | API `rechazado`; título “El pago no se completó” | **PASS** | Pendiente titula “¡Gracias por tu compra!” (WP-11) |
| P39 | Conciliación de pendiente | Tx PENDING conocida; proveedor APPROVED; vendedor/admin | Admin concilia | 403 / 200 → `pagado`, stock −1 | **PASS** | Solo si el webhook llegó al menos una vez |
| P40 | Reembolso/anulación | Búsqueda de llamadas y código | — | 0 llamadas; ningún `/void` ni API de reembolso | **NOT APPLICABLE** | Proceso manual externo |
| X01 | Evento aprobado sin vínculo | APPROVED firmado sin `payment_link_id` | Conservar evidencia y alertar | **200, 0 `PaymentEvent`, sin incidencia** | **FAIL** | Pérdida silenciosa (WP-01) |
| X02 | Cancelar tras rechazo y pagar después | DECLINED; autocancelación; APPROVED | Pedido cancelado no recibe cobros | Autocancelación 200; luego `cancelado`+`pagado` | **FAIL** | Devolución manual (WP-07) |
| X03 | Evento con referencia de COD | APPROVED con número de un COD | Ignorado | 200, COD intacto | **PASS** | — |
| X04 | APPROVED y cancelación simultáneos | 4 repeticiones concurrentes | Stock coherente; incidencia si hay dinero | 4/4 coherentes | **PASS** | — |
| X05 | Webhook y conciliación simultáneos | 2 eventos + conciliación en paralelo | Un descuento | stock −1, 1 venta | **PASS** | — |
| X06 | Resolución de incidencias | Enumeración de rutas admin y búsqueda de `resolvedAt` en controladores | Acción auditada de cierre | Ninguna ruta ni controlador | **FAIL** | WP-03 |
| X07 | Vigencia del enlace | Cuerpo enviado a `POST /payment_links` | Vigencia acotada | `expires_at` ausente (`null`) | **FAIL** | WP-07 |
| E01 | `payment_link_id` en transacciones reales de Link | Requiere Sandbox con llaves `pub_test_/prv_test_/test_events_` y URL pública | Campo poblado | No ejecutado | **BLOCKED** | Crítico para WP-01 |
| E02 | Firma real de un evento Sandbox | Igual | 200 y aplicado | No ejecutado | **BLOCKED** | — |
| E03 | `id` añadido al `redirect_url` de un Link | Igual | Presente | No ejecutado (docs lo confirman solo para Widget/Web Checkout) | **BLOCKED** | Base para corregir WP-02 |
| E04 | Reintento de pago y `single_use` tras DECLINED | Igual (tarjeta 4111…, luego 4242…) | Segunda tx con el mismo enlace | No ejecutado | **BLOCKED** | — |
| E05 | Desactivar enlace (`active=false`) | Igual | Endpoint disponible | No documentado; no ejecutado | **BLOCKED** | Para WP-07 |
| E06 | Configuración productiva (URL de eventos, llaves, HTTPS, replica set) | Acceso al panel e infraestructura | Correcta | Sin acceso | **BLOCKED** | — |

## 4. Totales (sin duplicados)

| Resultado | Cantidad |
|---|---|
| Escenarios ejecutados por el arnés | 50 |
| PASS | 38 |
| FAIL | 11 (P04b, P13, P20, P21b, P22b, P23, P28, X01, X02, X06, X07) |
| NOT APPLICABLE | 1 (P40) |
| BLOCKED (no ejecutables) | 6 (E01–E06) |
| Filas totales de la matriz | 56 (P30 contado una sola vez dentro de P19) |
| Suite existente (aparte) | 275/275 PASS |

X06 es una comprobación automática estática (enumeración de rutas y búsqueda de código), no una prueba de comportamiento.
