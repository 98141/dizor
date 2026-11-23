# 04 · Pruebas ejecutadas

## 1. Entorno

- **Software:** Node v24.15.0 y MongoDB 8.3.2 en un replica set efímero en loopback.
- **Wompi simulado:** red externa bloqueada (`hosts externos bloqueados: []`), llaves ficticias y correo desactivado.
- **Nunca se usó:** `.env`, Atlas ni Wompi real.

**Árbol probado:** una **copia aislada del árbol de trabajo actual**, con los cambios de Codex sin commit, en el directorio temporal de la sesión.
- Excluye `.git`, `node_modules`, `.next` y `.env*`; comprobé que no contiene ningún `.env`.
- Usa una unión de directorio (junction) a `backend/node_modules`, quitada al terminar.
- Los 4 archivos de código clave son idénticos byte a byte a los del repositorio.

**Precarga:** `evidencias/preservar.cjs`, con normalización de rutas cortas 8.3. Desvió las 5 escrituras de las suites a `evidencias/salidas/`:
- 3 JSON de `docs/auditoria-admin`.
- `resultados-auditoria-wompi.json` de la matriz.
- `variante-archivo-origen.json`, que reescribe la variante de Codex.

Comandos en `evidencias/LEEME.md`.

## 2. Resultados (conjuntos separados, sin sumar)

| Conjunto | Referencia | Ahora | Salida |
|---|---|---|---|
| Mis adversariales C (35) | 35/35 | **35/35** | `ejec-C-original.txt` |
| Mis adversariales D (28), sin modificar | 23/28 | **26 PASS / 2 FAIL** (D04b, D19b) | `ejec-D-original.txt` |
| Variante D de Codex, con archivo explícito y mismas aserciones | — | **28/28** | `ejec-codex-variante-D.txt` |
| Mi batería nueva F (28) | — | **27 PASS / 1 FAIL** (F32 → RC-01) | `ejec-F-cierre.txt` |
| Residuales de Codex Z01–Z11 (12) | Codex: 12/12 | **12/12** | `ejec-codex-Z-residuales.txt` |
| Codex R01–R27 | 27/27 | **27/27** | `ejec-codex-R.txt` |
| Limitadores L01–L02 | 2/2 | **2/2** | `ejec-codex-L.txt` |
| Segunda remediación N01–N15 (18) | 18/18 | **18/18** | `ejec-codex-N.txt` |
| P06-v2 y P23-v2 | 2/2 | **2/2** | `ejec-v2.txt` |
| Suite histórica (9 archivos, adaptador de contrato) | 273/275 | **273/275** (P06 y P23, sin editar) | `ejec-historica-9.txt` |
| Matriz original, modo contrato | 44/5/1 | **44/5/1** (P13, P20, P22b, P28 y X07 FAIL; P40 N/A) | `ejec-matriz-contrato.txt` |
| Externas E01–E06 | 6 BLOCKED | **6 BLOCKED** | — |

## 3. Diferencias y sus causas

- **D: de 23/5 a 26/2.**
  - Pasan D13 (NR-01) y D17b/D18 (NR-02).
  - D04b y D19b exigen que la bandeja quede vacía **sin ninguna decisión**. Correctamente, siguen fallando, porque el cierre ahora requiere un archivo motivado (`03` §NR-03).
  - La variante con archivo explícito pasa 28/28. Revisé que solo inserta la llamada de archivo: el SHA de mi archivo coincide y hay 2 inserciones y 0 aserciones cambiadas.
- **F32 FAIL.** Es la medida limpia de RC-01: la suma de los grupos de eventos de pago pasa de 16 a 17 tras archivar una contradicción ya conciliada.
  - **Corrección honesta de mi prueba:** la primera versión de F32 comparaba el `totalCount` global, que también sube al crear el pedido nuevo (grupo "pedidos nuevos"), así que la medida estaba contaminada.
  - La reescribí para medir solo los grupos de eventos de pago y repetí la batería. La cifra 27/1 es la de la versión corregida.
- **Sin otras diferencias.** Coinciden con las referencias y con lo que declara Codex (`cierre-residuales/03`).

## 4. Revalidación de garantías

| Garantía | Pruebas (todas PASS) |
|---|---|
| WP-01 y WP-02 (inbox, no asociados, recuperación por ID verificado, asociación correcta, discrepancias) | C01–C13, D01–D16 |
| WP-03 (resolución, permisos, motivo, evidencia, `AuditLog`, bloqueo) | C14–C21, R12–R14, F04, F30 |
| WP-04 (APPROVED→VOIDED, duplicados, APPROVED antiguo, enviado y entregado, finanzas) | C22–C26, D05, D06, F05, F27, R22 |
| WP-05 y WP-06 (importe, moneda, referencia, vínculo, otro pedido, firma, ambigüedad) | C02, C04, C24, C27–C29, D14, D19, D21, F24 |
| NV-01, NV-02 y NV-03 | C07, C08, C08c, C12, D01–D24 (salvo D04b y D19b, que son el criterio de archivo), N01–N15 |
| Idempotencia y eventos repetidos | C06, C13, D08, D23, F08, F10, F26, P11, P16 |
| Contraentrega | C30, P31, P32 |
| Inventario y cupones | C17, P34, P35, F25 (stock y cupón intactos al archivar), históricas Q03 y Q05 |

## 5. Integridad

Huella SHA-256 antes y después (`evidencias/huella-sha256-antes.txt` y `huella-verificacion-final.txt`). Resultado en `07` §4.
