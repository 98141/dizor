# 04 · Regresiones y pruebas

## 1. Entorno y aislamiento

**Software:** Node v24.15.0 y MongoDB 8.3.2, en un replica set efímero en loopback (`mongodb-memory-server` tomado en lectura de un proyecto hermano).

**Wompi simulado:**
- La red externa está bloqueada (`hosts externos bloqueados: []`).
- Llaves ficticias `prv_test_` y un secreto aleatorio por ejecución.
- Correo desactivado.

**Nunca se usó:** `.env`, Atlas, llaves reales ni el Sandbox real.

**Dónde se ejecutó:**
- **Ejecución principal: copia aislada de `23ce3a6`** (`git archive`) en el directorio temporal de la sesión.
  - No incluye `backend/.env`.
  - Usa una unión de directorio (junction) a `backend/node_modules`, solo para lectura.
  - Fuera de dos archivos de checkout, es idéntica al árbol vivo salvo el fin de línea: comprobado en 256 archivos `.js`, `.cjs` y `.json`.
- **Ejecución de contraste:** el árbol vivo, con la precarga de desvío.

**Precarga `evidencias/preservar-claude-2.cjs`.** Desvía cualquier escritura bajo `docs/` del árbol probado a `evidencias/salidas/<ejecución>/`.

**Incidencia honesta con la precarga.** En la copia aislada, la primera versión de la precarga no reconoció la ruta corta 8.3 de Windows (`ASUSEX~1`). Por eso, la suite histórica y la matriz escribieron sus JSON en los `docs/` **de la copia desechable**, no en el repositorio.
- La corregí normalizando con `realpath` y verifiqué que desvía rutas largas y cortas (`salidas/prueba-precarga/`).
- Todas las ejecuciones sobre el **árbol vivo** se hicieron ya con la versión corregida. Las tres escrituras históricas quedaron desviadas (`salidas/wt-historica/`).
- La huella del repositorio lo confirma (§4).

Variables y comandos: `evidencias/entorno.sh` y `evidencias/LEEME.md`.

## 2. Cifras (conjuntos separados, sin sumar)

| Conjunto | Referencia anterior | Ejecutadas | PASS | FAIL | N/A | Árbol | Salida |
|---|---|---|---|---|---|---|---|
| Mis adversariales C01–C34 (sin cambios) | 35: 31/4 | 35 | **35** | 0 | 0 | HEAD y vivo | `ejec-adversarial-original-35.txt`, `ejec-arbol-vivo-adversarial-35.txt` |
| Mis adversariales nuevas D01–D24 | — | 28 | **23** | **5** | 0 | HEAD y vivo | `ejec-adversarial-2.txt`, `ejec-arbol-vivo-adversarial-2.txt` |
| Regresiones de Codex R01–R27 | 27/27 | 27 | 27 | 0 | 0 | HEAD y vivo | `ejec-codex-r01-r27.txt`, `ejec-arbol-vivo-codex-r.txt` |
| Limitadores L01–L02 | 2/2 | 2 | 2 | 0 | 0 | HEAD | `ejec-codex-limites.txt` |
| Nuevas de Codex N01–N15 (18 casos) | — | 18 | 18 | 0 | 0 | HEAD y vivo | `ejec-codex-n01-n15.txt`, `ejec-arbol-vivo-codex-n.txt` |
| P06-v2 y P23-v2 | Pendientes | 2 | 2 | 0 | 0 | HEAD | `ejec-phase1-v2.txt` |
| Suite histórica (9 archivos, adaptador de contrato) | 273/275 | 275 | **273** | **2** | 0 | HEAD y vivo | `ejec-suite-historica-9.txt`, `ejec-arbol-vivo-historica-9.txt` |
| Suite histórica sin adaptador (informativa) | — | 275 | 249 | 26 | 0 | HEAD | `ejec-historica-9-sin-adaptador.txt` |
| Matriz original, modo contrato | 44/5/1 | 50 | 44 | 5 | 1 | HEAD | `ejec-matriz-contrato.txt` |
| Checkout del otro frente (informativa) | — | 10 / 14 | 10 / 14 | 0 | 0 | HEAD / vivo | `ejec-head-checkout.txt`, `ejec-arbol-vivo-checkout.txt` |
| Externas E01–E06 | 6 BLOCKED | 0 | — | — | — | — | `06` |

