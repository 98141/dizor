# 03 · Revisión del diff de la segunda remediación

## 1. Estado del repositorio

Registro completo en `evidencias/estado-repositorio.txt`.

| Dato | Valor |
|---|---|
| Rama | `main` |
| HEAD | `23ce3a6c8d9d36253f8c0e7b1499ce63ce8f95e6` ("Modificaciones del checkout y la pasarela de pagos…", 2026-11-23 12:07 −05:00, autor del commit: el usuario) |
| Base original | `9289c7b` |

**El encargo da por hecho que los cambios siguen sin commit. No es así.** El commit `23ce3a6` incluye juntos:
- La primera remediación.
- La segunda remediación.
- Toda la documentación de auditoría.
- El trabajo de otro frente (rediseño del checkout).

No hice ninguna operación sobre git más allá de lecturas, `git archive` y `git diff`.

### 1.1 Cómo aislé el cambio de la segunda remediación

1. **Mi huella anterior.** `auditoria-claude/evidencias/huella-sha256-despues.txt` (3.931 archivos) es el estado exacto que audité la vez anterior. Comparada con el árbol actual, difieren 9 archivos fuente:

   | Archivo | Origen |
   |---|---|
   | `wompiPaymentService.js`, `wompiService.js`, `orderAdminController.js` | **Codex, segunda remediación** |
   | `checkoutController.js`, `paymentMethods.js`, `backend/test/helpers/phase2Fixture.cjs` | Frente de checkout (`docs/checkout-una-pagina.md`, l. 10, 33 y 40) |
   | `frontend/src/app/(shop)/checkout/page.js`, `checkout.css`, `AuthFormField.jsx` | Frente de checkout |

2. **Las copias `remediacion-2/antes/`** de los tres archivos de Codex coinciden byte a byte con lo que audité:

   | Archivo | SHA-256 (16 primeros caracteres) |
   |---|---|
   | `wompiService` | `a4cbdb53a40d3e54` |
   | `orderAdminController` | `e62581941da997dd` |
   | `wompiPaymentService` | `263fe33d035448eb` |

3. **Los hashes finales declarados por Codex** (`archivos-codigo.json`) coinciden con el árbol actual en los 4 archivos (3 de código más `phase1-v2.test.js`).

4. **Árbol vivo frente a HEAD.** Sin commit solo quedan:
   - Cambios del frente de checkout y municipios.
   - Archivos nuevos `?? ...municipios...`.
   - **Actividad concurrente durante esta auditoría** (§4).

   Los archivos Wompi del árbol vivo son idénticos a HEAD.

**Conclusión de alcance:** Codex solo modificó en código funcional los tres archivos que declaró. Añadió `backend/test/phase1-v2.test.js` y su carpeta `remediacion-2/`. **No hay cambios suyos fuera del alcance.**

## 2. Cambios de Codex, uno por uno

**Clasificaciones:**
- **CCN:** correcto y necesario.
- **CRR:** correcto con riesgo residual.

| # | Archivo · función · líneas actuales | Defecto que corrige | Necesidad | Riesgo introducido / regresión posible | Prueba que lo respalda | Resultado independiente | Clasificación |
|---|---|---|---|---|---|---|---|
| 1 | `wompiPaymentService.js` · `canAdvanceTransactionStatus` · 10-13 | NV-01: confundir "lectura posterior" con "estado posterior" | Imprescindible | Conservador: PENDING→VOIDED o estados desconocidos acaban en `failed`/503 (documentado por Codex) | C07, D01–D04, N03 | PASS | **CCN** |
| 2 | `wompiPaymentService.js` · `deferProviderDiscrepancy` · 15-25 | NV-01: persistir la discrepancia antes del 503 | Imprescindible | Ninguno observado. No degrada un recibo ya procesado por otra vía | D01, D07 (fallo real de Mongo), N01, N02 | PASS | **CCN** |
| 3 | `wompiPaymentService.js` · rama de estados · 130-142 | NV-01: aplicar solo progresiones y exigir `processedAt` antes de cerrar el recibo firmado | Imprescindible | Ninguno. Se conserva la precedencia de VOIDED (`tx.status !== "VOIDED"`) y el contraste de vínculo, moneda e importe (l. 122) | D05, D06, D08, C22–C26, R22, N04 | PASS | **CCN** |
| 4 | `wompiPaymentService.js` · retornos · 99, 162, 179, 181, 225 | NV-03: devolver el recibo que realmente terminó | Necesario para verificar la completitud | Los demás llamadores ignoraban el valor devuelto (`checkoutController.js:627`, webhook). Sin efecto | N11, D17, D20 | PASS | **CCN** |
| 5 | `wompiPaymentService.js` · fase 1 · 170-171 | NV-03: no borrar `provider_binding_mismatch` al reutilizar la clave | Necesario para preservar evidencia | Ninguno | C08c, N12 | PASS | **CCN** |
| 6 | `wompiService.js` · `queryError` y `getTransaction` · 4, 139-156 | NV-02: distinguir formato/404 de indisponibilidad | Imprescindible | **(a)** El filtro de formato `^[A-Za-z0-9_-]{1,150}$` ahora también se aplica en la ruta del webhook (l. 109): si un ID real de Wompi no cumpliera el patrón, todos sus eventos responderían 503 (OBS-1; los ejemplos oficiales sí lo cumplen). **(b)** El error tipado llega a `paymentIncidentResolution.js:37` y a la cancelación del cliente (`checkoutController.js:625`): en el primero mejora el código HTTP (de 500 a 409/503); en el segundo se captura igual que antes | D09–D11, N05, N06 | PASS | **CRR** |
| 7 | `orderAdminController.js` · `reconcileWompi` · 199 | NV-02: un `transactionId` vacío enviado explícitamente ya no cae al ID almacenado | Correcto: evita conciliar en silencio un ID distinto del escrito | Ninguno | D09 (`''` da 409) | PASS | **CCN** |
| 8 | `orderAdminController.js` · `reconcileWompi` · 203-230 | NV-02: sin incidencia ante 404 o formato; cierre de todas las `reconciliation_query_failed` con auditoría | Imprescindible | **NR-01 (P3):** `requiresReview` solo se recalcula si la transacción conciliada es APPROVED (l. 228). Además, el cierre no es atómico con las dos fases financieras; Codex lo declara y lo prueba (N09) | C12, D10–D16, N07–N10 | PASS, salvo D13 | **CRR** |
| 9 | `orderAdminController.js` · `reprocessPaymentEvent` · 249-270 | NV-03: cerrar el original solo tras un recibo confiable completado | Imprescindible | **NR-02 (P3):** etiqueta de autosustitución y `processedAt` reescrito. **NR-03 (P3):** las contradicciones permanentes no tienen cierre (comprobación de importe, l. 251) | C08, C08c, D17–D24, N11–N15 | PASS, salvo D17b, D18 y D19b | **CRR** |
| 10 | `backend/test/phase1-v2.test.js` (nuevo) | Versionar P06 y P23 sin tocar los originales | Necesario (lo pedía mi 07 §4.6) | **OBS-3:** importa el arnés de `docs/auditoria-claude/`, acoplando `npm test` a la documentación de auditoría | `ejec-phase1-v2.txt` | 2/2 PASS | **CCN** con observación |

