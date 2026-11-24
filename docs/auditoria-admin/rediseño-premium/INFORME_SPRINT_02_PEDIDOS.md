# Informe Sprint 02 — Pedidos y exportaciones

Rediseño de presentación Operativo Premium Híbrido para el listado de pedidos, las bandejas operativas y la exportación de pedidos. La lógica comercial, el detalle de pedido y el dashboard de Inicio quedan fuera de este sprint.

Fecha de verificación: 24 de noviembre de 2026. Datos ficticios. Sin base real, sin pagos, sin correos y sin despliegue.

## 1. Diagnóstico anterior

El listado ya resolvía bandejas, filtros, paginación, `returnTo`, PDF filtrado y CSV general. La presentación ocupaba demasiado espacio:

- La cabecera de la página se repetía sobre la del listado.
- Las bandejas eran botones en varias filas, sobre todo en móvil.
- Búsqueda, método de pago y filtros avanzados permanecían siempre visibles.
- La tabla de escritorio era plana: la referencia larga dominaba la fila y el total no tenía jerarquía.
- En anchos intermedios y en móvil las tarjetas crecían en vertical y los estados informativos se leían como botones.
- Actualizar y Exportar PDF ocupaban una barra alta.
- Exportar pedidos compartía la pantalla con pestañas de Newsletter y Carritos y un bloque de texto demasiado largo.

No había capturas “antes” en el repositorio. La referencia es el listado previo de `OrdersList` y la pantalla histórica de `DataExports`.

## 2. Diseño final aplicado

Paleta ya presente en el sistema, sin inventar otra:

| Token | Valor |
| --- | --- |
| Grafito | `#252725` |
| Marfil | `#F7F6F2` |
| Tarjeta | `#FFFFFF` |
| Dorado | `#B87305` |
| Arena | `#F5C37B` |
| Borde | `#E8E4DB` |

La bandeja activa usa fondo blanco y borde dorado. El resto de bandejas comparte un solo estilo. El dorado no tiñe filas, totales ni botones de acción. La acción principal sigue en grafito. Los estados financieros usan chips discretos: ok, aviso, error, información y neutro.

El fondo marfil se aplica solo cuando la vista contiene el listado o la exportación (`:has`), para no retocar Inicio.

## 3. Archivos modificados

Presentación y pruebas de este sprint:

- `frontend/src/components/admin/OrdersList.jsx`
- `frontend/src/components/admin/DataExports.jsx`
- `frontend/src/components/admin/ContentWorkspace.jsx`
- `frontend/src/app/admin/pedidos/page.js`
- `frontend/src/app/vendedor/pedidos/page.js`
- `frontend/src/styles/pages/admin-orders.css`
- `frontend/src/lib/orderListPresentation.mjs` (nuevo)
- `frontend/test/sprint02-orders-presentation.mjs` (nuevo)
- `frontend/test/sprint02-orders-browser.cjs` (nuevo)
- `docs/auditoria-admin/rediseño-premium/evidencias-sprint-02/`

No se modificó backend, detalle de pedido, dashboard, tienda pública, `.env`, índices ni migraciones. El árbol de trabajo también contiene cambios de recuperación Wompi ajenos a este sprint; no se tocaron.

## 4. Componentes reutilizados

Los tokens `--admin-graphite`, `--admin-canvas` y `--admin-border-soft` viven en el layout administrativo. `--dizor-oro`, `--dizor-arena` y `--color-accent-text` viven en las variables globales.

Los componentes `dz-` del dashboard de Inicio no se importaron. Claude los está modificando y el layout del vendedor no carga esa hoja. Copiarlos habría cambiado Inicio o habría dejado al vendedor sin estilos. El lenguaje visual se replicó con clases `op-` dentro de `admin-orders.css`, hoja que ya cargan administración y vendedor.

Se conservaron `getAdminOrders`, `exportOrdersPdf`, `TRAYS`, `operationalActions`, las etiquetas de pedido y `formatCOP`. El detalle sigue usando `OrderWorkspace.module.css`; el listado ya no depende de ese módulo.

## 5. Cambios en el listado

Cabecera única: **Pedidos** y el subtítulo “Gestiona, prepara y realiza seguimiento a las compras de tu tienda.” A la derecha, Actualizar y Exportar. Se quitó el `h1` duplicado de las páginas de admin y vendedor.

Escritorio, con el contenido ancho (1440 px en el shell actual): tabla de seis columnas. Pedido y fecha, cliente, total y método, estado operativo y financiero, envío, siguiente acción. Cabecera discreta, separadores suaves, total en grafito, referencia abreviada con el número completo en `title`, texto para lector de pantalla y botón de copiar.

La referencia `DIZ-AAAAMMDD-…` se muestra como `DIZ-…` más los últimos seis caracteres. Cualquier otro número se deja intacto. No se regeneran identificadores.

