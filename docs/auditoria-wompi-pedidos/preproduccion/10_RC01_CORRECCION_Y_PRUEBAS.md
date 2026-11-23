# RC-01 · conclusión auditada y contador coherente

Defecto reproducido antes: F32 original 27/28, suma de alertas de pago 16→17 al archivar una contradicción pagada; ninguna operación de conclusión. Nueve pruebas nuevas dieron 0/9 porque la ruta no existía.

## Corrección

| Fuente | Cambio |
|---|---|
| backend/src/services/paymentEventArchive.js:77 | conclude: admin/superadmin, motivo, consulta privada fresca antes de transacción, validación completa y cierre idempotente |
| mismo servicio:115 | Incrementa __v del pedido en la transacción como bloqueo frente a escritores concurrentes; hechos financieros intactos |
| mismo servicio:9 | Vista closed-follow-up: archivo activo, seguimiento=false, fecha de conclusión presente |
| backend/src/models/paymentEvent.js:24 | Cuatro campos opcionales: concludedAt, concludedBy, conclusionReason, conclusionCheckedAt |
| backend/src/controllers/orderAdminController.js:257 | Controlador nuevo; vista cerrada en lista protegida |
| backend/src/routes/adminOrderRoutes.js:21 | Ruta protegida por admin/superadmin |
| frontend/src/components/admin/PaymentEventAlerts.jsx | Motivo para concluir, aviso de condición, lista de concluidos consultable y reapertura |
| frontend/src/services/orderAdminService.js:12 | Acceso a la operación |

El grupo financiero existente ya cuenta solo financialFollowUp=true; al concluir baja una unidad sin retirar riesgos abiertos. No se cambió adminAlertController ni se dejó de contar indiscriminadamente la lista entera. La operación no marca processedAt, no elimina el evento y no se hace pasar por reembolso.

Se limita al APPROVED primario legítimo aplicado, coherente con el proveedor y con el pedido, preparable y sin incidencias. Rechazados, reembolsados, estado dudoso, stock sin aplicar o pago secundario continúan abiertos para gestión. El checkout y la política de inventario/cupones no cambian.

## Pruebas nuevas

| Caso | Resultado |
|---|---|
| Q01 | Concluye, baja total y grupo en 1; archivo visible; evento original y hechos del pedido intactos; AuditLog con actor/motivo |
| Q02 | Cliente/vendedor 403; motivo ausente/inyección/espacios/exceso/cuerpo ausente 400 |
| Q03 | Incidencia abierta o requiresReview obsoleto: 409, no se borra para poder cerrar |
| Q04 | GET VOIDED, importe distinto o proveedor caído: 409/503; no cierre |
| Q05 | Tres conclusiones concurrentes + repetición: una decisión y fecha; otro motivo 409 |
| Q06 | Fallo real insert AuditLog: rollback de conclusión y __v; reintento converge |
| Q07 | Reapertura devuelve a bandeja; rearchivo inicia seguimiento abierto y conserva auditoría anterior |
| Q08 | VOIDED posterior conserva incidencia visible, revisión y preparación 409 |
| Q09 | Pago primario distinto, prueba de otro ambiente o no archivado: 409 |
| Q10 | GET devuelve APPROVED pero antes de concluir llega VOIDED: se detecta el cambio, 409 y seguimiento abierto |
| Q11 | Superadmin 200; sin sesión 401; listado cerrado como vendedor 403 |

Núcleo: antes **0/9**, después **9/9**. Ampliación posterior: **11/11**. Todas contra Express real y replica set efímero, proveedor simulado explícitamente; no usan Wompi real ni .env. F31 y F25 intactas PASS. F32 original no invoca concluir: conserva FAIL; variante F con la decisión nueva y mismas aserciones, 28/28. No se modifican aserciones previas para maquillar el resultado.

## Límites

El historial consultable muestra hasta 100 registros por consulta, igual que la bandeja existente. Concluir es evidencia de la revisión en ese momento; no significa que una anulación futura sea imposible. Q08/Q10 verifican que los mecanismos financieros existentes siguen bloqueando y alertando. Auditoría final independiente y uso humano del botón nuevo en navegador quedan pendientes.

Evidencia: antes-RC.txt, final-ampliada-RC.txt, final-F.txt, final-FA.txt, rc01.diff, código final SHA y frontend-result.json, bajo evidencias/.
