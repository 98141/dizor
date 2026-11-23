# Checkout en una página — 2026-11-23

## Auditoría previa a la implementación

- Repositorio real: `dizor/`; el directorio padre contiene también copias `copia/` y `despliegue/`. No se editarán esas copias. No se encontraron archivos AGENTS.md en el repositorio ni en sus dos directorios padres inmediatos.
- Árbol inicial: 22 archivos modificados, más el servicio de resolución de incidencias, dos componentes administrativos, pruebas y documentación Wompi sin seguimiento. Se revisaron los diffs de checkoutController, order y confirmación, además de las rutas y servicios implicados. Se preservan las modificaciones existentes de Wompi, conciliación, alertas y confirmación.
- `frontend/src/app/(shop)/carrito/page.js`: revalida el cupón antes de navegar a `/checkout`. La compra como invitado es directa. `checkout/page.js` contiene el formulario completo, cinco pasos condicionales, navegación Continuar/Atrás y revisión únicamente en el último paso. Prellena contacto y dirección predeterminada del usuario; permite escoger otra dirección guardada. El personal no puede comprar.
- En ese mismo archivo: `carrier` comienza en `interrapidisimo`; al cargar `/checkout/config` se selecciona el actual o el primero de `config.carriers`. El paso Entrega muestra radios y la solicitud incluye `carrier`. `canNext` solo comprueba presencia por paso; no muestra errores por campo ni enfoca el primero inválido.
- `frontend/src/services/checkoutService.js` envía POST `/checkout/calculate` con items/departamento y POST `/checkout/orders` con items, buyer, shippingAddress, paymentMethod, carrier, customerNotes, couponCode, idempotencyKey y autorizaciones legales. Existe código inactivo para Nequi; los medios públicos actuales son Wompi (si está configurado) y contraentrega, según `backend/src/services/paymentMethods.js`.
- La revisión final de `nequiPaymentService.js` constató que las banderas históricas podían volver a ofrecer Nequi desde `paymentMethods.js`. La implementación fija también la lista pública en servidor a Wompi/contraentrega, aunque esas banderas estén activadas; no cambia la integración Wompi ni los registros históricos.
- `backend/src/routes/checkoutRoutes.js` monta POST `/orders` con autenticación opcional y bloqueo de personal. `checkoutController.createCheckoutOrder` exige contacto, dirección, autorizaciones y método habilitado; resuelve catálogo, cantidades enteras, variantes activas, disponibilidad, precios y totales en servidor (`cartService.js`). Valida/aplica cupón de nuevo. Antes del cambio acepta transportadora vacía o activa y la incluye en la huella de idempotencia.
- `backend/src/services/orderService.js` guarda buyer, shippingAddress (address/city/department/postalCode/country), paymentMethod, paymentStatus, orderStatus, carrier y trackingNumber, además de totales y copias de productos. `models/order.js` ya permite `carrier: ""` como valor predeterminado; conserva interrapidisimo, servientrega, envia y coordinadora. No requiere migración.
- Contraentrega: pedido `pendiente`, pago `pendiente`, descuento transaccional de existencias y consumo de cupón al crear. Wompi: `pago_pendiente`, pago `pendiente`, sin descontar existencias hasta confirmar el pago mediante el procesamiento existente. Crea un enlace externo en `wompiService.createPaymentLink`, COP, un solo uso, sin recolectar envío; vuelve a `/pedido/confirmacion`. El frontend guarda el token antes de redirigir. El retorno solo consulta confirmación protegida; los cambios locales añaden sondeo y texto de pago pendiente, sin declarar pago por parámetros del navegador.
- Invitado/autenticado comparten validaciones, pagos e idempotencia. El autenticado asocia user y vacía su carrito del servidor; el invitado conserva acceso por token. La confirmación admite token o dueño autenticado. Hay bloqueo síncrono por ref frente a doble clic y clave única en el modelo, huella de solicitud y repetición controlada en backend.
- Administración ya asigna carrier y trackingNumber mediante PATCH `/api/admin/orders/:id/shipping` en preparación/envío, sujeto a readiness y permisos. `frontend/src/components/admin/OrderDetail.jsx` muestra `Sin asignar`; `OrderNextAction.jsx` permite registrar la guía. Cuenta y seguimiento muestran etiquetas/enlaces históricos cuando carrier existe. No hay que crear logística ni modificar esos componentes.

## Resultado implementado

