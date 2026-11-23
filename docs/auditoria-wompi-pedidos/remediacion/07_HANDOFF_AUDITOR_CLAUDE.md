# Handoff para auditor independiente — Claude

## Veredicto y alcance

**NO-GO para producción. Cambios locales preparados para revisión; sin cierre local incondicional.** Se implementaron defensas WP-01–06 y correcciones complementarias acotadas. Persisten E01–E06/V-01, decisiones comerciales y dos incompatibilidades explícitas de aserciones históricas. No hay autorización de despliegue por terminar esta entrega.

Raíz real: `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\Dizor\dizor`. Rama main, HEAD `9289c7b1451d3b800ca8412d788a9a13c45cc514` antes/después. Antes sólo había la carpeta Wompi sin seguimiento. No se editaron otros proyectos ni la copia de despliegue. No commits/pushes, migraciones, Atlas, .env, credenciales productivas, infraestructura, pagos o correos reales.

Leer 01–06 y las fuentes originales. 02 contiene causa/cambio/prueba, políticas y límites por hallazgo. 03 justifica decisiones y alternativas. 04 conserva cifras, fallos reales y limitaciones. 05 evita aceptar riesgos implícitamente. 06 contiene fuentes oficiales, E01–E06 y contención V-01 NO ejecutada.

## Lista exacta de código modificado

22 archivos preexistentes modificados:

1. `backend/src/app.js` — excepción exacta al limitador global.
2. `backend/src/controllers/adminAlertController.js` — inbox pendiente y detección de antiguos.
3. `backend/src/controllers/checkoutController.js` — orientación de fallo incierto y autocancelación electrónica segura.
4. `backend/src/controllers/orderAdminController.js` — ID de consulta, listado/reproceso/resolución e información de acciones.
5. `backend/src/controllers/wompiWebhookController.js` — payload original, validación e inbox antes de aceptar.
6. `backend/src/models/notification.js` — aviso de evento sin pedido.
7. `backend/src/models/order.js` — evidencia de resolución en incidencia.
8. `backend/src/models/paymentEvent.js` — asociación opcional, estado y observación mínima.
9. `backend/src/routes/adminOrderRoutes.js` — rutas administrativas protegidas.
10. `backend/src/server.js` — validación de prefijos/ambiente al arrancar.
11. `backend/src/services/notificationDelivery.js` — entrega/recuperación de aviso del inbox sin pedido.
12. `backend/src/services/notificationEvents.js` — outbox idempotente de evento financiero.
13. `backend/src/services/notificationTemplates.js` — plantilla administrativa escapada.
14. `backend/src/services/orderTransitions.js` — canSelfCancel ejecutable.
15. `backend/src/services/orderWorkspace.js` — acción de consulta disponible con ID introducible y etiquetas.
16. `backend/src/services/wompiPaymentService.js` — persistencia, asociación, validación financiera, precedencia VOIDED y aplicación existente de stock/cupón.
17. `backend/src/services/wompiService.js` — validación de configuración, sin nuevos endpoints de proveedor.
18. `frontend/src/app/(shop)/pedido/confirmacion/page.js` — texto pendiente y sondeo acotado.
19. `frontend/src/app/admin/alertas/page.js` — integración de revisión de eventos.
20. `frontend/src/components/admin/OrderDetail.jsx` — acciones de resolución y consulta con datos.
21. `frontend/src/components/admin/OrderNextAction.jsx` — formulario de ID legítimo antes de consultar.
22. `frontend/src/services/orderAdminService.js` — llamadas a nuevas acciones protegidas.

3 archivos de código nuevos:

23. `backend/src/services/paymentIncidentResolution.js` — políticas por código, evidencia, rol y auditoría transaccional.
24. `frontend/src/components/admin/PaymentEventAlerts.jsx` — bandeja/reproceso por consulta privada.
25. `frontend/src/components/admin/PaymentIncidentActions.jsx` — resolución explícita con motivo/evidencia.

El resto de archivos nuevos pertenece exclusivamente a esta carpeta de remediación: siete informes, scripts reproducibles y evidencias. Inventario exacto de todos ellos con SHA256 en `evidencias/archivos-remediacion.json`; SHA256 de los 25 archivos de aplicación en `archivos-codigo.json`. La carpeta original de auditoría ya estaba sin seguimiento y no es un cambio de esta ejecución.

## Diff y reproducción del cambio

`evidencias/codigo.diff` contiene el diff completo de aplicación respecto de HEAD, incluidos los tres archivos nuevos. `git-status.txt` registra el árbol sin confirmar. No se añadió nada al índice. Revisar el diff en conjunto con el código: dos fases financieras transaccionales y la aplicación de stock/cupón siguen en los servicios actuales, sin dependencias nuevas ni cambio de modalidad.

Reproducción opcional sobre copia desechable del commit auditado (nunca sobre trabajo del propietario): aplicar codigo.diff y comparar archivos-codigo.json. En el árbol actual `git apply --reverse --check docs/auditoria-wompi-pedidos/remediacion/evidencias/codigo.diff` sólo comprueba correspondencia inversa; NO ejecutar sin --check.

