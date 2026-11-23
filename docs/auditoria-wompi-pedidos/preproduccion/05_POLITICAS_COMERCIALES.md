# Políticas de lanzamiento · diseño y pruebas, sin implementación improvisada

Los objetivos del encargo se consideran definidos: propuesta inicial 24h, restricción de autocancelación, evitar sobreventa de última unidad, recuperar checkout incierto y respetar máximo de cupones. **Definir el objetivo no acredita su implementación ni el contrato externo necesario.**

## Vigencia y cancelación

La API Sandbox acepta el ISO UTC con 24 horas, pero falta PENDING cruzando vencimiento y tratamiento de enlaces viejos. No se agregó expires_at a la integración actual. Vencer un link no implica anular/reembolsar una transacción. La autocancelación sigue restringida mientras pueda aprobarse un intento; la gestión administrativa conserva vigilancia y separa pedido de dinero. X07 sigue FAIL; P23 original sigue FAIL y su v2 pasa. La política de rechazo de importe/moneda inválidos sigue intacta: P06 original FAIL, v2 PASS.

## Última unidad · intervención separada requerida

Diseño propuesto: reserva durable atómica de todas las líneas en la misma transacción que registra el intento/pedido; disponibilidad = stock menos reservas activas. Clave única por intento idempotente. Reservar todo o nada; no reservar con lecturas y escrituras independientes.

Un APPROVED autenticado convierte una reserva en movimiento de venta una sola vez; duplicados no consumen dos veces. Contraentrega conserva su descuento transaccional y debe competir por la misma disponibilidad. Un cobro tardío nunca se borra ni se reclasifica como inexistente: se conserva dinero, se bloquea y se gestiona con evidencia si no puede atenderse.

**Bloqueo decisivo:** un TTL local vencido no demuestra que Wompi ya no pueda aprobar un PENDING o un intento en curso. Liberar automáticamente y vender otra vez puede cobrar dos veces la misma pieza. Antes de implementar: verificar cierre real del link, estados terminales y horizonte de finalización; diseñar recuperación tras caída, leases y auditoría sin depender de un temporizador en memoria. Cambia esquema/concurrencia/ciclo financiero: no se mezcla con Sandbox.

Alternativa segura si no puede garantizarse: no habilitar pago Wompi simultáneo para piezas únicas; canal administrativo con disponibilidad retenida y un intento controlado, o contraentrega según la decisión comercial. **No se habilitó ni cambió ese comportamiento en código**: es una alternativa para aprobar en la intervención de inventario.

## Checkout incierto

Registrar intención e idempotencia antes del POST externo; estados durables de creación en curso, confirmado o desconocido. Un timeout conserva el pedido y su referencia; no crea otro automáticamente ni reutiliza a ciegas un enlace desconocido. Recuperación por panel/consulta oficialmente soportada y evidencia inequívoca, nunca coincidencia de correo/importe/hora.

El proveedor no se presume idempotente por recibir el mismo sku. El intento real de esta fase devolvió 502 y no se repitió con otro pedido; se documenta su resultado desconocido. Falta probar pérdida de respuesta del proveedor en Sandbox y un mecanismo soportado de búsqueda/recuperación del enlace. No se inventó ese endpoint ni se añadió un retry de creación.

## Cupones limitados · intervención separada requerida

Proponer reserva transaccional de cuota: usados + reservados ≤ máximo; adquirir antes de crear un link cuyo importe incluya el descuento. La misma idempotencia conserva la reserva. Conversión a consumo única tras pago y liberación solo con certeza financiera, no por asumir cancelación desde TTL. Si no hay cuota, informar antes de pagar y solicitar nueva cotización; no conceder descuentos extra silenciosos ni cambiar importes de links existentes.

Requiere análisis de cupones actuales, cancelaciones, devoluciones, links viejos y backfill compatible; no se modifica en esta fase. El contador transaccional actual evita exceder usedCount, pero no demuestra que nunca existan dos links con descuento cotizado para una sola cuota.

## Matriz para las intervenciones futuras

| Área | Pruebas exigidas | Estado |
|---|---|---|
| Reserva inventario | Dos compradores/última unidad; líneas múltiples con rollback; Wompi contra COD; duplicados | DISEÑADO, NO EJECUTADO |
| Recuperación | Caída antes/después de reserva y respuesta de link; reinicio/worker repetido; leases expirados | DISEÑADO, NO EJECUTADO |
| Fin de reserva | Abandono, PENDING largo, vencimiento UTC, aprobación tardía y webhook perdido | BLOCKED por contrato externo parcial |
| Cancelación | Solicitud cliente con link activo/desconocido, admin, aprobación posterior, sin reembolso implícito | Restricción actual probada localmente; Sandbox pendiente |
| Checkout | Mismo intento tras timeout, respuesta perdida, refresco/doble clic, recuperación con evidencia; jamás segundo pedido automático | Local previo aprobado; fallo real de esta fase documentado sin retry; recuperación externa pendiente |
| Cupón | Última cuota entre varias compras; descuento cotizado, pago tardío, cancelación/retorno y replay | DISEÑADO, NO EJECUTADO como reserva |

Los diseños necesitan revisión y una intervención aislada con matriz completa. No se aceptan los riesgos financieros por silencio del propietario ni por el simple paso de las pruebas locales existentes.
