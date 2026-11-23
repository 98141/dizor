# 02 · Validación de NV-01, NV-02 y NV-03

2026-11-23 · Segunda auditoría independiente · Código auditado: commit `23ce3a6` (exportación aislada) y árbol vivo.

**Prefijos de prueba:**
- `C`: mi batería anterior, sin cambios (`auditoria-claude/evidencias/adversarial.test.cjs`, 35 pruebas).
- `D`: batería nueva de esta auditoría (`evidencias/adversarial-2.test.cjs`, 28 pruebas).
- `N`: pruebas nuevas de Codex (`remediacion-2/regresiones.test.cjs`, 18 pruebas).
- `R`: regresiones de la primera remediación de Codex.

Las salidas con los valores observados (`OBS ...`) están en `evidencias/ejec-*.txt`.

**Resultado global:**

| Defecto | Prueba de aceptación previa | Resultado | Estado |
|---|---|---|---|
| NV-01 | C07 | **PASS** | **CORREGIDO** |
| NV-02 | C12 | **PASS** | **CORREGIDO**, con un residuo P3 (NR-01) |
| NV-03 | C08 y C08c | **PASS** | **CORREGIDO**, con residuos P3 (NR-02 y NR-03) |

Comprobé que `adversarial.test.cjs` es exactamente el que escribí: lo comparé con el contenido original registrado en mi sesión. Las únicas diferencias son mis propias correcciones documentadas (C05 y C13) y C33/C34, que añadí al final. **Codex no debilitó ninguna aserción.**

---

## 1. NV-01: un APPROVED firmado ya no se pierde por una consulta rezagada

**Implementación revisada** (`backend/src/services/wompiPaymentService.js`):
- `canAdvanceTransactionStatus` (l. 11-13) solo admite estas progresiones:
  - El mismo estado.
  - De PENDING a APPROVED, DECLINED o ERROR.
  - De APPROVED a VOIDED.
- `deferProviderDiscrepancy` (l. 15-25) hace, en una transacción propia ya confirmada:
  - Guarda `providerObservation`.
  - Pone el recibo en `failed` con un `lastError` diagnóstico.
  - Encola un aviso idempotente.
  - Si otra aplicación ya terminó, no degrada el recibo.
- La rama de estados (l. 130-142) actúa así:
  - Ante una progresión no válida: discrepancia y 503.
  - Ante una válida: aplica el estado consultado y exige `processedAt` antes de cerrar el recibo firmado.

| # | Verificación exigida | Resultado | Evidencia |
|---|---|---|---|
| 1 | Un APPROVED firmado no se sustituye por un `GET` PENDING | PASS | C07, D01, N01-PENDING |
| 2 | Un `GET` DECLINED o ERROR rezagado no degrada un APPROVED | PASS. El pedido sigue `pendiente`, `wompi.status` no cambia y no se envía `payment.declined` | D02-DECLINED, D02-ERROR, N01-DECLINED |
| 3 | La discrepancia se conserva de forma durable | PASS. Se confirma antes de responder 503 | D01, D07 |
| 4 | `PaymentEvent` registra el estado adecuado | PASS. Queda `failed` con su `lastError` | D01 (`state=failed`) |
| 5 | `providerObservation` conserva la respuesta consultada | PASS | D01 (`obs=PENDING`) |
| 6 | `processedAt` no se fija antes de terminar | PASS. Queda `null` tras tres 503 concurrentes y un cuarto reintento | D01, D02, D03 |
| 7 | El recibo sigue visible en la bandeja | PASS. Aparece en `/payment-events` y en `/alerts` | D01 (`enBandeja=true`, `alerts=true`) |
| 8 | Una sola alerta administrativa | PASS. Una sola notificación `admin.payment_event`, tras 3 concurrentes y un reintento | D01 (`avisos1=1`, `avisos2=1`), N01 |
| 9 | Código HTTP que permite reintentos | PASS. Responde 503 (Wompi reintenta ante cualquier no-200) | D01–D04 |
| 10 | Los reintentos no duplican stock ni confirmación | PASS. Stock −1 y un `payment.approved` | D01, D08 |
| 11 | Un reintento posterior completa el proceso | PASS. Con el `GET` actualizado: 200, `pagado`, `processed`, `lastError` vacío | D01, D03, N01 |
| 12 | El diagnóstico no se pierde por un rollback | PASS. Con un fallo real de Mongo (`update`, código 2) en la escritura del recibo: 500, `processedAt` nulo y pedido intacto. El reintento deja `failed` y una alerta | D07, N02 |
| 13 | Un VOIDED auténtico conserva su protección | PASS | D05, C22–C26, R22, N04 |
| 14 | Un APPROVED antiguo no rehabilita un pago anulado | PASS. Probado con VOIDED antes que APPROVED y `GET` VOIDED, y con `GET` APPROVED rezagado | D06, C23, N04 |

