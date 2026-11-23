# Plan y dependencias — 23/11/2026

Repositorio real: `dizor/`. Rama `main`, HEAD `9289c7b1451d3b800ca8412d788a9a13c45cc514`, idéntico al auditado. Sin cambios de código previos; carpeta de auditoría Wompi no seguida. No hay AGENTS.md encontrado en el espacio. Los cierres F7 describen commits anteriores y sus cifras no son resultados nuevos.

## Línea base

Arnés original reproducido SIN modificar aserciones: 38 PASS, 11 FAIL, 1 NOT_APPLICABLE. Datos sintéticos, réplica Mongo local, Wompi simulado. Primer intento restringido falló con EACCES al conectar a loopback; ejecución autorizada fuera de esa restricción. Suite histórica en ejecución antes de tocar código. Las escrituras históricas se desvían con `preservar.cjs`; manifiesto SHA256 anterior en evidencias.

## Causa → modificación mínima → regresión prevista (antes de editar aplicación)

| Hallazgo | Causa comprobada | Cambio previsto | Pruebas |
|---|---|---|---|
| WP-01 | retorno 200 antes del inbox si no hay pedido | permitir order nulo en PaymentEvent, datos mínimos de vínculo, estado de procesamiento, alerta outbox administrativa sin pedido; reproceso por consulta autenticada | X01, P09–11, P14, almacenamiento fallido, reinicio y concurrencia |
| WP-02 | controlador exige transactionId previamente guardado | aceptar ID administrativo como pista y consultar con llave privada; exigir vínculo exacto, no aprobar por navegador | P13/P39, ID ajeno, webhook concurrente |
| WP-04 | rama no aprobada ignora todo sobre pagado | VOIDED de misma tx cambia estado económico a rechazado y crea incidencia; precedencia durable impide APPROVED viejo, sin reponer stock | P04b/P12/P36, enviado/entregado y concurrencia |
| WP-05 | escritura pagado fuera de validaciones | mover confirmación tras identidad/vínculo/importe/moneda/estado; inbox retiene cobro ante fallo; pago válido sin stock sigue reconocido | P21b/P14/P35 |
| WP-06 | findOne con OR de identificadores diferentes | asociación sólo por payment_link_id, detectar coincidencia contradictoria de referencia y duplicidad del vínculo, sin fallback sku | P23/P24/X04 |
| WP-03 | resolvedAt sin acción administrativa | políticas por código, motivo, evidencia estructurada y auditoría atómica con resolución; vendedor excluido | P20/P22b/P28/X06, permisos, duplicados, rollback AuditLog |
| WP-09 | UI ofrece cancelación que no puede verificarse | no ofrecer autocancelación Wompi: ni rechazo ni vencimiento prueban ausencia de otra transacción pendiente; COD conserva función | P28/X02 y COD |
| WP-10 | alertas de consulta incompletas | ampliar outbox existente e incluir eventos pendientes y pedidos antiguos en alertas; entrega sigue apagada | inbox/outbox, fallos, permisos |
| WP-11 | pendiente usa título de compra exitosa | copia neutra y consulta de estado acotada | copia y permisos lookup |
| WP-13/14 | prefijos sin control; limitador global acumula webhook | validar configuración al arrancar; excluir sólo ruta POST exacta del global manteniendo limitador específico | configuración y límites |

WP-07: `expires_at` documentado; vigencia comercial no definida, sin suponer que expirar cancela PENDING. WP-08 y WP-15 requieren decisión comercial: no se cambia reserva/consumo. WP-12: timeout puede haber creado Link; no repetir POST financiero sin garantía. Se documentan bloqueos concretos y salida operativa controlada.

## Dependencias externas

## Ampliación financiera comprobable antes del ajuste

R20 reproduce que el checksum oficial por id/status/amount no cubre payment_link_id ni currency. Cambiar un vínculo fuera de esas propiedades puede conservar la firma. Es la misma superficie WP-06, no una nueva modalidad. Cambio mínimo previsto: antes de aplicar un evento candidato, consultar el ID con llave privada y comparar los campos de asociación/moneda/importe; conservar y alertar contradicción o indisponibilidad sin confirmar dinero. Las pruebas deben suministrar también la respuesta autenticada del proveedor simulado; no se añaden campos a la firma oficial. R13 comprueba además que reconciliar un cobro adicional ya documentado como devuelto no reabre su incidencia.

E01/E03: docs no garantizan payment_link_id poblado ni id de retorno de Links. No migrar modalidad ni activar recuperación de navegador hasta Sandbox autorizado. E02/E04/E05/E06 permanecen no ejecutados. V-01 no contenido por trabajo local. No .env, Atlas, dinero real, correo, commits, push, despliegues ni migraciones.

## Bordes de revisión final (reproducidos R26/R27 antes de modificar)

Un PENDING no debe borrar una retención histórica sin incidencia: limitar el recálculo de requiresReview a aprobación/anulación y conservar la bandera previa para estados informativos. Una anulación auténtica con ID del pago aplicado debe bloquear aunque falte el vínculo no firmado: identificar exclusivamente por el transactionId ya aplicado y único para VOIDED. Esta excepción sólo registra una reversión/bloqueo; nunca admite una aprobación por ID sin vínculo autenticado. Se conserva el paymentLinkId original del evento y no se repone inventario.
