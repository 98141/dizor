# 05 · Regresiones y pruebas

## 1. Qué se probó

**Árbol probado:** una **copia aislada del árbol de trabajo actual**: HEAD `23ce3a6` más todos los cambios sin commit, incluido el RC-01 de `preproduccion/`.
- Excluye `.env`, `.git` y `node_modules`; usa una unión de directorio a `backend/node_modules`, retirada al terminar.
- **No es un release** (FF-01). Las cifras son válidas para ese árbol y **deben repetirse sobre el SHA que se congele**.

**Entorno:** Node v24.15.0 y MongoDB 8.3.2 en un replica set efímero. Wompi simulado, red externa bloqueada y llaves ficticias.

**Escrituras de las suites:** las 6 se desviaron a `evidencias/salidas/`:
- 3 JSON de `auditoria-admin`.
- Los resultados de la matriz.
- 2 archivos `*-origen.json` de las variantes.

## 2. Resultados (conjuntos separados, sin sumar)

| Conjunto | Referencia | Ahora | Salida |
|---|---|---|---|
| **G** (nueva: "concluir seguimiento") | — | **10/10** | `ejec-G.txt` |
| F (mía, ronda anterior) | 27/28 | **27/28**. F32 no llama a "concluir" | `ejec-F.txt` |
| F con conclusión explícita (variante de Codex) | — | **28/28** | `ejec-FA.txt` |
| C (mía) | 35/35 | **35/35** | `ejec-C.txt` |
| D (mía) | 26/28 | **26/28** (D04b y D19b no llaman a archivar) | `ejec-D.txt` |
| D con archivo explícito (variante de Codex) | 28/28 | **28/28** | `ejec-DA.txt` |
| Q01–Q11 (Codex, RC-01) | Codex 11/11 | **11/11** | `ejec-Q.txt` |
| Z (Codex, residuales) | 12/12 | **12/12** | `ejec-Z.txt` |
| R / L / N / v2 | 27/27 · 2/2 · 18/18 · 2/2 | **27/27 · 2/2 · 18/18 · 2/2** | `ejec-R/L/N/V.txt` |
| Checkout y catálogo de municipios (backend) | Codex 14/14 | **14/14** | `ejec-CK.txt` |
| Municipios (frontend, `municipalities.test.cjs`) | — | **2/2** | `ejec-FM.txt` |
| Suite histórica (9 archivos, adaptador) | 273/275 | **273/275** (P06, P23) | `ejec-H.txt` |
| Matriz original, modo contrato | 44/5/1 | **44/5/1** (P13, P20, P22b, P28 y X07 FAIL; P40 N/A) | `ejec-M.txt` |

## 3. Comprobaciones exigidas

| Requisito | Resultado |
|---|---|
| NR-01, NR-02 y NR-03 siguen cerrados | Sí: D13, D17b, D18, F01–F31 y Z |
| NV-01 a NV-03 siguen corregidos | Sí: C07, C08, C08c, C12, D01–D24 y N |
| WP-01 a WP-06 no reaparecen | Sí: C01–C29 y R |
| Las pruebas conservan sus aserciones | Sí. Las variantes de Codex solo insertan la acción nueva y el SHA de mis archivos coincide. Mis archivos C, D y F no se modificaron |
| Pruebas históricas sustituidas identificadas | P06 → P06-v2 y P23 → P23-v2 (`remediacion-2/pruebas-sustituidas.md`). **La sustitución formal sigue sin aprobarse** |
| Checkout en escritorio y móvil | **No ejecutado de forma independiente en esta ronda.** Evidencia de otros frentes: navegador real con 6 anchos y Next real con 20 comprobaciones (`docs/checkout-municipios.md`), y 4 ejecuciones (`docs/checkout-audit-fixes.md`). El 404 original sigue sin explicar |
| El administrador recibe los pedidos correctos | LO: U03 y P37 en la histórica y la matriz. Entrega real de correo sin probar |
| Sin errores de integración nuevos | En local, ninguno. **En Sandbox real, el checkout falló con 502 (FF-02)** |
| Pruebas E2E | Solo las locales de otros frentes. El E2E real (Sandbox) del flujo completo **no existe** |

## 4. Nota de honestidad sobre G06

G06 (concluir el seguimiento frente a un VOIDED simultáneo) resultó seguro las 5 veces: pedido `rechazado`, incidencia abierta y preparación en 409.

Pero en las 5 el VOIDED llegó antes de la consulta, así que **no ejerció el intercalado** que pretendía. La carrera real queda cubierta por la Q10 de Codex (11/11), no por mi prueba.
