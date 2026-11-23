# Bloqueos y riesgos pendientes

## Qué avanzó

- RC-01 tiene conclusión motivada, auditada e idempotente; solo los casos concluidos dejan de contar y conservan archivo consultable. Riesgos abiertos siguen contados. **VALIDADO SOLO EN LOCAL**, pendiente auditoría independiente de este cambio adicional.
- Sandbox real aprobó una tarjeta test; GET privado trae payment_link_id correcto; retorno añade id/env; el API acepta expires_at de 24h. **VALIDADO EN SANDBOX, con los límites de 01/02.**

## Por qué sigue NO-GO

| Bloqueo | Lo que falta | Quién / acción concreta |
|---|---|---|
| E01 completo / E02 | Webhook real firmado y asociación/procesamiento único de un pedido actual | Operador habilita receptor HTTPS aislado y configura URL en dashboard Sandbox; repetir flujo completo con evidencia mínima |
| V-01 productivo | Demostrar contención real de Nequi antiguo | Administrador hosting, ventana autorizada separada, aplicar/verificar plan 04; no basta código local |
| E04 | Rechazo/reintento, PENDING, PSE/Nequi Wompi y reutilización observados | Entorno Sandbox completo, medios oficiales, sin ejecutar pagos extra sin alcance/consentimientos apropiados |
| E05 / X07 | Efecto del vencimiento y pagos en curso/tardíos; links viejos/cancelación | Ensayo de contrato; 24h no habilitado en aplicación por falta de compatibilidad completa |
| E06 | TLS/CORS/proxy/secretos, índices reales, backup restaurado, avisos/responsables | Operador de infraestructura en entornos identificados y autorizados |
| Última unidad / cupón estricto | Reserva y recuperación segura frente a cobro tardío | Diseño y ejecución en intervención separada; no hay garantía nueva de reserva |
| Checkout incierto | Diagnóstico del 502 y recuperación soportada del link desconocido | Investigar intento sin producir otro pedido/charge automático; ensayar recuperación con proveedor |
| Checkout exacto a publicar | Revisar cambios sin commit y origen del antiguo 404 | Seleccionar y auditar release completo; no desplegar el HEAD mezclado por presunción |

El bloqueo ya **no** equivale a “no sabemos nada de GET”: se comprobó ese vínculo en una transacción real. Falta completar las demás evidencias y la operación productiva segura.

## Riesgos no cerrados por esta fase

NV-05 (consulta HTTP dentro de transacción en resolución previa), NV-06 (mensaje tras anulación de pedido enviado), NV-07 (unicidad de referencia de devolución dentro de pedido) siguen fuera de alcance. No se cambian. El nuevo concluir consulta antes de abrir su transacción.

Un seguimiento concluido es una decisión histórica con evidencia de ese momento; no promete que nunca llegará una anulación posterior. Un VOIDED posterior continúa generando incidencia/revisión y alerta del pedido, y bloquea preparar (Q08/Q10). Reapertura y rearchivo conservan decisiones en AuditLog. No hay cierre automático de un riesgo económico nuevo.

El nuevo cierre se limita al pago APPROVED primario aplicado, importe/moneda/vínculo coherentes, pedido preparable y sin incidencias. Otros casos permanecen abiertos. No se usa “no contar” para ocultar cobros sin resolver.

No se guardan cuerpos de webhook con PII ni llaves en evidencias. No se accedió a Atlas ni se modificaron datos reales, hosting o panel productivo. Los Links de ensayo solo existen en Sandbox; el nuevo E05 vence a las 16:44 Bogotá del 24/11/2026, pero ese vencimiento todavía debe observarse para acreditar su comportamiento efectivo.