### Explicación de las diferencias

- **Adversariales C: de 31/4 a 35/0.**
  - Pasan C07 (NV-01), C08 y C08c (NV-03) y C12 (NV-02).
  - El archivo es el mío, sin ninguna aserción debilitada (`02`, introducción).
  - Coincide con lo que declara Codex (35/35).
- **Los 5 FAIL de la batería D son residuos P3**, sin efecto sobre el dinero:
  - D13 corresponde a NR-01.
  - D17b y D18 corresponden a NR-02.
  - D04b y D19b corresponden a NR-03.
  - Ninguno es una regresión de una garantía anterior.
- **Suite histórica, 273/275.** Los mismos fallos originales: **P06** (`phase1.test.js:559`, exige `pagado` con importe o moneda discrepantes) y **P23** (`:753`, exige autocancelar un Wompi PENDING). **No se presenta como 275/275.** Comprobé que los archivos `backend/test/phase*.test.js` son idénticos a `9289c7b` (`git diff 9289c7b HEAD` vacío en ellos).
- **Suite histórica sin adaptador, 249/26.** Reproduce los "26 fallos" que cita el frente de checkout (`docs/checkout-una-pagina.md`, l. 47-49).
  - Son pruebas antiguas que publican eventos sin fijar la respuesta de `GET` o usan `sku`.
  - Miden la dependencia de la consulta privada, no defectos.
  - No contradicen el 273/275, que usa el adaptador auditado en la ronda anterior.
- **Matriz, 44/5/1.** Los mismos FAIL que antes (P13, P20, P22b, P28 y X07) y P40 N/A.
  - P13, P20, P22b y P28 fallan porque la matriz sigue el flujo antiguo. El flujo correcto pasa en C09, C16, C17 y C33 (35/35).
  - X07 refleja que WP-07 sigue abierto.
- **El total de `npm test` cambia.** Al incluir `phase1-v2.test.js` en el patrón `test/*.test.js`, el denominador pasa a ser otro. Por eso la suite histórica se ejecutó enumerando sus 9 archivos (`remediacion-2/evidencias/historicas-archivos.json`).

## 3. Regresiones financieras y de seguridad

| Control | Pruebas | Resultado |
|---|---|---|
| **WP-01** Inbox durable, eventos no asociados, repetidos | C01, C05, C06, C07, D01, D07 | PASS |
| **WP-02** Recuperación sin webhook por ID verificado | C09, C10, C12, C13, D10, D12, D14 | PASS |
| **WP-02** Detección de discrepancias | C27, D19 | PASS |
| **WP-03** Resolución de incidencias: permisos, motivo, evidencia, `AuditLog`, bloqueo de despacho | C14–C21, D12, D15, R12–R14 | PASS |
| **WP-04** APPROVED→VOIDED, VOIDED duplicado, APPROVED antiguo, pedido enviado o entregado, finanzas, bloqueo | C22–C26, D05, D06, R22, N04 | PASS |
| **WP-05** Importe inferior o superior, moneda distinta | C27, P21b, P06-v2, D19 | PASS |
| **WP-06** Referencia contradictoria, vínculo distinto, transacción de otro pedido, asociación ambigua | C04, C24, C28, C29, P23 y P24 de la matriz, D14, D21 | PASS |
| Eventos falsificados y firma inválida | C02 (5 variantes), P09, P10 | PASS |
| Contraentrega | C30, P31, P32 | PASS |
| Métodos deshabilitados | C32, P33, `checkout.test.js` | PASS |
| Precio calculado en el servidor y cupón manipulado | P21, P22 | PASS |
| Idempotencia y doble clic | P15, P16, P17, `checkout.test.js` (concurrencia, misma clave) | PASS |
| Inventario no negativo y última unidad | P34, P35, Q03/Q05 (con adaptador) | PASS |
| Historial y auditoría | D12, R12 | PASS |
| Cupones | C17, C18, P35 (con adaptador) | PASS |
| Alertas | C01, D01, P37 | PASS |
| Permisos y APIs (BOLA/IDOR, roles) | C11, D15, P26, P27 | PASS |

