# 01 · Informe final independiente: segunda remediación Wompi–pedidos

**Fecha:** 2026-11-23. **Auditor:** Claude, en modo de solo lectura sobre el código funcional.
**Objeto:** las correcciones de Codex a NV-01, NV-02 y NV-03 y la conservación de las garantías de DIZOR.

## 1. Resultado

| | Veredicto |
|---|---|
| **Remediación local** | **A. APROBADA, CONDICIONADA A VALIDACIONES EXTERNAS** |
| **Autorización para producción** | **NO-GO** (NV-04/E01, V-01, E02–E06 y decisiones del dueño abiertas) |

Codex corrigió los tres defectos de forma segura y dentro del alcance:
- C07, C08, C08c y C12 pasan, con mi archivo de pruebas intacto.
- 28 pruebas adversariales nuevas atacaron las rutas modificadas: carreras, rollbacks reales de Mongo, errores HTTP mal clasificados, otro ambiente, transacciones ajenas y permisos.
  - No encontraron ninguna vía para confirmar dinero indebido, perder un pago auténtico ni duplicar efectos.
  - Encontraron tres defectos menores (P3): NR-01 a NR-03.

## 2. Fuentes leídas

| Generación | Ubicación | Estado |
|---|---|---|
| Auditoría original | `docs/auditoria-wompi-pedidos/` 01–08, README, `evidencias/` | Leída en rondas anteriores; arnés reutilizado sin cambios |
| Primera remediación | `remediacion/` | Leída en la ronda anterior; adaptador y suites reejecutados |
| Mi primera auditoría | `auditoria-claude/` (04, 05, 07 y evidencias) | Releída; batería C reejecutada |
| Segunda remediación | `remediacion-2/`: los 6 documentos exigidos, `pruebas-sustituidas.md`, `regresiones.test.cjs`, `antes/`, `evidencias/` | **Los 6 documentos existen; no falta ninguno** |

## 3. Estado del repositorio y alcance

- **HEAD:** `23ce3a6`, en la rama `main`. **La remediación ya está commiteada**, junto con la primera remediación, las auditorías y el rediseño del checkout. El encargo la daba por no commiteada.
- **Alcance de Codex:**
  - Lo aislé comparando mi huella SHA-256 de la ronda anterior con el árbol actual y con las copias `remediacion-2/antes/`, que coinciden byte a byte con lo que audité.
  - Codex solo tocó `wompiPaymentService.js`, `wompiService.js` y `orderAdminController.js`, más `phase1-v2.test.js` y su documentación. **No hay cambios suyos fuera del alcance.**
- **Cambios ajenos:**
  - `paymentMethods.js`, `phase2Fixture.cjs` y `checkoutController.js` (transportadora) vienen del frente de checkout, documentado en `docs/checkout-una-pagina.md`.
  - Hay trabajo de municipios sin commit.
  - **Durante esta auditoría** otro proceso modificó el frontend de checkout y creó `docs/checkout-audit-fixes/`. No afecta a Wompi (`03` §3-4).

## 4. Método

1. Lectura completa del código de los tres archivos y de sus dependencias (`orderOperations`, `orderReadiness`, `notificationEvents`, rutas, `paymentIncidentResolution`, `errorMiddleware`, `OrderNextAction.jsx`).
2. **Ejecución principal sobre una copia aislada de `23ce3a6`** (`git archive`, sin `.env`). Contraste sobre el árbol vivo: mismos resultados.
3. Reproducción de todas las suites de referencia, con conjuntos separados y sin sumar duplicados (`04` §2).
4. Batería nueva `adversarial-2.test.cjs` (D01–D24, 28 casos). Cada prueba fija explícitamente la respuesta del `GET` del proveedor y usa fallos reales de Mongo (`update`, `commitTransaction`, código 2).
5. Huella SHA-256 de 4.141 archivos antes y después.

## 5. Resultados principales

| Conjunto | Resultado |
|---|---|
| Adversariales C (anteriores) | **35/35** (antes 31/4). C07, C08, C08c y C12 en PASS |
| Adversariales D (nuevas) | **23 PASS / 5 FAIL** (D04b, D13, D17b, D18 y D19b → NR-01 a NR-03, todas P3) |
| Codex R01–R27 / L01–L02 / N01–N15 / v2 | 27/27 · 2/2 · 18/18 · 2/2 |
| Suite histórica | **273/275**. P06 y P23 siguen fallando, sin editar; **no es 275/275** |
| Matriz original, modo contrato | 44 / 5 / 1, igual que antes |
| E01–E06 | 6 BLOCKED. Sin evidencia real de transacción de Sandbox |

## 6. Hallazgos

| ID | Prioridad | Resumen |
|---|---|---|
| NR-01 | P3 | Tras conciliar con un intento no APPROVED, un pedido pagado queda `requiresReview` sin incidencias abiertas. Salida a un clic (reconciliar con el ID precargado) |
| NR-02 | P3 | Metadatos de recibo inexactos: "sustituido por sí mismo", `processedAt` reescrito al reprocesar y líneas de historial repetidas |
| NR-03 | P3 | Los recibos con contradicción permanente (estado o importe firmado frente al consultado) no tienen archivo auditado; el contador de alertas no vuelve a cero |
| OBS-1 a OBS-5 | — | Formato de ID en la ruta del webhook (verificar en E01), cierre por pista distinta (deliberado), acoplamiento de `npm test` a `docs/`, commit mezclado y actividad concurrente, NV-05 a NV-07 abiertos |

Detalle completo en `05_HALLAZGOS_NUEVOS.md`.

## 7. Notas de honestidad sobre la ejecución

- **Primer intento sin módulos.** La primera ejecución sobre la copia aislada falló al no encontrar `node_modules` (`ejec-adversarial-original-35.txt`, sustituido por la ejecución válida). Era un error de preparación del entorno, no un resultado de prueba. Lo resolví con una unión de directorio a `backend/node_modules`, solo para lectura.
- **Precarga y ruta corta 8.3.** En la copia aislada, la precarga no reconoció la ruta corta 8.3. La suite histórica y la matriz escribieron sus JSON dentro de **la copia desechable**, no en el repositorio. La corregí antes de cualquier ejecución sobre el árbol vivo, donde las escrituras quedaron desviadas. La huella final lo confirma.
- **Verificación de mis propias pruebas.** Comprobé que `adversarial.test.cjs` no se alteró comparándolo con su contenido original registrado en mi sesión.
- **Sin acciones reales ni sobre git.** No ejecuté el script de Sandbox del frente de checkout, no leí `.env`, no hice commits y no usé Atlas.

## 8. Entregables

| Documento | Contenido |
|---|---|
| `02_VALIDACION_NV01_NV02_NV03.md` | Las 40 verificaciones exigidas, con su evidencia |
| `03_REVISION_DIFF.md` | Alcance, cambio a cambio con su clasificación, y cambios ajenos y concurrentes |
| `04_REGRESIONES_Y_PRUEBAS.md` | Cifras, regresiones por control, integridad y auditoría de las pruebas de Codex |
| `05_HALLAZGOS_NUEVOS.md` | NR-01 a NR-03 y observaciones |
| `06_BLOQUEOS_EXTERNOS.md` | NV-04/E01, V-01, E02–E06 y riesgos comerciales |
| `07_VEREDICTO_FINAL_LOCAL.md` | Veredicto local, estado productivo, WP-01 a WP-15 y lo que falta |
| `evidencias/` | Pruebas, salidas, huellas, precarga y comandos (`evidencias/LEEME.md`) |
