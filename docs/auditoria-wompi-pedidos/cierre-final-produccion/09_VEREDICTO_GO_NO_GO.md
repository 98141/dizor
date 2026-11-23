# 09 · Veredicto final

2026-11-23 · Auditoría independiente GO / NO-GO de producción · DIZOR.

# NO-GO

**No es BLOCKED.** Hay evidencia suficiente para concluir: persisten riesgos relevantes demostrados sobre dinero, integración externa e infraestructura. No falta información para decidir.

## Motivos (cualquiera bastaría)

1. **V-01 abierto en producción.** La versión desplegada acepta eventos Nequi sin firma (modo `mock`). La contención está preparada, pero no se ha ejecutado.
2. **FF-01 · No hay un commit de lanzamiento.** HEAD `23ce3a6` no contiene lo probado: 16 archivos modificados y más de 10 sin seguimiento, entre ellos todo el archivo y la conclusión de eventos, los municipios y el checkout. No se puede autorizar un commit que no existe.
3. **FF-02 · El checkout actual no inició un cobro en el Sandbox real.** Respondió 502, con causa y resultado en el proveedor desconocidos.
4. **FF-03 / E01–E02 · El webhook auténtico nunca se ha recibido.** La firma real, el vínculo en el evento y el procesamiento punta a punta de un pedido de DIZOR no se han observado.
5. **E06 · Ninguna evidencia del entorno real:** replica set, índices (FF-04), respaldo restaurado, TLS, variables y entrega de alertas.
6. **Políticas comerciales sin cerrar:**
   - Vigencia de enlaces: X07 FAIL y `expiresAt: null` real.
   - Última unidad, cupones, checkout incierto y devoluciones.
   - Ninguna implementada y probada, ni mitigada con un control demostrado y aceptado.

## Datos del veredicto

| Elemento | Valor |
|---|---|
| Commit auditado | HEAD `23ce3a6c8d9d…` (rama `main`, 1 por delante de `origin/main`) **más** el árbol sin commit, probado en una copia aislada. **No es desplegable tal cual** |
| Pruebas exactas | `05` §2. G 10/10, F 27/28 (variante 28/28), C 35/35, D 26/28 (variante 28/28), Q 11/11, Z 12/12, R 27/27, L 2/2, N 18/18, v2 2/2, checkout 14/14, municipios 2/2, histórica 273/275, matriz 44/5/1 |
| Hallazgos cerrados (local) | WP-01 a WP-06, WP-09 (técnico), WP-13 y WP-14; NV-01 a NV-03; NR-01 a NR-03; RC-01 (G01–G10 y Q01–Q11) |
| Bloqueos | V-01, FF-01, FF-02, FF-03 (E01/E02), E04, E06, FF-04, FF-05 |
| Riesgos aceptados | **Ninguno.** No hay ninguna aceptación escrita del dueño |
| Evidencia real de Sandbox | 1 pago aprobado con tarjeta sobre un enlace **preexistente**; `GET` privado con `payment_link_id` correcto; retorno con `id` y `env`; el API acepta `expires_at`. **Sin webhook ni pedido de DIZOR** |
| Estado de V-01 | **ABIERTO**: plan preparado, no ejecutado |
| Responsables operativos | **No designados**: solo hay roles propuestos |

## Lo que sí está demostrado (localmente)

El código no permite:
- Confirmar pagos falsos.
- Alterar el importe.
- Aplicar un cobro a otro pedido.
- Duplicar efectos.
- Perder en silencio un evento auténtico.
- Despachar pedidos no pagados o anulados.

Contraentrega funciona de forma independiente. La remediación local es sólida, y **ninguno de los motivos del NO-GO exige rehacerla**.

## Condiciones para reevaluar (en orden)

1. Ejecutar la **contención de V-01** ya, con independencia del lanzamiento.
2. Commitear y publicar un **release único**. Repetir `05` §2 sobre ese SHA.
3. Diagnosticar el **502** y completar en Sandbox, **con ese SHA**: pedido nuevo, enlace, pago, **webhook firmado**, pedido `pagado` una sola vez y reenvío sin duplicar. Además, rechazo, PENDING, PSE y Nequi, y el intento de segundo pago en el mismo enlace.
4. **Infraestructura:** inventario de índices y variables, respaldo restaurado, TLS y webhook de producción, y entrega de alertas.
5. **Decisiones del dueño, por escrito:** las de `08` §B, con procedimiento probado para las que se acepten como riesgo.
6. Plan de despliegue **específico de este release** (`07`), con un procedimiento para limitar Wompi durante la prueba controlada y una reversión que no reabra WP-01 ni WP-06.
7. **Nueva revisión independiente.** Solo entonces podría emitirse **GO — despliegue controlado**.

## Condiciones para habilitar pagos al público (después de un futuro GO)

- Una compra productiva controlada, de bajo importe, conciliada y con la devolución documentada.
- Pedido, inventario, aviso y finanzas verificados.
- Bandeja vacía.
- Aceptación firmada por el dueño.
