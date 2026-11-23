# Decisiones técnicas

## Modalidad y confianza

Se conserva Payment Links. No se implementan Widget, Web Checkout, firma de integridad ni nuevos parámetros de retorno. E01/E03 no están acreditados por una simulación. Las fuentes oficiales, límites y análisis comparativo están en 06.

El checksum se sigue calculando con propiedades dinámicas, timestamp y secreto de eventos; se verifica sobre JSON original antes del sanitizador. No se añaden propiedades artificiales obligatorias a la firma. Como el ejemplo oficial sólo firma id/status/amount, la asociación positiva contrasta Link/moneda/importe con consulta autenticada del mismo ID. Esa consulta usa el endpoint/llave del servidor; no acepta el navegador como prueba. Falta de proveedor: inbox/alerta + 503. Contradicción durable: revisión sin pago.

Asociación positiva: exactamente un pedido Wompi por payment_link_id. No sku, email, importe, cercanía temporal ni selección por orden natural. Una referencia que coincida con otro pedido es contradicción, no fallback. La transacción ya asociada no se reasigna a otro pedido. Reproceso consulta al proveedor de nuevo; no permite escoger manualmente un pedido.

Excepción negativa: VOIDED firmado del ID ya aplicado y único basta para bloquear ese cobro. Nunca se usa para aceptar APPROVED por ID solamente. El vínculo original recibido se conserva, aunque se utilice el vínculo ya persistido del pago aplicado para registrar la anulación. Si hay varios propietarios del ID se requiere revisión: no se escoge arbitrariamente.

## Dinero, inventario e idempotencia

Se conserva el inbox con clave env/id/status/importe/moneda y la separación financiera/operativa. Primer paso: receipt durable con mayoría. Segundo: identidad/asociación y validación bajo transacción; reconoce sólo pago íntegro coherente. Tercero: aplicación de inventario/cupón, avisos y processedAt bajo transacción. Son los mismos servicios/transacciones actuales; el cambio elimina la escritura pagado anterior a validar.

El dinero no depende de que haya inventario: pago correcto sin stock sigue registrado, con approved_without_stock y exclusión de venta/despacho. Monto erróneo no se llama pagado; el hecho auténtico vive en PaymentEvent y la incidencia. Un fallo de aplicación no borra dinero validado. Reintentos conservan una venta/movimiento/aviso; cierres de incidente requieren guardar auditoría en la misma transacción.

VOIDED prevalece sobre APPROVED antiguo, tanto por receipt durable como por estado consultado. No se repone stock ni se cambia automáticamente enviado/entregado. El pedido pierde condición económica pagado y queda en revisión. Un cobro adicional anulado puede resolverse consultando su VOIDED y conservando el pago principal, sin devolución de dinero automática.

## Resolución y roles

No hay “marcar pagado”, “desbloquear” ni “resolver todo”. Cada incidencia expone decisiones según código y rol. Motivo de 10–1000 caracteres. Admin/superadmin: cupón cobrado, vigilancia de pedido cerrado, archivo de checkout fallido cerrado, anulación consultada bajo condiciones. Sólo superadmin: atestación de devolución manual ya efectuada con comprobante HTTPS, ID/cantidad/moneda contrastados contra cobro guardado, referencia y fecha no futura. Vendedor no concilia, resuelve ni modifica dinero.

La resolución conserva incidencia original, actor/decisión/evidencia, statusHistory y AuditLog. Una repetición concurrente no crea dos resoluciones. Fallar AuditLog revierte toda resolución. Cerrar una incidencia no sustituye stockDeducted, pago válido, checkout listo ni demás incidencias. Un pago adicional ya documentado como devuelto no vuelve a bloquear por consultar el mismo APPROVED. No se afirma que un texto o URL prueben por sí solos una devolución bancaria: es un proceso externo bajo responsabilidad del superadministrador.

## Cancelación y vencimiento

La documentación de una transacción rechazada, un Link expirado o una consulta PENDING no prueba ausencia de otros intentos. Se oculta autocancelación Wompi, se conserva revisión del intento directo y se requiere personal. COD no cambia. Administrar cancelación conserva advertencias y un pago tardío siempre vuelve a quedar en revisión. Archivar vigilancia sólo registra su atención operativa; no certifica que no llegará dinero.

No se fija una duración comercial por inferencia. expires_at UTC es soportado, pero configurar un TTL requiere escoger la ventana y validar PENDING/reintentos. No hay supuesto endpoint de desactivación.

## Opciones comerciales pendientes

| Decisión | Alternativas y efectos |
|---|---|
| Última unidad (WP-08) | Reserva temporal: evita cobros excedentes pero requiere caducidad, liberación transaccional, pagos en proceso y compatibilidad COD/cupón. Cobro sin reserva: inventario sigue consistente pero exige gestión de excepción/devolución. Restricción de piezas únicas: limitar temporalmente venta en línea o vender bajo confirmación comercial, cambiando experiencia y disponibilidad. No se elige ninguna automáticamente |
| Cupón limitado (WP-15) | Reserva de uso al crear necesita liberación ante fallo/cancelación y tratamiento del resultado incierto. Consumo al aprobar conserva política actual, con posible descuento excedente que admin puede asumir. Liberar tras cancelar permitiría reutilización y necesita decisión explícita. No se altera usedCount ni maxUses para ocultar el caso concurrente |
| Checkout fallido (WP-12) | Reintentar creación sólo si el proveedor garantiza idempotencia/ausencia del Link. Si la respuesta se perdió, consultar fuente legítima/soporte Wompi y cerrar operativamente con vigilancia. Nunca POST repetido automático ni nueva clave recomendada como solución al pago incierto |
| Vigencia (WP-07) | Ventana acotada elegida por negocio + expires_at frente a ventana actual sin TTL. Al expirar no se cancela un intento en proceso. E05 debe resolver cierre soportado y límites |

No se añade un programador financiero: no hay contrato para enumerar transacciones por Link. La pantalla de alertas ya se actualiza cada minuto y detecta pendientes mayores de 24 h por lectura. El worker existente recupera comunicaciones cuando se autoriza su activación. Automatizar aprobación por antigüedad sería incorrecto; entrega externa/monitorización del hosting siguen pendientes.

## Pruebas históricas y contrato del fixture

Los archivos originales, sus aserciones y resultados históricos permanecen byte a byte. `contrato-fixtures.cjs` adapta sólo en memoria: elimina sku transaccional, da Link único a pedidos sintéticos que nunca lo creaban, añade ese Link a la respuesta de consulta y publica el estado del proveedor simulado antes de firmar. Expone el Map simulado al recorrido UI nuevo. `auditoria-contrato.cjs` sólo hace consultables los eventos simulados, incluso el duplicado enviado sin pasar por postEvent. No toca condiciones/assert.

La defensa de consulta no se debe eliminar para satisfacer un mock sin GET. Tampoco se cambia la aserción histórica que exige pagado ante monto incorrecto ni la que permite cancelar PENDING. Sus FAIL se conservan y se explican en 04. La suite no se presenta como 275/275 después de cambiar esos comportamientos.
