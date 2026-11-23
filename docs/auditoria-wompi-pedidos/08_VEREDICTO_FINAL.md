# 08 · Veredicto final

2026-11-23 · Auditoría independiente Wompi–pedidos DIZOR.

## 1. Veredicto

# NO-GO

Existen cuatro bloqueos P1 demostrados con pruebas ejecutadas (WP-01, WP-02, WP-03, WP-04) incompatibles con recibir dinero real por Wompi, y una verificación esencial (E01: que Wompi incluya `payment_link_id` en las transacciones de un enlace) que no pudo ejecutarse. Aunque esa verificación saliera bien, los P1 seguirían impidiendo la salida.

No es INDETERMINADO: los bloqueos no dependen de la evidencia faltante.

## 2. Fundamento

| Criterio | Estado |
|---|---|
| Pagos falsos aceptados | No (P09, P10, P26) |
| Manipulación de importe | Bloqueada (P21, P22) |
| Webhooks protegidos | Sí, firma oficial verificada (P09–P11) |
| Confirmaciones perdidas | **Sí: descarte silencioso (X01) y sin recuperación (P13)** |
| Pedidos pagados que no pueden procesarse | **Sí (P20, P22b)** |
| Despacho de pedido sin dinero | **Posible tras anulación (P04b)** |
| Duplicados e idempotencia | Correctos (P11, P15, P16, X05) |
| Inventario | Consistente; cobro excedente posible por política sin reserva (P34) |
| Contraentrega | Correcta (P31, P32) |
| Métodos desactivados | Bloqueados (P33) |

## 3. Qué corregir primero

1. **WP-01**: guardar y alertar todo evento firmado que no se pueda asociar; validar E01 en Sandbox. Si `payment_link_id` no llega, cambiar de modalidad (Web Checkout con referencia propia y firma de integridad) antes de seguir.
2. **WP-02**: recuperar pagos sin webhook: conservar el `id` de la redirección y consultarlo solo con llave privada, verificando que la transacción pertenece al enlace del pedido; conciliación administrativa por id verificado.
3. **WP-04**: tratar `VOIDED` sobre un pago aplicado como incidencia bloqueante y fuera de finanzas.
4. **WP-03**: resolución auditada de incidencias (motivo, evidencia, rol admin).
5. Después: WP-05, WP-06, WP-07, WP-09, WP-10; luego los P3.

## 4. Bloqueos documentados previamente que siguen afectando a pagos y pedidos

No se dan por cerrados por existir correcciones locales.

| Bloqueo | Fuente | Estado según esta auditoría |
|---|---|---|
| **V-01**: producción ejecuta la versión antigua con `NEQUI_ENV || "mock"`; su webhook Nequi no verifica firmas y podría marcar pedidos como pagados sin cobro | `docs/auditoria-privacidad/06-plan-despliegue-reversion.md` §1 y §7.1 (“Documentado, NO ejecutado”) | **Abierto en producción.** En el código local Nequi responde 410 (P33), pero eso no protege lo desplegado. La contención por variables debe hacerse antes de cualquier otra cosa |
| Conciliación de pedidos históricos de Nequi | mismo documento §7.2 | No ejecutada |
| Validaciones externas de Wompi (credenciales, webhook público, firma real, duplicados, vencimiento) | `docs/auditoria-admin/CHECKLIST_DESPLIEGUE_PENDIENTE.md` §Wompi; `INFORME_FINAL_QA_FASE7_2026-11-21.md` §26 | Todas pendientes; coinciden con E01–E06 |
| Infraestructura (replica set, índices reales, backup) | misma checklist | Pendiente; las transacciones Mongo son obligatorias para pagos |
| Políticas comerciales: cupón tras cancelación, checkout fallido, incidencias sin resolución automática | misma checklist §Aplicación | Pendientes; la tercera es la raíz de WP-03 |
| Hallazgos ADM-03, ADM-09, ADM-15, ADM-21 del panel admin | `docs/auditoria-admin/INFORME_FINAL_QA_FASE7_2026-11-21.md` | Corregidos en local (P26, P11, P37 lo confirman); ADM-21 (vencimiento) sigue abierto, ver WP-07 |
| Despliegue | checklist | No autorizado ni ejecutado: todo lo verificado aquí es código local |

## 5. Pruebas que faltan

- E01–E06 en Sandbox real y en la configuración productiva (05 §3).
- E2E con medios reales de Sandbox: tarjeta aprobada/rechazada, Nequi, PSE, reintento de pago.
- Entrega real de alertas por correo (Resend + buzón).
- Repetir el arnés de esta auditoría tras las correcciones, convirtiendo cada FAIL en aserción de regresión.

## 6. Cifras

| Concepto | Cantidad |
|---|---|
| Escenarios ejecutados (arnés propio) | 50 |
| Aprobados | 38 |
| Fallidos | 11 |
| No aplicables | 1 |
| Bloqueados (no ejecutables) | 6 |
| Suite existente | 275 aprobadas / 0 fallidas |
| Hallazgos | P0: 0 · P1: 4 · P2: 6 · P3: 5 |
