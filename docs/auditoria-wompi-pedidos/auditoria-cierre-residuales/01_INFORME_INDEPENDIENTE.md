# 01 · Informe independiente: cierre de NR-01, NR-02 y NR-03

**Fecha:** 2026-11-23. **Auditor:** Claude, en modo de solo lectura sobre el código funcional.

## Resultado

| | Veredicto |
|---|---|
| Cierre local | **A. CIERRE LOCAL APROBADO** |
| Producción | **NO-GO** (E01/NV-04, V-01, E02–E06 y decisiones del dueño) |

Codex corrigió los tres residuos con cambios mínimos y seguros:

- **NR-01:** un pedido pagado ya no queda en revisión sin motivo tras conciliar un intento rechazado. Las incidencias legítimas se conservan.
- **NR-02:** los recibos ya no se declaran "sustituidos por sí mismos" y conservan su primera fecha de proceso. El historial distingue las reconsultas.
- **NR-03:** existe un archivo administrativo motivado, auditado y reversible para las contradicciones permanentes. Está separado del hecho financiero: no confirma pagos, no desbloquea, no altera importes ni stock, no borra evidencia y no puede ocultar un APPROVED firmado.

**Residuo P3 (RC-01):** el evento archivado pasa a un "seguimiento financiero" sin salida que sigue contando en las alertas. Es una decisión conservadora de Codex y la debe zanjar el dueño (`05`).

## Fuentes y control de cambios

- **Fuentes leídas:** `cierre-residuales/` completa (01–06, pruebas y evidencias), mis informes `auditoria-claude-2/` y el código y el diff reales.
- **HEAD:** `23ce3a6` sin commits nuevos. **Alcance de Codex:** 8 archivos modificados más `paymentEventArchive.js`.
  - Verificado contra su propia línea base (4.216 archivos: solo cambian esos 8).
  - Verificado contra mi huella anterior: sus copias "originales" coinciden con lo que audité.
- **Sin efectos colaterales:** ni dependencias nuevas, ni pruebas históricas modificadas, ni evidencias previas alteradas. El trabajo concurrente de checkout está intacto. Detalle en `02`.

## Método

1. **Revisión línea a línea** del diff y del servicio nuevo.
2. **Copia aislada** del árbol de trabajo, sin `.env`, para ejecutar todo.
3. **Batería adversarial nueva F01–F35** (28 casos). Ataca NR-01 con órdenes distintos de APPROVED y DECLINED, varias transacciones, errores del proveedor, fallo real de `commitTransaction` y concurrencia; audita campo a campo `PaymentEvent` (NR-02); e intenta abusar del archivo (NR-03): sin autenticación, como vendedor, sin motivo, sin conciliación, con evidencia ajena o de otro ambiente, repetido, concurrente, con webhooks posteriores, reproceso y fallo real de `insert` en Mongo.
4. **Reproducción** de todas las suites de referencia y de las nuevas de Codex.
5. **Huella SHA-256** de 4.295 archivos antes y después.

## Resultados clave

| Conjunto | Resultado |
|---|---|
| F (nueva) | 27/28. F32 corresponde a RC-01 |
| D original | 26/28. D04b y D19b exigen ocultar sin decisión; la variante de Codex con archivo explícito da 28/28 |
| C, Z, R, L, N, v2 | 35/35 · 12/12 · 27/27 · 2/2 · 18/18 · 2/2 |
| Histórica / Matriz | 273/275 (P06, P23) / 44-5-1, igual que antes |

## Notas de honestidad

- **Primera versión de F32 mal planteada.** Comparaba el total global de alertas, que también sube al crear un pedido. La corregí para medir solo los grupos de eventos de pago y repetí la batería; la cifra es la corregida.
- **Mis pruebas D04b y D19b.** Las escribí antes de que existiera la acción de archivo, y su aserción presupone una retirada automática que mi propia recomendación descartaba. No las modifico. Acepto la variante de Codex tras comprobar que solo inserta la llamada de archivo.
- **Interfaz no ejecutada.** No probé el panel en el navegador. Lo revisé en el código y me apoyo en la evidencia de navegador de Codex.

## Entregables

| Documento | Contenido |
|---|---|
| `02_REVISION_DIFF.md` | Control de cambios y clasificación de los 10 cambios |
| `03_VALIDACION_NR01_NR03.md` | Cada verificación exigida, con su prueba |
| `04_PRUEBAS_EJECUTADAS.md` | Entorno, cifras, diferencias y revalidación de garantías |
| `05_HALLAZGOS_NUEVOS.md` | RC-01 y observaciones |
| `06_RIESGOS_RESIDUALES.md` | Riesgos locales, externos y comerciales |
| `07_VEREDICTO.md` | Veredicto local, producción e integridad |
| `evidencias/` | Pruebas, salidas, huellas y comandos (`LEEME.md`) |
