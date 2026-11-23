# Checklist de despliegue pendiente

2026-11-21 · Documento de tareas futuras. **No ejecutado ni autorizado por Fase 7.** Las pruebas temporales locales no sustituyen estas comprobaciones. Cada tarea requiere responsable, entorno autorizado, evidencia y criterio de reversión. Ninguna casilla se marca completada por los resultados de QA local.

## Aprobación y respaldo

- [ ] Obtener auditoría independiente final y resolver sus hallazgos bloqueantes.
- [ ] Autorizar explícitamente la ventana y el alcance del despliegue.
- [ ] Identificar versión aprobada, responsables y canales de incidencia.
- [ ] Preparar backup verificable y comprobar restauración en entorno autorizado.
- [ ] Documentar plan de rollback de aplicación y compatibilidad de datos; no revertir pagos con cambios manuales de estado.

## MongoDB e históricos

- [ ] Confirmar replica set o mongos y compatibilidad transaccional de la infraestructura destino.
- [ ] Inventariar índices reales y duplicados antes de cualquier cambio.
- [ ] Planificar migración del índice histórico de idempotencia; revisar null, duplicados y alcance del filtro parcial sin perder pedidos.
- [ ] Revisar duplicidad de índice `SpecialRequest.requestNumber` y cualquier duplicado histórico de `Order.orderNumber` con un plan específico.
- [ ] Revisar alcance de la protección de SKU y necesidad de un índice global; identificar duplicados históricos antes de decidir su creación.
- [ ] Verificar colecciones e índices requeridos para outbox, eventos de pago, ajustes y guardas transaccionales.
- [ ] Revisar stock ausente, fraccionario o inválido; acordar saneamiento con trazabilidad, sin normalización silenciosa.
- [ ] Conciliar pedidos antiguos sin evidencia suficiente de pago, entrega o recaudo; separar datos desconocidos de hechos confirmados.
- [ ] Ensayar cualquier migración autorizada y su reversión sobre copia restaurada; no ejecutar desde el proceso de QA.

## Wompi

- [ ] Obtener credenciales autorizadas del entorno correcto y verificar almacenamiento seguro, sin incluirlas en reportes.
- [ ] Verificar creación y consulta de enlaces, monto, moneda, referencia y vigencia informada por el proveedor.
- [ ] Verificar endpoint público de webhooks, HTTPS, firma, checksum y correspondencia de la transacción.
- [ ] Probar duplicados, solicitudes simultáneas, rechazo, aprobación tardía, pago adicional y recuperación de consulta en entorno autorizado.
- [ ] Confirmar política de vencimiento con evidencia del proveedor; no agregar cancelaciones por antigüedad no acordadas.
- [ ] Probar reintento sólo con enlace vigente verificado y confirmar exclusión de cobros en disputa de ingresos conciliados.
- [ ] Acordar tratamiento manual autorizado de dinero en disputa, reembolsos y conciliaciones históricas. No asumir devoluciones automáticas.

## Resend y comunicaciones

- [ ] Verificar dominio, remitente, destinatario administrativo y configuración autorizados.
- [ ] Confirmar que las banderas de entrega se mantienen apagadas hasta la activación controlada aprobada.
- [ ] Revisar plantillas, datos de contacto, escape HTML, texto plano y copias operativas.
- [ ] Activar de forma controlada worker y entrega cuando se autorice; revisar recuperación de leases y límite de intentos.
- [ ] Verificar aceptación con identificador, clave de idempotencia, duplicados y resultado ambiguo en entorno autorizado.
- [ ] Comprobar recepción real en buzones de prueba, spam, rebotes y observabilidad; aceptación no equivale a entrega.
- [ ] Validar destinatarios y permisos de reintento/reenvío con evidencia; no enviar mensajes masivos ni históricos automáticamente.

## Aplicación, observabilidad y reversión

- [ ] Revisar variables del entorno destino, orígenes, cookies, autenticación, rutas y secretos con responsables autorizados.
- [ ] Ejecutar build de la versión aprobada en el entorno de entrega, revisar artefactos y dependencias.
- [ ] Evaluar planes de consulta y volumen esperado; proponer índices con explain y medir antes/después fuera de producción inicialmente.
- [ ] Acordar políticas comerciales pendientes: consumo de cupón tras cancelación, recuperación de checkout fallido y tratamiento de incidencias sin resolución automática.
- [ ] Revisar deuda lint previa, nombres accesibles repetidos y observaciones visuales menores; realizar pruebas humanas con lector de pantalla y navegadores objetivo.
- [ ] Preparar smoke autorizado de login por rol, compra controlada, pedido, inventario, comunicaciones y finanzas; especificar datos y limpieza trazable.
- [ ] Preparar alertas sobre pagos en revisión, checkout incompleto, outbox fallido, stock inválido, errores HTTP y tiempos de consulta.
- [ ] Documentar quién detiene el despliegue, cómo suspender entregas de correo y cuándo aplicar rollback.
- [ ] Obtener aprobación final para ejecutar esta checklist. Su existencia no constituye autorización.