En contenedores de hasta 64 rem (1024, 820, 390 y 360 con el sidebar real) la misma tabla pasa a fichas. Así no se aplasta una tabla de seis columnas ni se parten palabras a la mitad. El cambio usa `@container`, no un `overflow-x: hidden` global.

## 6. Cambios en las bandejas

Se mantienen Por preparar, Por despachar, En camino, Pendientes de recaudo, Requieren revisión, Todos y, solo si el backend entrega el conteo, Comunicaciones.

Escritorio: chips con nombre y contador. Una sola bandeja activa.

Móvil, por debajo de 759 px: un selector con el nombre y el contador de la bandeja elegida. Las siete categorías siguen en las opciones. El cambio escribe la misma URL (`tray` y página reiniciada). El vendedor no ve Comunicaciones porque el backend no le envía ese conteo.

## 7. Cambios de filtros

Barra compacta: búsqueda, método de pago, Filtros y Aplicar filtros. Fecha, estado operativo, estado financiero y transportadora quedan en el panel avanzado. El panel abre solo si la URL ya trae uno de esos campos, o si la persona pulsa Filtros. El contador del botón refleja cuántos hay activos. Limpiar filtros vuelve a la bandeja actual.

En móvil se ven primero la búsqueda, la bandeja y Filtros. Método de pago y Aplicar filtros aparecen al abrir el panel. Los campos ocultos siguen en el formulario para que el envío conserve los valores.

Se distinguen carga, error con reintento, vacío de bandeja, tienda sin pedidos y filtros sin coincidencias. Un fallo de API no pinta una lista vacía. Los textos que ya exigían las pruebas se conservan, entre ellos “Aplicar filtros”, “Cargando pedidos…”, “No se pudieron cargar los pedidos. Tus filtros se conservaron.” y “Reintentar carga”.

## 8. Optimización móvil

La ficha agrupa referencia y estado, cliente y fecha, total con método y estado financiero, envío y la siguiente acción. Las etiquetas de columna no se repiten. El estado informativo es una nota con enlace “Ver pedido”, no un botón negro.

Comprobado sin desborde horizontal en 390 y 360. La referencia larga no ocupa varias líneas. Los botones de acción no tapan el texto.

## 9. Rediseño de exportaciones

Desde Pedidos, Exportar abre un menú corto:

- **Exportar PDF.** Usa la bandeja y los filtros de la pantalla. Máximo 500 pedidos, el mismo tope del endpoint (10 páginas de 50).
- **CSV general.** Solo en administración. Enlace histórico `/admin/contenido?tab=exports&scope=orders`. El texto dice que no usa la bandeja ni los filtros y que el tope es 5.000.

La tarea de pedidos tiene título **Exportar pedidos**, el subtítulo “Descarga los registros autorizados de tu tienda.” y una tarjeta: alcance general, límite 5.000, aviso de datos personales, botón “Exportar pedidos (CSV)” y regreso a Pedidos. No compite con Newsletter ni Carritos.

`tab=exports` sin `scope=orders` conserva Pedidos, Newsletter y Carritos, sus permisos y los botones “Exportar pedidos (CSV)”, “Exportar newsletter (CSV)” y “Exportar carritos (CSV)”. Los textos “Exportaciones de pedidos”, “Exportaciones históricas”, “Exportaciones de newsletter” y “Exportaciones de carritos” siguen visibles donde las pruebas los buscan. No hay un servicio de exportación nuevo.

## 10. Compatibilidad de permisos y rutas

| Ruta | Quién | Qué conserva |
| --- | --- | --- |
| `/admin/pedidos` | Administración | Listado, PDF y acceso al CSV |
| `/vendedor/pedidos` | Vendedor | Listado y PDF. Sin CSV y sin Comunicaciones |
| `/admin/contenido?tab=exports&scope=orders` | Administración | CSV general de pedidos |
| `/admin/contenido?tab=exports` | Administración | Las tres exportaciones históricas |
| `scope=newsletter` y `scope=carts` | Administración | Su exportación, con sus límites |

El enlace al detalle incluye `returnTo` con la URL del listado. No cambian endpoints, roles, máquina de estados ni reglas de Wompi, contraentrega, recaudo o inventario.

Acciones ejecutables, tomadas del backend: preparar, despachar, registrar entrega y registrar recaudo. Revisión, cerrado, espera de recaudo, espera de pago y completado se muestran como nota. Un pedido contraentrega entregado y pendiente sigue como “Recaudo pendiente”, no como cobrado. Si el estado operativo y el financiero dicen lo mismo, el chip financiero no se duplica.

## 11. Pruebas ejecutadas

`frontend/test/sprint02-orders-presentation.mjs`: 4 pruebas, 0 fallos. Cubren abreviatura de referencia, pago distinto de entrega, acciones reales frente a notas y fecha en America/Bogota.

`frontend/test/sprint02-orders-browser.cjs`: pasó, sin errores de página ni peticiones externas. Cubre los 24 puntos pedidos: listado, bandejas y contadores, bandeja móvil, búsqueda, filtros, limpieza, URL y regreso, paginación, fichas, referencias largas, estados de pago, siguiente acción, nota informativa, PDF, CSV, diferencia de alcance, exportaciones históricas, vendedor, vacío, carga, error y foco de teclado. Anchos 1440, 1024, 820, 390 y 360.