**No hay cambios innecesarios ni defectuosos.** Los tres residuos (NR-01 a NR-03) son P3 y no afectan a dinero, stock ni autorización.

### Lo que Codex conservó, como se le pidió

- El contraste con el `GET` privado.
- La asociación exclusiva por `payment_link_id`.
- La comparación de moneda e importe.
- La firma.
- La modalidad Payment Links.
- La política de stock, cupones y contraentrega.

Lo verifiqué leyendo el código completo de los tres archivos y con C02, C04, C24, C27–C30 en PASS.

## 3. Cambios ajenos a Codex incluidos en `23ce3a6`, posteriores a mi auditoría anterior

| Archivo | Cambio | ¿Afecta a Wompi? | Evaluación |
|---|---|---|---|
| `backend/src/services/paymentMethods.js` | La lista pública queda fija en Wompi y contraentrega, aunque estén activadas las banderas históricas de Nequi | Reduce la superficie de ataque | Positivo. Coherente con V-01, pero **no** es contención en producción. Prueba: `checkout.test.js` "las banderas históricas de Nequi no habilitan otros medios públicos" PASS (`ejec-head-checkout.txt`) |
| `backend/test/helpers/phase2Fixture.cjs` | Añade `setProviderTransaction` (auxiliar de prueba) | No | Las suites históricas no lo usan. Sin efecto en las cifras |
| `backend/src/controllers/checkoutController.js` | La transportadora deja de elegirla el cliente: se ignora y se asigna desde administración | No toca pago, stock ni idempotencia | La comparé con el estado que audité: solo cambian las líneas de transportadora. `checkout.test.js` 10/10 en HEAD |
| `frontend/...checkout`, `AuthFormField.jsx` | Rediseño visual | No | Fuera del alcance financiero |

## 4. Actividad concurrente durante esta auditoría

Entre las 15:07 y al menos las 15:18 (hora local), otro proceso estuvo trabajando en el mismo espacio de trabajo:
- Creó `docs/checkout-audit-fixes/` y `docs/checkout-audit-fixes.md` (38 archivos al cierre, capturas de navegador incluidas).
- Creó `frontend/test/checkout-audit-browser.cjs` y `frontend/test/helpers/checkoutAuditFlow.cjs`.
- Modificó `frontend/src/app/(shop)/checkout/page.js` y `frontend/src/styles/pages/checkout.css` a las 15:11:10.
- `checkoutController.js` sigue con cambios sin commit (municipios).

**No son cambios míos.** Mis ejecuciones solo arrancan el backend en memoria; no abren navegador ni escriben en el frontend.

**No afectan a esta auditoría:** la huella final confirma que ningún archivo backend de Wompi cambió (`04` §4). Las suites se repitieron sobre el árbol vivo con los mismos resultados que en HEAD.

**Recomendación:** antes de integrar o desplegar, revisar y commitear por separado el trabajo de checkout y municipios, con sus propias pruebas. **No mezclarlo** con la remediación Wompi.
