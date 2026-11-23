# 07 · Veredicto final

2026-11-23 · Segunda auditoría independiente de la remediación Wompi–pedidos · Código: `23ce3a6`.

## 1. Veredicto de la remediación local

# A. REMEDIACIÓN LOCAL APROBADA, CONDICIONADA A VALIDACIONES EXTERNAS

| Condición del encargo | ¿Se cumple? | Evidencia |
|---|---|---|
| NV-01, NV-02 y NV-03 corregidos | **Sí** | `02`: 14 + 14 + 12 verificaciones. Los residuos son P3 |
| C07, C08, C08c y C12 pasan | **Sí**, sin aserciones debilitadas | `ejec-adversarial-original-35.txt` (35/35); archivo comparado con su versión original |
| Sin vulnerabilidades locales nuevas bloqueantes | **Sí** | `05`: solo NR-01 a NR-03, todos P3, sin efecto financiero |
| Se conservan las defensas existentes | **Sí** | R01–R27 27/27, matriz 44/5/1 igual que antes, C02/C04/C24/C27–C30 en PASS |
| Sin regresiones relevantes | **Sí** | Histórica 273/275 con los **mismos** P06 y P23; árbol vivo igual que HEAD |
| Resultados y bloqueos documentados | **Sí** | `04` y `06` |

### Por qué no es B ni C

- **No es B.** Los 5 FAIL nuevos (D04b, D13, D17b, D18 y D19b) son residuos P3:
  - Un bloqueo con salida inmediata.
  - Metadatos inexactos.
  - Falta de una acción de archivo.
  - Ninguno permite confirmar dinero indebido, perder un pago auténtico ni duplicar efectos.
- **No es C.** Toda la evidencia necesaria para juzgar el código local estuvo disponible y se reprodujo. Lo que no se puede ejecutar aquí es externo y se trata en §2.

**Recomendado, no obligatorio para esta aprobación:** corregir NR-01, NR-02 y NR-03 (`05`) antes de abrir ventas. Son cambios pequeños y acotados.

## 2. Estado de autorización para producción

# NO-GO

| Bloqueo | Estado | Referencia |
|---|---|---|
| NV-04 / E01: `payment_link_id` en el evento **y** en `GET`, no documentado oficialmente | **BLOCKED.** Si falta, ningún pago Wompi se aplica ni se recupera | `06` §1 |
| V-01: contención del webhook Nequi en producción | **ABIERTO.** El cambio local no protege lo desplegado | `06` §2 |
| E02–E06: firma real, retorno, reintento, vigencia e infraestructura | **BLOCKED**, 0 ejecutadas | `06` §3 |
| Aceptación escrita de la política de autocancelación (WP-09) | **PENDIENTE** | `06` §4 |
| Decisiones WP-07, WP-08, WP-12 y WP-15 | **PENDIENTES** | `06` §4 |
| Entrega real de alertas por correo y responsables de la bandeja | **Sin verificar** | WP-10 |

Una remediación local aprobada **no autoriza ventas reales**.

## 3. Estado de WP-01 a WP-15 tras la segunda remediación

| ID | Ronda anterior | Ahora | Motivo del cambio |
|---|---|---|---|
| WP-01 | PARCIAL | **Parte local cerrada.** Sigue BLOCKED (E01, E02) | NV-01 y NV-03 corregidos (C07, C08, C08c, D01–D08) |
| WP-02 | PARCIAL | **Parte local cerrada.** Sigue BLOCKED (E01) | NV-02 corregido (C12, D09–D16). NR-01 es P3 |
| WP-03 | CERRADO (local) | CERRADO (local) | La incidencia `reconciliation_query_failed` ya tiene salida |
| WP-04 | CERRADO (local) | CERRADO (local) | Reconfirmado: C22–C26, D05, D06 |
| WP-05 | CERRADO (local) | CERRADO (local) | C27, P06-v2 |
| WP-06 | CERRADO (local), BLOCKED (E01) | Sin cambio | C04, C24, C28, C29, D14, D21 |
| WP-07 | ABIERTO | ABIERTO | Evidencia SB nueva de que los enlaces no vencen |
| WP-08 | ABIERTO | ABIERTO | Pendiente de decisión |
| WP-09 | CERRADO (local), condicionado | Sin cambio | Aceptación del dueño pendiente; P23-v2 en PASS |
| WP-10 | PARCIAL | PARCIAL. BLOCKED (entrega) | NV-01 ya no oculta recibos. Queda NR-03 (fatiga de alertas) y la entrega real |
| WP-11 | PARCIAL | PARCIAL | Sin cambios en esta ronda |
| WP-12 | ABIERTO | ABIERTO | Pendiente de decisión y externo |
| WP-13 | CERRADO (local) | CERRADO (local) | — |
| WP-14 | CERRADO (local) | CERRADO (local) | L01 y L02 en PASS |
| WP-15 | ABIERTO | ABIERTO | Pendiente de decisión |