El harness compila los componentes reales con datos ficticios y Chrome local. No usa base de datos.

## 12. Regresión

`frontend/test/orders-workspace-browser.cjs`: 20 comprobaciones, `passed: true`, sin errores de página. Incluye dashboard, filtros, paginación, preparación, despacho, entrega separada del recaudo, WhatsApp no automático, vendedor, incidencias, error de API, vacío, detalle, teclado, 390 y 360, y Wompi pendiente sin preparación.

La primera ejecución se detuvo porque el harness escribe `docs/auditoria-admin/fase3-evidencias/navegador.json` y esa carpeta no existía. Se creó la carpeta, sin editar la prueba, y la segunda ejecución cerró en verde. Las pruebas anteriores no se modificaron para ocultar fallos.

No se ejecutaron las suites de navegación con Next y Mongo. El alcance y los textos de exportación se comprobaron en el harness aislado, que monta `OrdersExportScreen` y `DataExports` con los mismos contratos.

## 13. Lint y build

ESLint sobre los archivos de pedidos, exportaciones, contenido, páginas y la presentación: 0 errores. Un `setState` dentro de un efecto, al sincronizar el panel de filtros con la URL, se reemplazó por un formulario que se monta de nuevo con la consulta. Se volvieron a correr las dos suites de navegador después de ese cambio.

`npm run build` en `frontend`: Next.js 16.2.6, compilación correcta, TypeScript correcto, 50 páginas estáticas, salida 0. Quedan generadas `/admin/pedidos`, `/admin/pedidos/[id]`, `/admin/contenido`, `/vendedor/pedidos` y `/vendedor/pedidos/[id]`. No se desplegó.

## 14. Capturas

Después, en `docs/auditoria-admin/rediseño-premium/evidencias-sprint-02/`:

| Archivo | Qué muestra |
| --- | --- |
| `pedidos-escritorio.png` | Tabla a 1440, bandeja activa, columnas alineadas |
| `pedidos-1024.png` | Fichas a 1024, sin columnas aplastadas |
| `pedidos-tablet.png` | Fichas a 820 |
| `pedidos-movil-390.png` | Fichas y selector de bandeja |
| `pedidos-movil-360.png` | Igual, sin desborde |
| `pedidos-filtros.png` | Panel avanzado en escritorio |
| `pedidos-filtros-movil.png` | Panel avanzado en móvil |
| `exportacion-escritorio.png` | Tarea CSV, migas Pedidos / Exportar pedidos (CSV) |
| `exportacion-movil.png` | La misma tarea en móvil |
| `resultado.json` | Comprobaciones del harness |

No hay capturas anteriores en el repositorio. La comparación es contra el listado plano y las bandejas en varias filas que reemplazó esta presentación.

## 15. Problemas detectados y corregidos

- `display: flex` en las celdas rompía la tabla. El agrupado pasó a un elemento interno.
- El selector de bandeja se veía también en escritorio porque una clase genérica ganaba a `display: none`. La regla específica lo oculta desde 760 px.
- `overflow-wrap: anywhere`, heredado del shell, partía “Comenzar preparación” y los nombres. El listado usa corte por palabra.
- En 1024 y 820 la tabla de seis columnas no cabía. Esas anchuras usan las fichas del contenedor.
- Un pedido Wompi mostraba “Pago pendiente” dos veces. El chip financiero se omite cuando el texto coincide con el estado operativo. Contraentrega pendiente sigue mostrando “Recaudo pendiente”.
- La primera regresión no podía guardar su JSON. Se creó el directorio que el harness ya esperaba.

## 16. Pendientes

- El detalle de cada pedido conserva su presentación actual. El acceso y `returnTo` siguen igual.
- Inicio y Alertas no se modificaron.
- Las suites de navegación que levantan Next contra Mongo no se corrieron. Exigen una base, y este sprint no usa datos reales.
- El punto en que las fichas sustituyen a la tabla depende del ancho del contenido (64 rem). Si el sidebar cambia de ancho, conviene volver a mirar 1440 y 1024.

## 17. Recomendaciones para el detalle de pedido

Cuando se rediseñe el detalle, conviene partir de las mismas superficies, chips y botones `op-`, sin cargar la hoja del dashboard en el vendedor.

Mantener separados el estado operativo, el estado financiero y la siguiente acción. Una entrega contraentrega no debe presentarse como cobrada. Las esperas de pago y de recaudo deben seguir siendo notas, no botones.

La referencia completa puede ir en la cabecera del detalle; en el listado basta la forma abreviada con copia. El regreso debe usar `returnTo` para no perder bandeja, filtros ni página.

No hace falta un sistema visual nuevo. El detalle puede heredar grafito, marfil, borde suave y el dorado solo en el elemento activo.
