# Causas y decisiones — antes de modificar aplicación

23/11/2026. Rama main, HEAD 9289c7b1451d3b800ca8412d788a9a13c45cc514. Los 25 archivos de la primera remediación coinciden con su manifiesto SHA256; no hay implementación posterior que invalide los hallazgos. Árbol previo conservado en evidencias/git-status-antes.txt; fuentes anteriores de los tres archivos modificables en antes/.

C07, C08, C08c y C12 se reproducen contra la fuente actual, sin cambiar sus aserciones ni usar el fixture favorable que sincroniza automáticamente webhook y GET. Los originales, auditoría Claude y primera remediación se incluyen en baseline-sha256.json. Cada escritura histórica de pruebas se desvía a esta carpeta nueva.

## NV-01

Defecto: cualquier diferencia entre estado firmado y consulta sustituye el evento y completa processedAt. Causa: asumir que la consulta representa un estado posterior por haber sido ejecutada después. Cambio mínimo: una función explícita de progresión (mismo estado; PENDING→APPROVED/DECLINED/ERROR; APPROVED→VOIDED). El VOIDED auténtico ya aplicado conserva su precedencia actual. Fuera de esas transiciones: observación, failed, razón y aviso idempotente en transacción; lanzar 503 sólo DESPUÉS del commit. Si falla la transacción, no confirmar recepción. No tocar comprobación de vínculo/moneda/importe.

Regresiones: C07; APPROVED frente a PENDING/DECLINED; duplicados y recuperación con GET actualizado; error de almacenamiento/rollback; R22 y C22–C26. No ocultar un cobro auténtico ni rehabilitar VOIDED.

## NV-02

Defecto: cualquier error del GET crea reconciliation_query_failed y sólo se cierra con el mismo ID. Causa: se pierde el status HTTP y se confunde tecleo/404 con indisponibilidad; cierre ligado a la pista errónea. Cambio mínimo: errores controlados tipados de getTransaction, 409 para formato/404 sin incidente, mantener 503 y trazabilidad para 5xx/timeout/otros fallos. Tras proceso autenticado completado del pedido, cerrar sólo sus incidencias abiertas de consulta, con resolution, history y AuditLog atómicos e idempotentes. No cerrar incidencias financieras independientes ni confirmar por el ID escrito.

Regresiones: C12; ID inválido/404/ajeno/respuesta con otro ID; 5xx y timeout seguidos de éxito con ID distinto; concurrencia; rollback AuditLog; otros pedidos/incidencias intactos y permisos.

## NV-03

Defecto: reproceso exitoso puede generar recibo con otra clave, dejando original abierto. Causa: controlador no verifica/cierra la observación original tras aplicar la consulta. Cambio mínimo: processTransaction devuelve el recibo que realmente completó; el controlador verifica ID, entorno, pedido y processedAt dentro de transacción antes de cerrar el original. Conservar campos originales y provider_binding_mismatch; usar los metadatos existentes para motivo de sustitución. Ninguna eliminación ni nuevo esquema. Reproceso con regresión de estado también conserva discrepancia sin cerrar (misma regla NV-01). No cerrar por intento/fallo de aplicación.

Regresiones: C08/C08c; estado distinto válido; moneda alterada; error/reintento; recibo del ID incorrecto; original intacto; cierre fallido en Mongo; concurrencia y ausencia de doble inventario/aviso. El retorno del servicio sólo es evidencia de completitud si el recibo existe y está procesado; se revalida en Mongo.

## Límites expresos

Se modifican únicamente wompiPaymentService.js, wompiService.js y orderAdminController.js, más pruebas nuevas y esta documentación. No se tocan stock, precios, descuentos, cupones, COD, frontend, modalidad, firmas ni asociación. NV-04 sigue BLOCKED E01; NV-05–NV-07 fuera del alcance. No aceptar políticas comerciales por inferencia: P23-v2 documentará el comportamiento vigente y la aceptación escrita del dueño sigue pendiente.
