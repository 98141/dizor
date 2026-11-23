# Checkout: confirmación contraentrega y WhatsApp

Verificado el 23 de noviembre de 2026. Trabajo local, con Chrome, Express real y MongoDB temporal de pruebas (replica set). No se usó la base de la tienda ni se hicieron cobros. El proceso de prueba dejó vacías las claves privadas de Wompi y bloqueó conexiones externas.

## Confirmación contraentrega

**No reproduje el 404 original, ni antes ni después del cambio visual. No pude demostrar su causa ni atribuirlo a la instancia temporal de la auditoría.** No se modificó el enrutamiento.

El checkout genera la URL mediante `confirmationPath(orderNumber)`, en `frontend/src/lib/orderAccess.js`: `/pedido/confirmacion?order=<referencia>`. La atiende `frontend/src/app/(shop)/pedido/confirmacion/page.js`. Después de crear el pedido, el checkout guarda el token de acceso de invitado en `sessionStorage`, vacía el carrito y navega a esa URL. La confirmación consulta `POST /api/checkout/orders/lookup`; no crea pedidos. Se conservó este mecanismo de acceso.

Se reprodujo desde `/carrito`, pulsando «Ir a checkout», completando contacto y Sandoná — Nariño, aceptando las autorizaciones y confirmando contraentrega. El carrito contenía un producto de prueba creado en la base temporal. No se inyectó un pedido ni una sesión autenticada.

| Ejecución | Referencia visible | Página / consulta / recarga | Pedidos antes / después / tras recarga |
| --- | --- | --- | --- |
| Antes, desarrollo | DIZ-20261123-D0852A2B1FC653ACFF2C | 200 / 200 / 200 | 0 / 1 / 1 |
| Antes, producción | DIZ-20261123-EE7142B7BFDCDD34A38D | 200 / 200 / 200 | 0 / 1 / 1 |
| Corregido, desarrollo | DIZ-20261123-8DCEFF7BA4C2014195DC | 200 / 200 / 200 | 0 / 1 / 1 |
| Corregido, producción | DIZ-20261123-E0D492EBC6DDB266D7F9 | 200 / 200 / 200 | 0 / 1 / 1 |

URL final de desarrollo: `http://127.0.0.1:59981/pedido/confirmacion?order=DIZ-20261123-8DCEFF7BA4C2014195DC`.

URL final de producción local: `http://127.0.0.1:62033/pedido/confirmacion?order=DIZ-20261123-E0D492EBC6DDB266D7F9`.

Los servidores y bases temporales se detuvieron al concluir. Los conteos proceden de consultas directas a MongoDB. En cada compra hubo exactamente un `POST /api/checkout/orders` (201). En MongoDB quedaron `paymentMethod: "contra_entrega"`, `paymentStatus: "pendiente"`, `orderStatus: "pendiente"` y `carrier: ""`. La confirmación mostró referencia, «Pago contra entrega» y «Pendiente», también tras recargar. La compra corregida se completó tocando el extremo derecho interior del botón.

No hubo una primera solicitud fallida del flujo: documento, navegación RSC y consulta del pedido respondieron correctamente. Una consulta adicional deliberada con token inválido devolvió 404, como exige la protección del pedido de invitado; es independiente de la navegación correcta y no reproduce el hallazgo. No se imprimieron los tokens en las evidencias.

Evidencia: [resumen de las cuatro ejecuciones](checkout-audit-fixes/summary.json), [HTTP y MongoDB en desarrollo](checkout-audit-fixes/fixed/development/evidence.json), [HTTP y MongoDB en producción](checkout-audit-fixes/fixed/production/evidence.json), [confirmación recargada](checkout-audit-fixes/fixed/production/confirmacion-reloaded.png).

## Solapamiento de WhatsApp

**Causa demostrada:** el checkout anterior calculaba la colisión en un efecto y actualizaba el contexto de WhatsApp mediante `requestAnimationFrame`. Al regresar desde el pie de página, el botón de compra podía quedar debajo del flotante antes de que esa actualización se aplicara. En ese intervalo `elementFromPoint` devolvía el SVG de WhatsApp en el extremo derecho. Esperar a que la página se estabilizara ocultaba el defecto.

Mediciones de producción antes del cambio (coordenadas de viewport; scroll vertical en píxeles):

| Viewport | scrollY | Punto derecho interior del botón | Elemento que recibía el toque |
| --- | --- | --- | --- |
| 375 × 667 | 1129 | (336, 622.34375) | SVG de WhatsApp |
| 768 × 1024 | 719 | (729, 972.234375) | path de WhatsApp |