**Escenarios adicionales:**
- **D03:** un DECLINED firmado con `GET` PENDING responde 503 sin efecto; cuando `GET` ya devuelve DECLINED, pasa a `rechazado` con un solo aviso.
- **D04:** un DECLINED firmado con `GET` APPROVED (que no es una progresión) responde 503. La conciliación autenticada aplica el cobro una sola vez.
- **D08:** con el `GET` ya actualizado, lancé a la vez 3 webhooks, 2 conciliaciones y 1 reproceso:
  - Todas las respuestas fueron 200.
  - Un solo recibo, stock −1 y un `payment.approved`.
  - El historial registra 3 líneas "APPROVED verificado". Es ruido cosmético que ya existía (ver NR-02).

**Criterio de aceptación:** ningún pago auténtico desaparece como procesado sin haberse aplicado; siempre queda una vía verificable de recuperación. **CUMPLIDO.**

**Riesgo residual:**
- La regla es conservadora a propósito. Una transición real no contemplada (por ejemplo PENDING→VOIDED) queda en `failed`/503 hasta que alguien la atienda. Es aceptable.
- Si la contradicción es permanente, el recibo no tiene cierre auditado (NR-03, P3).

---

## 2. NV-02: un ID erróneo ya no bloquea el pedido

**Implementación revisada:**
- `wompiService.getTransaction` (l. 139-156) clasifica los errores:
  - Formato inválido o 404: 409.
  - Cualquier otro HTTP, timeout, red, JSON inválido o una identidad de respuesta ajena: 503 con un código diagnóstico.
- `reconcileWompi` (`orderAdminController.js:195-231`):
  - Ante 409 no crea incidencia.
  - Ante 503 la crea con historial.
  - Tras un proceso completado, cierra todas las `reconciliation_query_failed` abiertas del pedido, con `resolution`, historial y `AuditLog` en la misma transacción.

| # | Verificación exigida | Resultado | Evidencia |
|---|---|---|---|
| 1 | Un ID inválido da un error controlado | PASS. 12 formatos dan 409 sin llamar al proveedor: vacío, espacio, `a/b`, `../x`, 151 caracteres, no ASCII, objeto, array, número, `null` y booleano | D09, N05 |
| 2 | Un ID inexistente no crea incidencia permanente | PASS. 404 da 409 con "ID no encontrado en este ambiente", sin incidencia ni historial | D10, C12 |
| 3 | 404 se distingue de 5xx | PASS. 404 da 409; 500, 502 y 503 dan 503 con incidencia | D10, D11 |
| 4 | Un timeout no se toma por inexistente | PASS. `TimeoutError` y `AbortError` dan 503 con `WOMPI_QUERY_TIMEOUT` | D11 |
| 5 | Un error temporal conserva trazabilidad | PASS. Incidencia con el ID como `detail`, una línea de historial con el código y deduplicación ante repeticiones. 401, 403 y 429 no se convierten en 404 | D11 |
| 6 | Una conciliación válida resuelve las incidencias técnicas superadas | PASS | C12, D12, N07 |
| 7 | No depende de que el ID correcto coincida con el erróneo | PASS. Dos pistas distintas (500 y timeout) se cierran con el ID real | D12, N07 |
| 8 | Las incidencias históricas siguen auditables | PASS. Se conservan `detail` y `createdAt`; `resolution` lleva actor, decisión `reconciled_with_provider` e ID consultado; un solo `AuditLog` con los ID y pistas anteriores | D12 |
| 9 | No se resuelven incidencias financieras ajenas | PASS. Una incidencia financiera independiente sigue abierta y el otro pedido no se toca | N07, N08 |
| 10 | Un vendedor no obtiene permisos administrativos | PASS. Conciliar, reprocesar, bandeja y resolver: 403. Cliente: 403. Anónimo: 401 | D15, C11, N10 |
| 11 | El administrador no puede confirmar a mano un pago falso | PASS. Confirmar Wompi da 409. Forzar `reconciled_with_provider` por la API de resolución da 400 | D15, P26 de la matriz |
| 12 | Un ID de otro pedido nunca confirma el pedido consultado | PASS. Da 409, sin incidencia ni pago en ninguno; el dueño real se aplica después | D14, C10, N08 |
| 13 | Sin inconsistencias bajo concurrencia | PASS. Fallos y éxitos simultáneos convergen; un éxito posterior desbloquea; un solo efecto | D16, N07 |
| 14 | Solo vuelve a estar preparable si se cumplen todas las condiciones | PASS en el sentido de seguridad: nunca se desbloquea de más (N08). **Residuo P3 en sentido contrario (NR-01):** si la conciliación exitosa usa un intento DECLINED del mismo enlace, se cierran las incidencias pero `requiresReview` sigue en `true`, y el pedido pagado no se puede preparar aunque no tenga incidencias abiertas | D13 FAIL |

