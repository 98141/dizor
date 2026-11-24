# Regresión de integridad DIZOR — Fase 1

Ejecutar desde `backend` con Node y un binario MongoDB 7.0.x ya disponible.
La suite crea y destruye su propio replica set local; no lee `.env` ni acepta un URI de base externa. Resend, Wompi y demás credenciales se sustituyen antes de cargar la app; los datos son ficticios. Las respuestas Wompi se simulan, no se realizan solicitudes al proveedor.

Se reutiliza `mongodb-memory-server` de un entorno de herramientas ya instalado. No es una dependencia de producción ni se añadió al lockfile.

```powershell
$env:MMS_DIR = 'C:\ruta\al\entorno-de-herramientas'
# MMS_DIR contiene node_modules/mongodb-memory-server.
$env:MONGOMS_SYSTEM_BINARY = 'C:\ruta\a\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
npm run test:phase1
```

No ejecutar el servidor habitual ni scripts seed para estas pruebas. La suite no necesita `MONGO_URI`, claves reales ni conexión a producción. En una sandbox que deniegue sockets de 127.0.0.1, hace falta autorizar la ejecución del proceso de pruebas local; no sustituir el URI por una base externa.

Los 22 escenarios originales quedan identificados A1–G3 y las 35 pruebas adicionales P01–P35. A0 verifica índices durante la preparación. El conflicto de índice de SpecialRequest preexistente se informa por separado; los índices de todos los modelos de esta fase se exigen correctos. No se deben convertir aserciones en simples capturas de resultados.

## Recuperación interna de transacciones Wompi

Con las mismas variables de herramientas, desde la raíz del repositorio:

```powershell
node --test backend/test/wompi-recovery.test.js backend/test/wompi-return-limit.test.js backend/test/wompi-worker.test.js
node --test frontend/test/wompi-confirmation.test.cjs
```

La primera suite utiliza `helpers/wompiRecoveryFixture.cjs`, independiente de los documentos de auditoría archivados. Ejecuta Express y MongoDB locales; Wompi es simulado y la red externa queda bloqueada. Cubre el retorno autorizado, recuperación administrativa sin ID escrito, acceso por propietario o token, pedidos ajenos, importes, concurrencia, anulación y errores del proveedor. La segunda comprueba el limitador real por HTTP; la suite del frontend comprueba captura, reintentos, estado pendiente y el botón sin campo de transacción.

El retorno del comprador aporta únicamente un ID candidato: el backend consulta a Wompi con su llave privada y utiliza el procesador de pagos existente. El botón administrativo consulta los IDs ya registrados en el pedido o sus eventos del ambiente actual. Si no llegó ni un evento identificable ni un retorno verificable, informa que aún falta la transacción; no existe aprobación manual basada únicamente en la declaración del operador. No se consultan pagos por coincidencias de correo o importe.

Estas pruebas locales no sustituyen la prueba de entrega y firma del webhook real en Sandbox ni autorizan producción.

### Recuperación automática general

El backend arranca el recuperador cuando las credenciales Wompi están configuradas, independientemente de las notificaciones por correo. Cada 30 segundos descubre recibos sin procesar y pagos PENDING, y toma hasta cinco tareas con una concesión de 90 segundos. Los reintentos comienzan a los 30 segundos y aumentan hasta una hora. Después de 72 intentos o 72 horas, la tarea pasa a revisión; no se cancela el pedido ni se declara el pago rechazado por agotamiento de reintentos.

Los retornos autorizados se guardan antes de consultar a Wompi en `WompiRecoveryTask`. Es una cola de consultas, separada de la evidencia financiera. Su identidad determinista utiliza el índice único `_id` nativo de MongoDB; el índice de estado y fecha es únicamente de rendimiento. El recuperador puede reconstruir tareas desde `PaymentEvent` después de un reinicio. Al recuperar un pago sólo se cierran automáticamente fallos técnicos de consulta, con auditoría; las incidencias financieras, de stock y de cupones se conservan.

Un evento sin `payment_link_id` se puede recuperar si la consulta privada devuelve un vínculo inequívoco. Un importe, moneda, enlace o estado contradictorios no se corrigen ni archivan automáticamente. Un VOIDED firmado de la transacción aplicada sigue bloqueando incluso si la consulta privada no responde. Los retornos con ID de otro pedido se rechazan sin convertirlos en evidencia de pago.

Configurar en el backend del ambiente correspondiente:

```dotenv
WOMPI_ENV=sandbox
WOMPI_PRIVATE_KEY=<llave privada del ambiente; nunca en frontend>
WOMPI_EVENTS_SECRET=<secreto de eventos del mismo ambiente>
WOMPI_RECOVERY_ENABLED=true
WOMPI_WEBHOOK_URL=https://<backend-publico>/api/webhooks/wompi
```

Para producción: `WOMPI_ENV=production` y credenciales de producción. `WOMPI_CHECKOUT_ENABLED=true` requiere un `WOMPI_WEBHOOK_URL` HTTPS público con la ruta correcta y el recuperador habilitado; el arranque rechaza una configuración incompleta. Con nuevos pagos deshabilitados se permite seguir recuperando y conciliando pagos existentes. El arranque no ejecuta migraciones ni crea/repara índices de negocio. MongoDB crea el índice nativo `_id` al crear la colección de tareas; el índice no único de rendimiento se provisiona por el operador fuera del arranque de producción.

Registrar la misma URL en **Wompi → configuración → URL de eventos del ambiente correspondiente**. Escribir una URL en una variable no configura el panel ni demuestra entrega. No usar localhost, ni mezclar las llaves/receptor de Sandbox y producción. Este cambio no publica un servidor ni abre un túnel automáticamente.

`GET /api/admin/orders/payment-recovery` permite a admin/superadmin consultar configuración, tareas pendientes/en revisión y fecha del último webhook almacenado, sin exponer llaves. Su campo `deliveryVerification=requires_provider_test` evita presentar la existencia de una URL o de recibos locales como prueba de entrega real.

Antes de cerrar la integración: crear varios pedidos Sandbox reales, pagar y cerrar la pestaña sin volver a DIZOR; verificar el webhook firmado y la actualización del pedido. Repetir con caída temporal de consulta, reinicio del backend, webhook duplicado y PENDING que pasa a un estado final. Si nunca llegó ninguna notificación ni retorno, DIZOR no conoce la transacción y no puede descubrirla por coincidencias de importe/correo: primero hay que habilitar y comprobar la entrega del proveedor. Los pedidos históricos sin ninguna evidencia requieren recuperación administrativa, no una confirmación ciega.