## 4. Qué falta exactamente para autorizar producción, en orden

1. **V-01:** ejecutar la contención en producción y guardar la evidencia.
2. **E01:** una transacción real de Sandbox, con el evento y el `GET` redactados, siguiendo `06` §1.
   - Si `GET` no trae `payment_link_id`: decidir la modalidad (Web Checkout con referencia firmada) **antes** de cualquier despliegue, y volver a auditar.
3. **E02–E06:** compras de Sandbox con tarjeta, Nequi y PSE (aprobada y rechazada); reintento en el mismo enlace; anulación de una tarjeta aprobada; configuración del panel y TLS; replica set, índices y backup del destino.
4. **Decisiones del dueño:** autocancelación (WP-09), vigencia (WP-07), última unidad (WP-08), checkout incierto (WP-12) y cupones (WP-15).
5. **Operación:** activar y probar el correo de alertas; asignar responsables de la bandeja y del cruce diario con el panel de Wompi; procedimiento de devolución con doble control.
6. **Recomendado:** NR-01, NR-02 y NR-03 (P3) y NV-05 a NV-07 (P3).
7. **Integración:** revisar y commitear por separado el trabajo concurrente de checkout y municipios (`03` §3-4) antes de desplegar el árbol completo.

## 5. Instrucciones para Codex (si se corrigen los P3)

**Solo estas correcciones:**
- **NR-01:** en `reconcileWompi`, recalcular `requiresReview` desde las incidencias abiertas siempre que se cierren fallos de consulta. Prueba: D13.
- **NR-02:**
  - No marcar como sustitución cuando el recibo verificado es el original.
  - Usar `processedAt ||=` en la fase 2.
  - Opcionalmente, 409 al reprocesar un recibo ya procesado.
  - Pruebas: D17b y D18.
- **NR-03:** decisión de archivo auditada (admin, motivo, `AuditLog`, exige un recibo confiable procesado o un pedido cerrado), sin borrar ni migrar. Pruebas: D04b y D19b.

**No tocar:**
- El contraste con `GET` ni la asociación por vínculo.
- La regla de progresión de estados.
- La clasificación de errores de `getTransaction`.
- Las aserciones históricas ni las de `adversarial*.test.cjs`.

**Verificación:**
- `adversarial-2.test.cjs`: 28/28.
- `adversarial.test.cjs`: 35/35.
- R 27/27, N 18/18, v2 2/2.
- Histórica 273/275 (P06 y P23).
- Matriz 44/5/1.

## 6. Cifras finales

| Concepto | Cantidad |
|---|---|
| Adversariales anteriores (C) | 35 ejecutadas · 35 PASS · 0 FAIL (antes 31/4) |
| Adversariales nuevas (D) | 28 ejecutadas · 23 PASS · 5 FAIL (todas P3) · 0 N/A |
| Regresiones de Codex R / L / N / v2 | 27/27 · 2/2 · 18/18 · 2/2 |
| Suite histórica | 273/275 (P06 y P23, cambio de política) |
| Matriz original, modo contrato | 44 PASS / 5 FAIL / 1 N/A |
| Verificaciones externas | 6 BLOCKED (E01–E06). Una evidencia SB parcial para E05/WP-07 |
| Hallazgos nuevos | P1: 0 · P2: 0 · P3: 3 (NR-01 a NR-03) · 5 observaciones |
| Cambios de Codex | 10 revisados: 7 correctos y necesarios (uno con observación), 3 correctos con riesgo residual, 0 incompletos, 0 defectuosos, 0 innecesarios |
| Cambios que recomiendo revertir | 0 |