**Escenarios adicionales:**
- **Fallo de `AuditLog` durante el cierre (N09, de Codex):** revierte el cierre y la incidencia sigue abierta. El reintento desbloquea. Revisé el código y la prueba y es correcto.
- **Doble conciliación (C09 y D04):** la segunda vuelta no repite efectos.

**Criterio de aceptación:** un error humano no bloquea de forma permanente un pedido legítimo ni permite una confirmación indebida. **CUMPLIDO.**

NR-01 no es permanente: el formulario de conciliación (`OrderNextAction.jsx:49`) viene precargado con `order.wompi.transactionId`, y reenviarlo lo desbloquea (D13: `salidaSinId=200` y luego `preparar=200`). Aun así, mientras tanto el pedido queda en revisión sin ningún motivo visible.

---

## 3. NV-03: la bandeja ya no conserva recibos obsoletos tras un reproceso

**Implementación revisada:**
- `processTransaction` devuelve el recibo que terminó de aplicarse.
- `reprocessPaymentEvent` (`orderAdminController.js:242-272`) hace, en este orden:
  1. Exige que la consulta tenga el mismo ID.
  2. Exige una progresión válida y el mismo importe firmado.
  3. Exige una asociación vigente.
  4. Comprueba en una transacción que el recibo aplicado está `processed` y coincide en ID, ambiente y pedido.
  5. Solo entonces cierra el original y conserva `provider_binding_mismatch`.

| # | Verificación exigida | Resultado | Evidencia |
|---|---|---|---|
| 1 | El original se cierra solo tras una recuperación exitosa | PASS | C08, D17, D20, N11, N14 |
| 2 | Se conserva su ID de transacción | PASS. Los campos inmutables del original no cambian | N11, N12 (revisé la comparación campo a campo) |
| 3 | No se elimina evidencia financiera | PASS. No hay borrados; el recibo con importe o moneda alterados conserva sus valores | C08c, D19, N12 |
| 4 | `processedAt` corresponde al proceso exitoso | PASS en el flujo de la bandeja. **P3 (NR-02):** reprocesar por la API un recibo ya procesado **reescribe** su `processedAt` | D18 FAIL |
| 5 | Se conserva `associationError` cuando corresponde | PASS para `provider_binding_mismatch` (C08c, N12). **P3 (NR-02):** un recibo que se aplica **a sí mismo** (misma clave, caso típico al recuperar NV-01) queda como `superseded_by_provider_state` con "Sustituido por recibo <su propio id>" | D17, D17b FAIL |
| 6 | El recibo deja de aparecer como pendiente | PASS | C08, C08c, D17, D23 |
| 7 | La bandeja refleja el nuevo estado | PASS. Una excepción: las contradicciones permanentes no tienen cierre posible (NR-03) | D04b, D19b FAIL |
| 8 | Un reproceso fallido no cierra el recibo | PASS. Con `GET` en 500, 404 o timeout: 503 y original intacto. Con `GET` rezagado: 503 | D22, N13 |
| 9 | No se puede cerrar indebidamente un recibo de otro pedido | PASS. La transacción se aplica a su dueño real y el otro pedido no cambia. Una respuesta con otro ID da 503 sin cierre. Un evento de otro ambiente da 409 | D21, D24, N13 |
| 10 | La concurrencia no duplica efectos | PASS. 3 reprocesos y 2 webhooks simultáneos dan stock −1, un aviso y el original cerrado | D23, N11 |
| 11 | Los eventos sospechosos conservan su historial | PASS | C08c, D19, N12 |
| 12 | El proceso es idempotente | PASS en efectos financieros (stock, avisos y pagos no se duplican: D18, D23). NR-02 en metadatos | D18 |

**Prueba de error de Mongo:** inyecté un fallo real en `commitTransaction` (código 2) durante el reproceso (D20). Resultado:
- Responde 500 y el original no se cierra en falso.
- El pago ya aplicado se conserva.
- El reintento cierra sin repetir stock ni aviso.

Codex cubre además el fallo en el cierre del original con un parche del método `save` (N15).

**Criterio de aceptación:** la bandeja refleja lo que de verdad está pendiente, sin ocultar evidencia ni conservar alertas obsoletas para siempre. **CUMPLIDO** para el defecto descrito: los recibos superados por una progresión o una moneda alterada se cierran.

Los recibos con una contradicción **permanente** quedan abiertos con razón, porque son anomalías reales. Lo que falta es una vía de archivo auditada (NR-03, P3). No es un retroceso: antes de esta remediación, el caso APPROVED-con-`GET`-DECLINED se ocultaba en falso (NV-01).