## Comandos de prueba (PowerShell)

Desde la raíz real. Use una instalación existente de mongodb-memory-server; no requiere añadir dependencias al proyecto. En esta máquina se usó `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\RicardoMelo\ecommerce-mern\backend` como MMS_DIR de sólo lectura. Binario instalado: `C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe`.

```powershell
$env:MMS_DIR = '<directorio existente con node_modules/mongodb-memory-server>'
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
$env:REMEDIATION_RUN = 'claude-ejecucion-nueva'

node --test docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs
node --test docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs

# Matriz histórica: sólo amplía proveedor simulado; no cambia aserciones.
node --require ./docs/auditoria-wompi-pedidos/remediacion/preservar.cjs docs/auditoria-wompi-pedidos/remediacion/auditoria-contrato.cjs

Push-Location backend
node --require ../docs/auditoria-wompi-pedidos/remediacion/preservar.cjs --require ../docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs --test --test-concurrency=1 test/*.test.js
Pop-Location

# Recorrido histórico + seis comprobaciones nuevas. Chrome/puppeteer ya instalados.
$env:REMEDIATION_UI = '1'
node --require ./docs/auditoria-wompi-pedidos/remediacion/preservar.cjs --require ./docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs docs/auditoria-wompi-pedidos/remediacion/navegador.cjs

node docs/auditoria-wompi-pedidos/remediacion/estatico.cjs
git diff --check
```

No sobreescribir resultados de esta entrega: redirigir stdout a otro nombre; para navegador/estático usar copia de la carpeta o cambiar sólo destino de resultados en una copia del runner. `preservar.cjs` desvía escrituras históricas al subdirectorio indicado por REMEDIATION_RUN. La ejecución de pruebas requiere loopback; EACCES bajo sandbox restringido es limitación de ambiente, no evidencia de fallo de pagos. Los fixtures bloquean red externa y reinicializan variables ficticias; no arrancar server.js con un .env real para QA.

## Resultados a reproducir, sin inflarlos

- Baseline real antes del código: suite **275/275**, matriz **38 PASS/11 FAIL/1 N/A**, 11 pruebas nuevas iniciales fallando.
- Cierre: **27/27** regresiones de pago y **2/2** de límites; **273/275** históricas, con P06/P23 incompatibles y preservadas. No se declara suite verde.
- Matriz original con contrato simulado ampliado: **44 PASS/5 FAIL/1 N/A**. P13/P20/P22b/P28 no ejecutan nueva entrada de ID o resolución; X07 sigue pendiente de política. Ver explicación individual en 04, no sustituir sus FAIL por PASS.
- UI: **26 checks = 20 históricos + 6 nuevos**, build aislado exitoso y sin errores de página/hidratación. Son Wompi/correo simulados, no E01/E02.
- Estático: **27 archivos con sintaxis comprobada**, cero diagnósticos nuevos del alcance, git diff --check sin errores. Deuda previa permanece. SHA256: **3374 archivos históricos comprobados, cero alteraciones**.

La pasada completa de suite-cierre se inició después de R26/R27; la clasificación del origen de la consulta de cancelación y conservación de revisión en consulta PENDING se ajustaron luego de su arranque. Las 27 regresiones se repitieron después (`regresiones-cierre.txt`), y la pasada focalizada P22/P24/Q13 histórica pasó **3/3** sobre los controladores y plantilla finales (`controladores-cierre.txt`). Esta precisión evita atribuir a la suite una foto de archivos distinta de la que cargó cada proceso. Los casos focalizados son repetición, no tres casos nuevos.

## Cuestionamientos prioritarios para Claude

1. Intentar modificar Link/moneda fuera de properties conservando checksum; comprobar que no confirma otro pedido y que guarda ambas observaciones mínimas.
2. Fallar inbox, outbox, auditoría e inventario por separado; verificar respuestas HTTP, durable acceptance, recuperación y ausencia de efectos parciales. Reinicio local es recarga de módulo, no certificación del host.
3. Intercalar APPROVED/VOIDED, consulta y cancelación; comprobar precedence, mismo ID aplicado sin Link, estados enviados/entregados, finanzas y stock sin retorno automático.
4. Resolver cupón/pago adicional con admin/vendedor/superadmin; comprobar motivo, evidencia exacta, auditoría atómica, duplicados y que no se habilita despacho sin pago/stock. La atestación de devolución no es una API bancaria.
5. Revisar los dos FAIL históricos incompatibles sin exigir reintroducir pagado por monto erróneo ni cancelación PENDING. No se modificaron aserciones para lograr una cifra verde.
6. Revisar ramas y proyecciones de esquemas ampliados, compatibilidad de históricos, destinatarios/leases/idempotencia del outbox y costo de GET adicional.
7. Mantener BLOCKED E01–E06 y V-01 hasta evidencia externa. Elegir políticas WP-07/08/12/15 y revisar reintento WP-11 antes de considerar cierre operacional.

No realizar operaciones financieras reales, infraestructura productiva, migraciones, commits/pushes o despliegues como parte de esta auditoría sin autorización posterior específica.