- Checkout con cuatro secciones siempre montadas: contacto, dirección, pago y resumen. Dos columnas en escritorio y una en móvil; total COP inmediatamente antes del único botón principal. Textos: `Ir a pagar con Wompi` / `Confirmar pedido contraentrega`. Se conserva volver al carrito.
- Los campos, notas y consentimientos conservan sus valores al cambiar de pago o fallar el servidor. Validación de contacto/dirección/consentimientos junto al campo, con foco en el primero inválido. La sesión se hidrata antes de prellenar datos y direcciones; los cambios posteriores de pago no reemplazan el borrador.
- El navegador no contiene selector, estado, valor predeterminado ni envío de transportadora. El endpoint ignora `req.body.carrier`, incluso valores inválidos, y usa `carrier: ""` en creación y huella de idempotencia. `orderService` y el modelo mantienen su representación existente. Administración conserva su asignación al despachar y los cuatro valores históricos.
- Se conservan bloqueo síncrono de doble envío, clave de idempotencia, cálculo y validación del servidor, consumo de cupón/existencias, token de acceso, redirección Wompi y confirmación existente. Las respuestas de cotizaciones anteriores no reemplazan el resumen actual.

## Archivos cambiados por esta tarea

Aplicación:

- `frontend/src/app/(shop)/checkout/page.js`: formulario, resumen, validación/foco y envío sin transportadora; conserva flujo de pagos.
- `frontend/src/styles/pages/checkout.css`: disposición adaptable; elimina indicador de pasos.
- `frontend/src/lib/checkoutValidation.js`: validación de los campos antes del envío.
- `frontend/src/components/auth/AuthFormField.jsx`: asociación accesible del error mediante `aria-invalid` y `aria-describedby`.
- `backend/src/controllers/checkoutController.js`: elimina transportadoras de la configuración pública e ignora asignación del cliente. Las modificaciones previas de conciliación/reintento permanecen.
- `backend/src/services/paymentMethods.js`: lista pública limitada a Wompi/contraentrega, incluso si quedan banderas históricas Nequi.

Pruebas:

- `backend/test/checkout.test.js`: diez escenarios de integración con servidor y MongoDB temporal.
- `frontend/test/checkout-browser.cjs`: componentes/servicios reales con backend real temporal; adaptadores para router y contextos. Incluye errores, foco, conservación del borrador, doble envío, invitado/autenticado, direcciones, redirección/retorno y seis anchos.
- `frontend/test/helpers/phase7BrowserFlow.cjs` y `phase7LastUnitFlow.cjs`: actualiza los recorridos existentes al checkout sin pasos; conserva sus aserciones de compra/administración.
- `backend/test/helpers/phase2Fixture.cjs`: expone una forma explícita de registrar la respuesta de consulta del proveedor simulado. El recorrido Next incluye ahora el ID de enlace y esa respuesta, como exige la integración Wompi encontrada; no se copian eventos automáticamente al proveedor ni se relajan aserciones.
- `frontend/test/phase7-next-browser.cjs`: permite dirigir evidencias a `DIZOR_PHASE7_OUT`, conservando su destino predeterminado.
- Este informe y `docs/checkout-*.txt`, `docs/checkout-evidencias/`: registros, comparación del controlador anterior, capturas y prueba de enlace sandbox. No se modificaron modelos ni pantallas administrativas por esta tarea.

## Pruebas del backend

- Verificación final específica: **59/59** aprobadas (10 nuevas de checkout, 2 existentes phase1-v2 y 47 existentes de remediación Wompi). Registro: `checkout-backend-pruebas.txt`.
- Suite general existente más las primeras 9 pruebas de checkout: **286 ejecutadas, 260 aprobadas, 26 fallidas**. Registro: `checkout-regresion-backend.txt`. Esta ejecución precede únicamente a la prueba adicional de banderas Nequi y su bloqueo público; ambos se verificaron en la ejecución final 59/59.
- Comparación con el controlador anterior a esta tarea, cargado en memoria y conservando los cambios locales Wompi: **277 existentes, 251 aprobadas, los mismos 26 fallos**. Registro: `checkout-regresion-baseline.txt`; nombres comparados en `checkout-evidencias/comparacion-regresion.json` (`sameFailures: true`). El snapshot tiene el mismo contenido del controlador encontrado al comenzar (blob `0dfa4e4`); no se revirtieron archivos de la aplicación para ejecutar la comparación.
- Esos 26 fallos se concentran en suites antiguas de Wompi, notificaciones y operación que simulan eventos sin las respuestas de consulta que exige el trabajo previo, y en expectativas antiguas de cancelación/estados. No se cambiaron esas expectativas ni se declara verde la suite general. Las regresiones específicas del trabajo Wompi previo sí pasan.
- MongoDB 8.3.2 local temporal, sin `.env`, claves ficticias y proveedor simulado con red externa bloqueada. La primera ejecución dentro del sandbox falló por EACCES en sockets locales; se repitió con los permisos correspondientes y pasó. No se usó la base de datos real.

