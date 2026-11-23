# 05 · Hallazgos nuevos

Los ID **NR-xx** son independientes de WP-xx y NV-xx. Las pruebas están en `evidencias/adversarial-2.test.cjs`, y los valores observados en `evidencias/ejec-adversarial-2.txt` (líneas `OBS`).

| ID | Prioridad | ¿Lo introduce la segunda remediación? | ¿Bloquea la aprobación local? | ¿Bloquea producción? |
|---|---|---|---|---|
| NR-01 | P3 | Sí (lógica de cierre nueva) | No | No. Corregir antes de abrir es recomendable, no obligatorio |
| NR-02 | P3 | En parte: (a) sí; (b) y (c) son anteriores | No | No |
| NR-03 | P3 | No: hace visible una carencia que NV-01 ocultaba | No | No |

**No encontré ninguna vulnerabilidad local nueva de prioridad P1 ni P2.**

Investigué expresamente, sin resultado negativo:
- Carreras: D08, D16 y D23.
- Rollbacks y fallos parciales: D07 y D20.
- Idempotencia y reintentos: D01 y D03.
- Clasificación de errores HTTP: D09–D11 y D22.
- Pérdida de evidencia: D19 y C08c.
- Autorización: D15.
- Otro ambiente: D24.

---

## NR-01 · P3 · Una conciliación exitosa con una transacción no APPROVED deja un pedido pagado en revisión sin motivo visible

**Dónde:** `backend/src/controllers/orderAdminController.js:215-229`. El cierre resuelve todas las `reconciliation_query_failed`, pero `requiresReview` solo se recalcula si `tx.status === "APPROVED"` (l. 228). Como `canFulfill` exige `!requiresReview` (`orderReadiness.js:8-9`), el pedido sigue bloqueado.

**Reproducción (D13, FAIL):**
1. Un pedido pagado por webhook.
2. El administrador intenta conciliar y Wompi responde 500: se crea la incidencia (correcto).
3. Después concilia con el ID de un intento DECLINED anterior del mismo enlace.

Observado:

```
rc=200, pago=pagado, requiresReview=true, abiertas=[], preparar=409
salidaSinId=200 → prepararTrasSalida=200
```

**Impacto:**
- El pedido pagado no se puede preparar y el panel lo muestra "en revisión" con una lista de motivos vacía.
- No hay riesgo financiero.
- La salida existe: el formulario de conciliación viene precargado con el ID aplicado (`OrderNextAction.jsx:49`), y reenviarlo lo desbloquea. Sin embargo, no es evidente para el operador.

**Corrección mínima:** cuando `failures.length > 0`, recalcular siempre `current.requiresReview = current.incidents.some(i => !i.resolvedAt)`, sin depender del estado de la transacción. Es seguro, porque cualquier condición financiera que bloquee ya existe como incidencia abierta (`addIncident` siempre la registra).

**Regresión:** D13 en PASS. N08 debe seguir en PASS: una incidencia financiera independiente sigue bloqueando.

---

## NR-02 · P3 · Metadatos de recibo inexactos tras reprocesar

**Dónde:**
- **(a) Autosustitución.** `orderAdminController.js:266-268`. Cuando el recibo verificado es el mismo original (misma clave; es el caso habitual al recuperar un NV-01), se marca igualmente `associationError = "superseded_by_provider_state"` y `lastError = "Sustituido por recibo <su propio id>"`.
- **(b) `processedAt` reescrito.** `wompiPaymentService.js:223`. Ya existía en `9289c7b`. Con `reconcile: true`, la fase 2 vuelve a ejecutarse y reasigna `processedAt = new Date()` a un recibo que ya estaba procesado.
- **(c) Historial repetido.** Cada conciliación o reproceso con `reconcile: true` añade otra línea "Wompi APPROVED verificado" (D08: 3 líneas). Viene de la primera remediación.

**Reproducción:**
- **D17b (FAIL)** muestra (a), con el flujo normal de la bandeja.
- **D18 (FAIL)** muestra (a) y (b): reprocesar por la API un recibo normal ya procesado cambia `associationError` de `""` a `superseded…` y `processedAt` de `.198Z` a `.318Z`.

Stock, avisos y pago **no** se duplican (D18: stock 4 y un `payment.approved`).