**No hay regresiones relevantes.** Ninguna característica se dio por buena solo leyendo el código: cada fila tiene al menos una prueba ejecutada en esta ronda.

## 4. Integridad del repositorio

- **Huella previa:** 4.141 archivos de `backend/src`, `backend/test`, `frontend/src`, `frontend/test`, `docs` (menos esta carpeta), `.gitattributes` y `package.json`. Está en `evidencias/huella-sha256-antes.txt`.
- **Verificación final:** registrada en `evidencias/huella-verificacion-final.txt`.
  - Los únicos cambios son los dos archivos de frontend que modificó el proceso concurrente a las 15:11 (`03` §4).
  - También aparecen archivos nuevos de ese mismo proceso: 38 en `docs/checkout-audit-fixes*`, más `frontend/test/checkout-audit-browser.cjs` y `frontend/test/helpers/checkoutAuditFlow.cjs`.
  - **Ningún archivo backend, ninguna prueba original y ninguna evidencia o informe anterior cambió.**
- **Git:** no hice commits. HEAD sigue en `23ce3a6`.

## 5. Auditoría de las pruebas nuevas de Codex

| Pregunta | Hallazgo |
|---|---|
| ¿Detectan el defecto? | Sí. Codex conserva `nuevas-antes.txt` con 12 FAIL antes del cambio, y yo reproduje C07, C08, C08c y C12 en FAIL en la ronda anterior. Las N-tests fijan el `GET` explícitamente en cada caso (sin fixture favorable) |
| ¿Inyecciones reales? | Sí. Usan `failCommand` con código 2 (no reintentable) en `findAndModify`, y fallos de transporte y HTTP mediante una envoltura de `fetch`. N09 y N15 usan parches de método (`AuditLog.create`, `save`), algo aceptable para fallos de cierre; yo lo complementé con un fallo real de `commitTransaction` (D20) |
| ¿Aserciones débiles? | N13 acepta `status >= 400` para la respuesta con otro ID; el valor real es 503 (D11 y D22 lo fijan). N02 acepta `>= 500`; el valor real es 500 (D07). Son débiles pero justificables |
| ¿Hay huecos? | No cubren estos casos, que cubre mi batería D: un DECLINED firmado con `GET` PENDING o APPROVED (D03, D04); VOIDED antes que APPROVED (D06); reproceso de un recibo procesado (D18); autosustitución de metadatos (D17b); conciliación con un intento no APPROVED (D13); contradicciones permanentes (D04b, D19b); recibo de otro ambiente (D24) |
| P06-v2 y P23-v2 | Reflejan el contrato vigente: P06-v2 exige que no figure como pagado, conserve la evidencia, mantenga el stock y bloquee la preparación; P23-v2 exige un 409 al cliente sin cambio de estado. Los originales siguen intactos y en FAIL. **La aceptación del dueño de la política de autocancelación sigue PENDIENTE**: la v2 documenta la conducta, no la aprueba |
| Acoplamiento | `phase1-v2.test.js` y `remediacion-2/regresiones.test.cjs` dependen de `auditoria-claude/evidencias/fixture-claude.cjs` y del arnés `evidencias/auditoria-wompi.cjs`. Si se mueve la documentación de auditoría, se rompe `npm test` (OBS-3) |
