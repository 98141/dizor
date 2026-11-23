# 02 · Revisión del diff

## 1. Control de cambios

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Rama y HEAD | `main`, `23ce3a6`. Sin commits nuevos; los cambios del cierre siguen sin commit | `evidencias/estado-repositorio.txt` |
| Archivos afectados por Codex | **8 modificados más 1 nuevo**: `orderAdminController.js`, `wompiPaymentService.js`, `models/paymentEvent.js`, `routes/adminOrderRoutes.js`, `adminAlertController.js`, `alertas/page.js`, `PaymentEventAlerts.jsx`, `orderAdminService.js` y el nuevo `services/paymentEventArchive.js` | Contra la línea base de Codex (4.216 archivos): exactamente esos 8 cambian. Contra mi huella anterior (`auditoria-claude-2`): los mismos 8, más 2 archivos de checkout que ya habían cambiado antes, por el proceso concurrente |
| Copias previas de Codex (`cierre-residuales/evidencias/originales/`) | Coinciden byte a byte con lo que audité en la ronda anterior (8/8) | Comparación SHA-256 |
| Cambios ajenos al alcance | Ninguno de Codex. El trabajo de checkout y municipios sigue sin cambios desde la línea base de Codex | `linea-base-sha256.json` comparado ahora |
| Evidencias y auditorías anteriores | Intactas. Ningún archivo de `docs/auditoria-wompi-pedidos/` anterior a esta carpeta cambia respecto a mi huella; mi carpeta `auditoria-claude-2/` no tiene ninguna modificación posterior a su cierre | `huella-sha256-antes.txt` |
| Dependencias | Ninguna nueva. `package.json` y `package-lock.json` sin cambios | `git diff HEAD` |
| Pruebas históricas | `backend/test/phase*.test.js` idénticas a `9289c7b` | `git diff --stat 9289c7b` vacío |
| Mis pruebas C y D | Sin modificar. La variante de Codex vive aparte y no las reescribe (el SHA de D coincide) | `variante-archivo-origen.json` |

## 2. Cambios uno por uno

**Clasificaciones:**
- **CCN:** correcto y necesario.
- **CRR:** correcto con riesgo residual.

| # | Archivo · líneas | Hallazgo | Cambio | Riesgo | Pruebas | Clasificación |
|---|---|---|---|---|---|---|
| 1 | `orderAdminController.js:228` | NR-01 | Recalcula `requiresReview` si se cerraron fallos de consulta | Ninguno: las condiciones que bloquean existen como incidencias y `canFulfill` exige stock | D13, F01–F08, Z01, N08 | **CCN** |
| 2 | `orderAdminController.js:280-286` | NR-02 | Solo etiqueta la sustitución entre recibos distintos | Ninguno | D17b, F10–F13 | **CCN** |
| 3 | `wompiPaymentService.js:140-145` | NR-02 | La rama de sustitución del webhook conserva el primer `processedAt`, dentro de una transacción | Ninguno: el `associationError` incondicional es correcto porque esa rama solo se alcanza tras validar el vínculo | F12, Z02 | **CCN** |
| 4 | `wompiPaymentService.js:214, 222, 228` | NR-02 | "Reconsulta" en el historial; `processedAt ||=` | El historial sigue acumulando una línea por repetición, ahora bien etiquetada | D18, F10 | **CCN** |
| 5 | `models/paymentEvent.js:18-26` | NR-03 | Subdocumento opcional `administrativeArchive` | No requiere migración (valor por defecto); separa la disposición administrativa del hecho financiero, en vez de falsear `processedAt` (mejor que lo que propuse en la ronda anterior) | F25 | **CCN** |
| 6 | `services/paymentEventArchive.js` (nuevo) | NR-03 | Validación, elegibilidad estricta, transacción con `AuditLog`, reapertura | **RC-01**: `financialFollowUp` siempre es `true` y nunca termina | F20–F35, Z03–Z11 | **CRR** |
| 7 | `routes/adminOrderRoutes.js:19-20` | NR-03 | Dos rutas para admin y superadmin | Ninguno; el servicio revalida el rol | F20 | **CCN** |
| 8 | `orderAdminController.js:237-260` | NR-03 | Vistas `pending`, `financial-follow-up` y `verified` (validada), `count`; reproceso de un archivado da 409 | Ninguno | F28, F34 | **CCN** |
| 9 | `adminAlertController.js:42-51` | NR-03 | Grupo `financialFollowUp`, sumado al total | Es la causa visible de RC-01 | F31, F32 | **CRR** |
| 10 | `PaymentEventAlerts.jsx`, `orderAdminService.js`, `alertas/page.js` | NR-03 | Formularios de archivo y reapertura; contadores | React escapa el contenido. Botón deshabilitado sin evidencia. **No ejecuté la interfaz**: me apoyo en el código y en la evidencia de navegador de Codex (`panel-result.json`, capturas) | Revisión de código | **CCN** (UI no verificada de forma independiente) |

**No hay cambios innecesarios, incompletos ni defectuosos.** No hay refactorizaciones cosméticas. Codex no tocó la firma, la consulta privada, la asociación, la política de estados, stock y cupones, contraentrega ni el checkout.