Las capturas «antes inmediato» congelan ese estado con el depurador de Chrome justo después del desplazamiento y la medición; no modifican el DOM ni los estilos. También se guardaron capturas estabilizadas para distinguir ambos momentos.

La solución elimina la dependencia del efecto asíncrono: una regla CSS limitada a la presencia de `.checkout-surface` retira el flotante del hit testing. WhatsApp sigue disponible como enlace «Ayuda por WhatsApp» junto a «Volver al carrito», en el flujo normal y con una altura táctil mínima de 44 px. El flotante reaparece al salir del checkout, comprobado en la confirmación. No hay excepciones por ancho de pantalla ni cambios en el componente global de WhatsApp.

Se comprobaron 320 × 568, 375 × 667, 390 × 844, 768 × 1024 y 1440 × 900. En cada ancho se midieron centro y extremos interiores (8 px desde cada borde), inmediatamente al volver del pie, tras estabilizar y durante desplazamientos en ambos sentidos. En cada ejecución corregida hubo **138 puntos visibles comprobados y cero interceptados**. Sin errores JavaScript ni de hidratación.

En la ejecución inicial de desarrollo apareció además el indicador de herramientas de Next sobre algunos puntos izquierdos. El runner final desactiva `devIndicators` únicamente en su copia temporal, para medir la tienda; no se cambió `next.config.mjs` del proyecto. Producción confirmó el solapamiento de WhatsApp sin ese indicador.

| Ancho | Antes inmediato | Después |
| --- | --- | --- |
| 375 px | [Captura](checkout-audit-fixes/baseline/production/whatsapp-375-immediate.png) | [Captura](checkout-audit-fixes/fixed/production/whatsapp-375.png) |
| 768 px | [Captura](checkout-audit-fixes/baseline/production/whatsapp-768-immediate.png) | [Captura](checkout-audit-fixes/fixed/production/whatsapp-768.png) |

## Archivos de esta corrección y comprobaciones

- `frontend/src/app/(shop)/checkout/page.js`: retira el efecto de colisión y reutiliza `TrackedWhatsAppLink` para la ayuda secundaria.
- `frontend/src/styles/pages/checkout.css`: oculta el flotante exclusivamente en checkout y da tamaño táctil al enlace de ayuda.
- `frontend/test/checkout-audit-browser.cjs`: ejecución aislada de desarrollo/producción, MongoDB temporal, build y captura de evidencias.
- `frontend/test/helpers/checkoutAuditFlow.cjs`: reproducción desde carrito, hit testing durante scroll, compra contraentrega, recarga, conteos y protección del acceso invitado.
- Este informe y `docs/checkout-audit-fixes/`: resultados, registros y capturas.

El árbol ya contenía los cambios anteriores de checkout, catálogo y pasarela. Se conservaron. Los hashes de controlador de checkout, modelo de pedido, servicios y webhook de Wompi, vista de confirmación y acceso invitado siguen iguales a los del inicio de esta tarea: [comprobación SHA-256](checkout-audit-fixes/protected-sha256-after.json). No se modificaron reglas de pagos, inventario, pedidos ni envío.

Resultados: cuatro ejecuciones de navegador aprobadas (antes/después × desarrollo/producción), con seis comprobaciones por ejecución; dos builds locales `next build` con Turbopack aprobados; ESLint del checkout, sintaxis de los dos archivos nuevos de prueba y `git diff --check` aprobados. Registros de build: [antes](checkout-audit-fixes/baseline/production/build.txt), [después](checkout-audit-fixes/fixed/production/build.txt).

Para repetir desde `frontend` en este equipo (Chrome y dependencias de pruebas ya instalados):

```powershell
$env:MMS_DIR = 'C:/Users/Asus ExpertBook/Desktop/Desarrollo_MBT/RicardoMelo/ecommerce-mern/backend'
$env:MONGOMS_SYSTEM_BINARY = 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
$env:DIZOR_CHECKOUT_AUDIT_PHASE = 'fixed'
$env:DIZOR_CHECKOUT_RUNTIME = 'development' # repetir con production
node test/checkout-audit-browser.cjs
```

El runner copia el frontend sin `.env`, usa puertos loopback aleatorios y elimina su copia temporal al terminar. Configura `turbopack.root` sólo en esa copia para resolver la unión local de `node_modules`. `baseline` identifica las evidencias tomadas antes de editar: ejecutar ese modo sobre el código actual no restaura la implementación anterior.

La comprobación independiente pendiente es contrastar la instancia exacta que dio el 404 original y su primera respuesta fallida con estos registros; no se dispone de evidencia suficiente para explicar aquel fallo. La integración de Wompi queda fuera de estas pruebas.
