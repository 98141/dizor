# Riesgos residuales y límites de cierre

**NO-GO productivo. No se declara remediación local incondicionalmente completa:** dos aserciones históricas contradicen expresamente los cambios requeridos, y los contratos externos y decisiones comerciales siguientes permanecen abiertos. No hay riesgo aceptado implícitamente por terminar la implementación.

| Pendiente | Estado y responsable requerido | Criterio para continuar |
|---|---|---|
| V-01 Nequi en versión productiva antigua | BLOCKED infraestructura; operador hosting/propietario | Aplicar y demostrar contención 06. El 410 local no demuestra contención productiva |
| Asociación real de Links E01, firma E02, retorno E03 y reintento E04 | BLOCKED proveedor; responsable de integración en Sandbox autorizado | Payloads redactados de evento y GET privado, identidad/Link/importe/moneda/entorno; nunca sustituir por simulaciones |
| Cierre/desactivación E05 y TTL WP-07 | BLOCKED proveedor y decisión comercial | Contrato soportado y vigencia elegida. Expirar Link no anula PENDING; admin cancelar no detiene Link |
| Infraestructura E06 | BLOCKED operador destino | TLS/webhook público, proxy, réplica/índices existentes, backup/restauración y configuración por ambiente |
| Dos aserciones históricas P06/P23 | PENDIENTE revisión independiente de pruebas/política | No modificar para ocultar fallo. Acordar versionado de expectativas incompatibles; nuevas pruebas ya demuestran el comportamiento solicitado |
| Última unidad WP-08 | BLOCKED decisión comercial | Elegir reserva o gestión de excepción/restricción comercial. Hoy puede haber cobro sin stock, pero no stock negativo ni despacho sin conciliación |
| Cupón WP-15 | BLOCKED decisión comercial | Elegir reserva/liberación/aceptación de descuento excedente. No se cambia consumo general ni usos tras cancelar |
| Checkout de resultado incierto WP-12 | BLOCKED garantía externa/decisión operativa | No repetir creación de Link sin saber si ya existe. Soporte debe verificar el proveedor; archivo operativo no acredita ausencia de dinero |
| Reintento en sitio WP-11 | PENDIENTE | Se mantiene enlace verificado en correo existente; no se añadió botón de reintento ni se alteró vaciado del carrito |
| Entrega de alertas y monitorización | BLOCKED entorno autorizado | Destinatario/remitente/dominio/buzón, flags y worker operados por responsable; ningún correo real enviado aquí |
| Caída prolongada / tres reintentos agotados | RIESGO RESIDUAL sin aceptación explícita | Inbox durable y consulta administrativa disponibles si llega evidencia. Cruce diario con panel por responsable. No hay enumeración automática de todas las transacciones del Link garantizada |

## Riesgos del cambio a revisar

La defensa de asociación añade GET privado antes de aplicar candidatos de webhook. Puede aumentar latencia/rate limits y producir 503 cuando Wompi está indisponible. Se conserva el evento y una señal, pero Wompi sólo reintenta tres veces: hace falta atención administrativa y observabilidad del hosting. El ID firmado de una anulación ya aplicada sólo se utiliza para bloquear; no se habilita aprobación por esa excepción.

La devolución manual documentada sigue dependiendo de que el superadministrador inspeccione un comprobante real; la aplicación sólo contrasta sus campos con el cobro registrado y conserva la responsabilidad/auditoría. No comprueba por API que el dinero haya llegado al comprador. No existe devolución automática nueva.

Los índices históricos, stock inválido, pedidos antiguos y configuraciones reales no se migraron ni sanearon. La extensión de esquemas es compatible y no añade índices, pero debe probarse con copia restaurada antes de despliegue. Datos históricos sin asociación verificable siguen sin poder confirmarse a ciegas.

## Requisitos de un despliegue futuro (NO autorizado)

Auditoría independiente satisfactoria, decisiones comerciales y compatibilidad de pruebas resueltas, Sandbox real, V-01 contenido, backup restaurado y réplica compatible. Revisar índices reales del inbox/outbox/idempotencia sin crearlos desde QA. Revisar prefijos/ambiente y secretos sólo en gestor seguro. API y frontend deben coordinarse porque aparecen nuevas acciones administrativas. Activación de correo y smoke con dinero real requieren autorizaciones específicas posteriores.

Rollback: conservar inbox/outbox, resoluciones y auditoría. No borrar campos/evidencia ni volver a marcar pagado manualmente. Revertir el servicio anterior reintroduce descarte de eventos/VOIDED ignorado: suspender recepción de nuevos cobros conforme a procedimiento autorizado y conservar notificaciones para posterior recuperación. Mantener contención Nequi incluso al revertir código.
