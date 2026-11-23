# 01 · Informe ejecutivo — Auditoría Wompi, pagos y pedidos DIZOR

2026-11-23 · Auditoría independiente previa a producción · Alcance: checkout, Wompi, pagos, pedidos, inventario, contraentrega y sus dependencias directas · Código: commit `9289c7b` (local; **no desplegado**).

## Estado general

**Veredicto: NO-GO** (detalle en `08_VEREDICTO_FINAL.md`).

La base de seguridad es sólida: los webhooks falsificados o manipulados se rechazan, el monto lo calcula el servidor, nadie puede marcar un pago Wompi como pagado a mano y los eventos repetidos o concurrentes no duplican efectos. Pero el sistema **puede perder la confirmación de pagos reales sin dejar rastro**, **no tiene forma de recuperarlos** y **bloquea pedidos pagados legítimos sin salida administrativa**. Además, la asociación de pagos depende de un campo que la documentación oficial de Wompi no garantiza y que no se ha probado contra Wompi real.

## Cómo está integrado

Wompi **Links de pago**: el backend crea un enlace de un solo uso con el monto del pedido y redirige al cliente; la confirmación llega por webhook firmado. Contraentrega funciona aparte. Nequi directo y transferencia manual están desactivados y bloqueados en el servidor (verificado).

## Pruebas

- Arnés propio aislado (MongoDB en memoria, Wompi simulado, red externa bloqueada): **50 escenarios ejecutados: 38 PASS, 11 FAIL, 1 no aplicable**; **6 verificaciones externas bloqueadas** por falta de Sandbox real.
- Suite existente del repositorio: **275/275 PASS**. Sus pruebas de Wompi asocian pagos por un campo (`sku`) que no existe en los eventos reales, así que no cubren el riesgo principal.

## Hallazgos críticos (P1)

| ID | Qué pasa | Consecuencia |
|---|---|---|
| WP-01 | Un pago auténtico que no se puede asociar a un pedido se responde con 200 y se descarta sin guardar ni avisar. La asociación depende de `payment_link_id`, no garantizado por Wompi | Riesgo de que **todos** los pagos queden cobrados y sin registrar si el campo no llega |
| WP-02 | Si el webhook no llega, no hay recuperación: la conciliación exige un id que solo trae el webhook y la página de confirmación borra el id que envía Wompi | Clientes cobrados con pedidos pendientes indefinidamente |
| WP-03 | Las incidencias no se pueden cerrar desde la aplicación | Pedidos pagados (pago duplicado, cupón excedido) que no pueden despacharse sin editar la base de datos |
| WP-04 | Una anulación (`VOIDED`) de un cobro aprobado se ignora | Pedido sin dinero que sigue apareciendo pagado y puede despacharse |

No se encontró ningún P0: no se aceptaron pagos falsos ni montos manipulados.

## Riesgo financiero

- **Alto**: cobros sin pedido procesable (WP-01, WP-02); despacho tras anulación (WP-04).
- **Medio**: cobros sobre pedidos cancelados porque los enlaces no vencen ni se cierran (WP-07); dos clientes pueden pagar la última unidad (WP-08); estado “pagado” con monto inconsistente (WP-05).
- No hay reembolsos en la aplicación: toda devolución es manual en Wompi.

## Riesgo operacional

La bandeja “Requieren revisión” acumula pedidos sin salida (WP-03, WP-09). Las alertas son de consulta en el panel y el correo depende de banderas apagadas por defecto (WP-10). Producción todavía ejecuta la versión anterior con el riesgo V-01 de Nequi abierto.

## Conclusión de salida a producción

**No apto para recibir dinero real con Wompi.** Contraentrega, por sí sola, funciona correctamente en las pruebas. Antes de abrir Wompi: corregir WP-01 a WP-04, validar en Sandbox real que las transacciones de un enlace traen `payment_link_id` (E01) y contener V-01 en producción. Orden recomendado en `08_VEREDICTO_FINAL.md` §3.