## Pruebas de interfaz

- Navegador de componentes y backend temporal: **aprobado**, sin errores JavaScript ni solicitudes externas. Evidencia: `checkout-evidencias/resultado.json` y `checkout-navegador.txt`. Anchos 1440, 1024, 820, 800, 390 y 360; capturas de 1440, 390 y 360 inspeccionadas.
- Ocho pruebas existentes de campos administrativos y bloqueo de doble clic: **8/8** aprobadas.
- ESLint sobre checkout, validación y AuthFormField: **aprobado sin errores**.
- Recorrido existente con Next real: **aprobado, 20 comprobaciones**, sin errores JavaScript ni de hidratación. PDP → carrito → checkout → confirmación, contraentrega con respuesta perdida/reintento, Wompi simulado aprobado y rechazado, doble clic, administración/asignación/despacho/corrección/entrega/recaudo, dos invitados disputando la última unidad, permisos y finanzas. Evidencias: `checkout-evidencias/next/next-navegador.json`, `integracion-compras.json` y `checkout-next-navegador.txt`.

## Build

- `npm run build` de frontend: **aprobado**, 50 páginas, API fijado a loopback sin servidor real. Registro `checkout-build.txt`. El primer intento compiló pero el sandbox bloqueó un mkdir de prerender; repetido con permisos, finalizó correctamente.
- El arnés de Next real también construye una copia temporal con `--webpack`, sin archivos `.env`, credenciales heredadas ni red externa. Su registro está en `checkout-evidencias/next/build-fase7.txt`.

## Alcance comprobado de Wompi

- Existen claves locales con prefijo sandbox; no faltan credenciales para crear el enlace. Se comprobó **una creación de enlace real en el API sandbox**, usando `wompiService.createPaymentLink` sin modificar, identificador sintético y retorno a localhost. Evidencia: `checkout-evidencias/sandbox-link.json`; script reproducible `sandbox-link.cjs`, que rechaza ambiente/claves de producción.
- No se enviaron transacciones ni datos de tarjeta al proveedor, no se efectuaron cobros reales y no se creó ningún pedido en la base real. Redirección, retorno con token, consulta protegida, pago pendiente y aprobación verificada se probaron con Wompi simulado. La creación real del enlace no acredita una transacción aprobada ni la entrega real de un webhook.

## Verificación independiente para Cursor

1. Revisar los diffs sobre el árbol local, distinguiendo estos seis archivos de aplicación del trabajo previo de pasarela. No sustituir la integración ni las modificaciones de conciliación/confirmación.
2. Repetir creación sin `carrier` y con un valor arbitrario, como invitado y cliente, verificando `carrier: ""`, dirección conservada, administración accesible y asignación posterior. Abrir también pedidos con interrapidisimo/servientrega/envia/coordinadora.
3. Repetir correcciones de campos, cambio de pago, direcciones guardadas, error de servidor y doble clic en escritorio/móvil. Comprobar que el POST de creación solo ocurre en la acción final.
4. Ejecutar las diez pruebas de checkout y las 47 regresiones específicas Wompi. Investigar por separado los 26 fallos generales reproducidos en la línea base; no resolverlos relajando la verificación del proveedor.
5. Completar una transacción de prueba en el checkout alojado de Wompi, con medios de prueba oficiales y webhook sandbox hacia un backend local accesible. Verificar retorno antes/después del webhook y rechazo/pendiente. Esta parte no quedó acreditada por una transacción real de sandbox.

No se desplegó, no se hicieron commits y no se alteraron las copias `copia/` o `despliegue/`.

## Reproducción local

Los arneses reutilizan la instalación existente de mongodb-memory-server (sin agregar dependencias de producción):

```powershell
$env:MMS_DIR = 'C:/Users/Asus ExpertBook/Desktop/Desarrollo_MBT/RicardoMelo/ecommerce-mern/backend'
$env:MONGOMS_SYSTEM_BINARY = 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
# Desde la raíz dizor:
node --test backend/test/checkout.test.js backend/test/phase1-v2.test.js docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs docs/auditoria-wompi-pedidos/remediacion-2/regresiones.test.cjs
node frontend/test/checkout-browser.cjs
# Desde frontend:
npx eslint 'src/app/(shop)/checkout/page.js' src/lib/checkoutValidation.js src/components/auth/AuthFormField.jsx
npm run build
```
