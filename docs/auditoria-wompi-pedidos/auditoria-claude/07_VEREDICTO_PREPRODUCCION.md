# 07 · Veredicto preproducción

2026-11-23 · Auditoría independiente de la remediación de Codex.

## 1. Veredicto

# NO-GO

**No es INDETERMINADO.** Con independencia de las verificaciones externas, hay defectos locales demostrados (NV-01 y NV-02) y un bloqueo de producción abierto (V-01).

**La remediación local no queda aprobada, ni siquiera de forma condicionada.** Le faltan dos correcciones acotadas.

Cuando NV-01 y NV-02 estén corregidos y demostrados, podrá declararse **"remediación local aprobada, condicionada a las validaciones externas"**. Esa declaración no equivale a una aprobación productiva.

## 2. Fundamento

| Criterio del encargo | Estado |
|---|---|
| V-01 abierto | **Sí.** La contención en producción no se ha ejecutado |
| P1 financiero abierto | **Sí, condicional: NV-04.** Sin `payment_link_id` en `GET`, ningún pago se aplica ni se recupera. WP-01 y WP-02 siguen PARCIALES |
| Incertidumbre esencial sobre la asociación y la recuperación de transacciones | **Sí.** E01 no se ha ejecutado y la documentación oficial no garantiza el campo |
| Defectos corregibles introducidos | NV-01 (P2), NV-02 (P2), NV-03 (P3), NV-05 a NV-07 (P3) |
| Defectos originales corregidos y demostrados | WP-03, WP-04, WP-05, WP-06, WP-09, WP-13 y WP-14, en local |
| Pagos falsos, manipulación de importe y aplicación cruzada | No posibles (C02, C04, C10, C24, C27, C28, C29) |
| Contraentrega | Correcta (C30); puede operar sola, como antes |

## 3. Qué demuestra la evidencia y qué no

**Demuestra** que, en un entorno aislado con Wompi simulado según el contrato documentado:

- La firma, la idempotencia, la asociación, la anulación, la validación de importe y moneda y la resolución auditada de incidencias funcionan, incluso bajo concurrencia y ante fallos de Mongo.
- No hay regresiones en lo que ya funcionaba.

**No demuestra:**

- Que Wompi real entregue `payment_link_id` en el evento ni en `GET`.
- Que la firma real coincida.
- Que el webhook productivo sea accesible.
- Que los correos lleguen.
- Que la infraestructura destino tenga replica set, índices y backup.

Nada de esto se marca como aprobado.

## 4. Instrucciones para Codex: solo estas correcciones

1. **NV-01** (`wompiPaymentService.js:113-117`).
   - Sustituir el evento firmado por el estado consultado **solo** si este es posterior en el ciclo de vida:
     - De PENDING a APPROVED, DECLINED o ERROR.
     - De APPROVED a VOIDED.
   - En cualquier otro caso:
     - Guardar `providerObservation`.
     - Poner `processingState = "failed"`.
     - Llamar a `paymentEventReview` dentro de una transacción.
     - Lanzar 503, sin `processedAt`.
   - Prueba: C07 y su variante DECLINED rezagado sobre APPROVED.
2. **NV-02** (`orderAdminController.js:203-211`, `wompiService.getTransaction`).
   - Distinguir 404 de los fallos 5xx y timeout. Ante 404 o un ID inválido, devolver 409 sin incidencia.
   - Tras una conciliación exitosa, cerrar todas las incidencias `reconciliation_query_failed` abiertas del pedido.
   - Prueba: C12.
3. **NV-03** (`orderAdminController.js:225-236`).
   - Tras un reproceso exitoso con el mismo `transactionId`, marcar como procesado el recibo original.
   - Conservar su `associationError` si era `provider_binding_mismatch`.
   - Prueba: C08 y C08c.
4. **NV-05, NV-06 y NV-07 (P3, opcionales antes de salir):**
   - Mover `getTransaction` fuera de `mutateOrder`.
   - No encolar `payment.declined` cuando se anula un pago ya aplicado.
   - Comprobar la unicidad global de la referencia de devolución.
5. **No tocar:**
   - El contraste con `GET`, que defiende WP-06.
   - Las aserciones históricas.
   - La política de stock y cupones.
   - La modalidad Payment Links.
6. **Pruebas.** Añadir versiones nuevas de P06 y P23 sin editar las originales y registrar la sustitución.

## 5. Para el dueño y la operación (fuera del código)

1. Ejecutar la contención de V-01 según `remediacion/06` §V-01 y conservar la evidencia.
2. Ejecutar E01 en Sandbox con el evento y `GET` redactados. Si `GET` no trae el vínculo, decidir la modalidad antes de cualquier despliegue (NV-04).
3. Ejecutar E02 a E06 y las compras de Sandbox con tarjeta, Nequi y PSE.
4. Tomar las decisiones pendientes:
   - Aceptar la retirada de la autocancelación Wompi (WP-09).
   - Vigencia del enlace (WP-07).
   - Última unidad (WP-08).
   - Checkout incierto (WP-12).
   - Cupones (WP-15).
5. Activar y probar la entrega de alertas, y asignar responsables a la bandeja de eventos y al cruce diario con Wompi.

## 6. Cifras finales

| Concepto | Cantidad |
|---|---|
| Pruebas adversariales propias ejecutadas | 35 |
| Aprobadas | 31 |
| Fallidas | 4 (C07, C08, C08c, C12) |
| No aplicables | 0 |
| Verificaciones externas bloqueadas | 6 (E01–E06) |
| Regresiones de Codex reproducidas | 27/27 y 2/2 |
| Suite histórica | 273/275 (P06 y P23 por cambio de política) |
| Matriz original, modo contrato | 44 PASS / 5 FAIL / 1 N/A. Repetidas con el flujo correcto: 4 de los 5 FAIL pasan; X07 sigue en FAIL |
| Hallazgos nuevos | P1 condicional: 1 · P2: 2 · P3: 4 |
| Estado de WP-01 a WP-15 | 7 cerrados en local (03, 04, 05, 06, 09, 13, 14) · 4 parciales (01, 02, 10, 11) · 4 abiertos (07, 08, 12, 15) |
| Cambios que recomiendo revertir | 0 |