**Impacto:**
- El registro afirma una sustitución que no ocurrió.
- Se pierde la hora real del primer proceso.
- Afecta al invariante de auditabilidad y a la verificación 4 de NV-03 cuando se reprocesa algo ya procesado.
- No tiene efecto financiero.

**Corrección mínima:**
1. En el cierre, si `String(verified._id) === String(original._id)`, no tocar `associationError` y dejar `lastError` vacío.
2. En la fase 2, usar `receipt.processedAt ||= new Date()`.
3. Opcionalmente, rechazar con 409 el reproceso de un recibo con `processedAt` (la bandeja ya los oculta).

**Regresión:** D17b y D18 en PASS. D17, N11, N12 y C08c deben seguir en PASS.

---

## NR-03 · P3 · Los recibos con contradicción permanente no tienen ninguna vía de cierre auditada

**Dónde:**
- `orderAdminController.js:251-254`: el reproceso exige una progresión válida y el mismo importe; si no, `deferProviderDiscrepancy` y 503.
- `listPaymentEvents` y `adminAlertController.js:42-45` cuentan todo recibo con `processedAt: null`.
- No existe ninguna acción de archivo.

**Reproducción:**
- **D04b (FAIL):** un DECLINED firmado con `GET` APPROVED. El pedido se concilia y queda `pagado`, pero el recibo DECLINED queda `failed` en la bandeja para siempre; reprocesar responde 503.
- **D19b (FAIL):** un importe firmado distinto del consultado. El pedido se concilia con el ID real y queda pagado, pero el recibo queda abierto para siempre.

**Impacto:**
- El contador de alertas nunca vuelve a cero, lo que produce fatiga de alertas.
- Son casos raros: requieren una inconsistencia real del proveedor o un secreto comprometido, porque el importe y el estado van firmados.
- Conservarlos **visibles** es correcto. Lo que falta es poder **archivarlos con justificación**.
- Antes de esta remediación, el primer caso se ocultaba en falso (NV-01), así que no es una regresión.

**Corrección mínima:** una decisión "archivar recibo" con estas condiciones:
- Solo admin o superadmin, con motivo obligatorio y `AuditLog` en la misma transacción.
- Exige que exista un recibo `provider_query` procesado del mismo `transactionId`, o que el pedido asociado esté cerrado.
- Conserva todos los campos y añade `processingState: "processed"`, `processedAt` y la razón en `lastError`.
- No es una eliminación ni un cambio de esquema.

**Regresión:** D04b y D19b en PASS tras archivar. Debe ser imposible archivar sin motivo, por un vendedor o sin un recibo confiable.

---

## Observaciones (no son defectos)

| ID | Observación | Acción |
|---|---|---|
| OBS-1 | `getTransaction` rechaza ahora, también en la ruta del webhook, cualquier ID que no cumpla `^[A-Za-z0-9_-]{1,150}$`. Los ejemplos oficiales (`1234-1610641025-49201`) lo cumplen. Si un ID real no lo cumpliera, todos sus eventos responderían 503 y quedarían en la bandeja (seguro, pero sin aplicarse) | Comprobar el formato del ID en E01 |
| OBS-2 | La conciliación exitosa cierra los fallos de consulta aunque la transacción conciliada no sea la de la pista escrita. Es deliberado (lo recomendé en la ronda anterior). La pista se conserva en `detail`, `resolution` y `AuditLog` (D12) | Ninguna |
| OBS-3 | `backend/test/phase1-v2.test.js` y `remediacion-2/regresiones.test.cjs` importan el arnés desde `docs/auditoria-*`. `npm test` depende de la documentación de auditoría y de `MMS_DIR` (las históricas también dependen de `MMS_DIR`) | Si se archiva la documentación, mover antes el arnés a `backend/test/helpers/` |
| OBS-4 | El commit `23ce3a6` mezcla remediación, auditorías y rediseño de checkout. Además, durante esta auditoría hubo un proceso concurrente modificando el frontend de checkout (`03` §4) | Separar y revisar el frente de checkout antes de desplegar |
| OBS-5 | NV-05, NV-06 y NV-07 (P3) siguen abiertos, tal como Codex declara. Los errores tipados mejoran parcialmente el código HTTP en `paymentIncidentResolution.js:37`, pero la llamada HTTP sigue dentro de la transacción | Opcional antes de salir |
