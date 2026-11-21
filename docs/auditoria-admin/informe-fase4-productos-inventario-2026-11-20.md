# DIZOR — Fase 4 de 7: productos, variantes e inventario

Fecha: 20 de noviembre de 2026. Alcance: implementación y pruebas locales con datos ficticios. **Estado: lista para auditoría independiente local.** No se autoriza ni se ejecuta despliegue.

## 1. Resumen ejecutivo

Productos reúne ahora búsqueda, existencias por presentación y movimientos, con acceso contextual a la configuración del catálogo. La ruta histórica de Inventario permanece disponible y abre la misma experiencia de movimientos. El menú general no se reorganizó.

El administrador puede encontrar productos fuera del antiguo límite de 100, consultar variantes, ajustar cantidades sin abrir el editor completo, comprobar un resultado ambiguo y revisar su movimiento. Las existencias se clasifican por variante, con umbral cinco, excluyendo variantes inactivas de la disponibilidad. Las cantidades históricas ausentes o fraccionarias requieren revisión y no se normalizan al consultar o ajustar.

El endpoint relativo y el historial de Fase 1 siguen siendo la base de la operación. Se añadieron persistencia de la intención del ajuste y consulta de resultado para recuperar respuestas perdidas, además de una protección transaccional de SKU entre escrituras administrativas concurrentes. No se sustituyó el motor de ventas, pedidos o comunicaciones.

Se aprobaron **210 pruebas Node**: las 162 anteriores, las seis independientes del cierre de Fase 3 y 42 nuevas de Fase 4. Pasaron **20 comprobaciones de navegador** con componentes React y shell reales, API ficticia y navegación adaptada. Sintaxis correcta, build local aislado con salida 0 y sin diagnósticos nuevos de lint; se mantienen los problemas previos detallados en la sección 17.

No se modificaron producción, `.env`, pedidos históricos, reglas financieras, arquitectura de notificaciones ni las bandejas de Fase 3. No se enviaron correos, no se ejecutaron pagos reales, no se activó entrega externa y no hubo commits, pushes o despliegues.

## 2. Inventario de funcionalidades anteriores

Se revisaron los informes de auditoría general, integridad, notificaciones y operación de pedidos, los tres cierres independientes y las evidencias/pruebas correspondientes. El cierre de Fase 3 es funcional local con pendientes externos, sin hallazgos altos o medios. Su observación de rendimiento sobre las bandejas de pedidos se conserva sin modificar ese módulo.

| Funcionalidad vigente | Situación antes de esta fase |
|---|---|
| Productos | Dos vistas locales; primera carga de hasta 100 productos y descarga paralela del resumen completo. Sin búsqueda/filtros/paginación operativa en esa pantalla. |
| Variantes | Tabla expandible con talla, color, SKU y cantidad; disponibilidad principal calculada por total del producto. |
| Editor | Información general, precios, variantes, galería y publicación/SEO; subida existente y enlaces de imágenes; SKU generado. Talla/color obligatorios en modelo y formulario. |
| Ajuste | POST relativo transaccional con clave estable, movimiento y cuatro pruebas de protección inmediata de React. Disponible dentro del editor. |
| Movimientos | `ProductHistory`, historial no editable, filtros y PDF; pantalla separada en Inventario. |
| Alertas | Detección por variantes mejorada en Fase 2, agrupada por producto; accesos todavía generales hacia Inventario. |
| Protección histórica | Edición conservaba IDs y desactivaba variantes omitidas, pero DELETE de producto aún era físico. |
| Pedidos | Descuento/restauración transaccional e idempotencia de las fases anteriores. No se reemplazaron. |

El árbol de trabajo estaba limpio al comenzar. No se modificaron archivos ajenos a esta fase ni las pruebas anteriores para ajustar sus resultados.

## 3. Cambios UX/UI y relación con hallazgos ADM

| Hallazgo | Cambio verificable |
|---|---|
| **ADM-07**, stock sobrescrito por edición | Se mantiene la exclusión de stock de variantes existentes en el payload del editor y su protección backend. Se prueban ventas simultáneas con edición y ajustes relativos. |
| **ADM-18**, agotados invisibles por total | Criterio común por variante en consultas, detalle y alertas; un producto con 10 unidades y otra presentación en cero aparece con agotados. |
| **ADM-19**, cantidades fraccionarias | Validación de enteros seguros, resultado no negativo, bloqueo de datos históricos inválidos y ausencia de redondeos. |
| **ADM-29**, inventario disperso | Navegación secundaria Productos / Existencias / Movimientos / Configuración del catálogo, sin reorganizar el menú general de Fase 5. |
| **ADM-31**, límite 100 y borrado físico | Búsqueda por nombre/SKU, filtros y paginación backend; DELETE conserva producto y variantes mediante desactivación. |

Se mantuvieron la identidad negra/arena, tipografía, botones y jerarquía administrativa de Fase 3. Las acciones sensibles tienen texto explícito y confirmación contextual. Los filtros avanzados se agrupan para reducir la extensión en móvil. Carga, vacío, ausencia de coincidencias, error y recuperación tienen estados distintos.

## 4. Estructura de Productos y consultas

`CatalogWorkspace` comparte las vistas Productos y Existencias y monta el historial existente reorganizado en Movimientos. `/admin/inventario` conserva su URL y abre Movimientos. Las rutas de nuevo/editar y `/admin/catalogo` siguen disponibles. No se eliminó ningún endpoint o componente exportado con consumidores anteriores.

El servicio backend `catalogWorkspace` valida búsqueda, categoría, tejido, publicación, estado de stock, producto contextual y paginación. Escapa los caracteres especiales del término y limita su longitud a 160; no interpreta regex proporcionados por el usuario. Se consulta una página del servidor, con límite entre 1 y 100 y valor predeterminado 20. `total` y `totalPages` permiten recorrer el resto del catálogo.

Una agregación filtra y calcula el estado del inventario, y una faceta obtiene conteo y página con orden estable por fecha e ID. Solo los productos de esa página reciben la carga relacionada de taxonomías. No se hacen solicitudes HTTP por fila ni se descarga el catálogo completo para paginar en React. El endpoint histórico de resumen conserva `inventory` y añade los mismos metadatos de paginación; sus consumidores deben recorrer las páginas.

Los filtros y la página viven en la URL. El editor recibe un regreso interno validado hacia Productos o Inventario, con la consulta original. Una página fuera del rango muestra su situación y un enlace a la primera, sin afirmar que no existen productos. Una selección contextual de producto se puede quitar de forma explícita.

## 5. Gestión de variantes y significado del stock

Cada presentación conserva su ID y muestra identificación, talla/color cuando existan, SKU, cantidad, estado y acciones autorizadas. Las variantes inactivas se muestran como inactivas, aunque tengan unidades; no se suman como disponibilidad de venta. Una publicación desactivada conserva cantidades, pero no ofrece unidades para nuevas ventas.

Se hicieron opcionales talla y color en el esquema y el editor. Una presentación real puede identificarse por su SKU sin crear tallas o colores artificiales. El modelo sigue guardando el inventario por presentación; no se añadió un segundo stock a nivel de producto ni un concepto de reservado. Al abrir un registro histórico sin variantes no se le inserta automáticamente una presentación.

La clasificación común es: dato por revisar, agotado/sin variantes activas, bajo y suficiente. Cada variante conserva su clasificación individual. Para evitar alertas duplicadas, si un producto tiene agotados y bajos se agrupa en Agotados; la interfaz lo explica y las variantes siguen mostrando ambos estados. El filtro de stock bajo se identifica como «sin agotados».

`totalStock` conserva la suma de cantidades registradas de variantes activas; las cantidades inválidas se señalan para revisión. `availableStock` excluye cantidades inválidas y se pone en cero cuando la publicación está desactivada. No se convierte una cantidad ausente en un cero aparente ni una fracción en unidades enteras. En esos casos el ajuste normal queda bloqueado para una revisión autorizada de datos, fuera de una edición ordinaria.

## 6. Ajustes rápidos e idempotencia

Desde una variante se abre un formulario compacto: agregar/retirar, cantidad, motivo, stock previsto y confirmación. El valor previsto es orientativo; el resultado final puede cambiar por una venta o ajuste concurrente. La operación no envía precio, descripción u otros atributos.

Se reutiliza **POST `/api/admin/catalog/products/:id/stock`**. Mantiene delta relativo, transacción MongoDB, clave estable, responsable, fecha y movimiento único en `ProductHistory`. La misma clave exige mismo producto, variante, actor, cantidad y motivo. Dos administradores con claves distintas acumulan sus deltas y no se sobrescriben. El stock no puede quedar negativo ni ser fraccionario o exceder un entero seguro.

La referencia de bloqueo se actualiza antes del siguiente render. El botón se deshabilita durante la petición y una acción ya completada no se vuelve a ejecutar por un handler antiguo. La intención se guarda antes de la llamada en `sessionStorage`, separada por actor/producto/variante, y se restaura al volver a abrir el panel. No se almacenan credenciales ni información de clientes allí.

Ante una respuesta ambigua se conservan cantidad, motivo y clave; la pantalla ofrece «Comprobar resultado». El nuevo GET `/products/:id/stock-operations/:operationKey` consulta evidencia de esa operación del actor autorizado. Distingue resultado aplicado, rechazo final y ausencia de constancia. Esta última **no** se interpreta como prueba de que la petición terminó: el reintento conserva la misma clave y cuerpo.

`StockAdjustment` guarda la intención y su estado, separado del historial de movimientos reales. Cada intento escribe esa misma intención dentro de la transacción del ajuste. Un rechazo final queda persistido sin crear un movimiento ficticio y bloquea que una petición tardía aplique después esa misma intención. Así se puede corregir una solicitud rechazada sin confundirla con otra operación todavía incierta.

El movimiento real, el stock y el estado aplicado se confirman juntos. Si falla el historial, se revierte el stock; el reintento puede recuperar la misma clave. La creación inicial de la intención no mueve unidades. Un resultado repetido conserva el stock que dejó la operación original y consulta también el stock actual, que podría haber cambiado por otros movimientos.

El ajuste anterior del editor permanece como acceso alternativo plegado y conserva sus cuatro pruebas sin modificar. El nuevo panel contextual es la vía principal para las operaciones frecuentes.

## 7. Historial de movimientos

Movimientos conserva los registros reales: producto, variante/SKU, tipo, cantidad, antes/después, fecha colombiana, responsable, motivo y referencia. Diferencia venta, reposición, retiro administrativo, restauración por pedido y otros registros. Un registro de cantidad cero no se presenta como retiro; un ajuste histórico asociado a un pedido no se atribuye sin evidencia a una operación administrativa.

Los filtros incluyen producto, variante contextual, SKU exacto en API, texto, tipo actual o histórico, clase de movimiento, fechas y responsable. Se conservan los valores de URL y las selecciones mientras llegan sus opciones. Cambiar de producto retira el filtro de una variante anterior que ya no corresponda. Los tipos históricos que no pertenezcan al enum actual siguen siendo consultables por igualdad; no se habilitan como nuevos tipos de escritura.

La búsqueda general permite encontrar registros aunque su producto ya no exista o no figure entre las opciones abreviadas. Los snapshots conservan el nombre y SKU que se registraron; no se reescriben para adoptar la información actual. Los datos ausentes se muestran como tales. El historial continúa sin rutas de edición arbitraria.

Se mantienen resumen general y exportación PDF, con filtros y límite explícito de 5000 registros. Las opciones de productos y responsables están acotadas a 50; para otros productos se utiliza la búsqueda o el enlace contextual. No se reconstruyeron movimientos históricos inexistentes.

## 8. Alertas por variante

`inventoryCriteria` centraliza el umbral **5** y la clasificación utilizados por Productos, resumen de existencias y alertas. No se añadieron configuraciones nuevas por producto/variante ni se alteraron niveles históricos.

Las alertas distinguen bajas, agotadas/sin presentaciones activas y existencias históricas por revisar. Solo corresponden a publicaciones activas. Un producto con varias condiciones aparece una vez en su categoría prioritaria, con las variantes afectadas; una variante inactiva no se anuncia como agotada vendible.

La página de alertas y la campana conservan sus componentes y accesos. Sus enlaces de inventario llevan al producto y variante afectados, con foco visible; ya no obligan a buscar el SKU en un historial general. Los contadores y muestras se obtienen en backend; la muestra está acotada a diez productos por grupo. No se crearon correos ni campañas de inventario.

## 9. Mejoras del editor

Se conservaron los campos anteriores y se organizaron en Información general, Imágenes, Precio y promoción, Presentaciones/variantes y Publicación/posicionamiento. Una navegación interna enlaza a las secciones sin crear páginas sucesivas. Se conservan el formato de descripción, galería, imagen principal, subida existente, precios propios, costo autorizado, promoción, opciones de visibilidad y SEO.

La galería conserva también el identificador de recurso `publicId`; editar otros datos no debe perderlo. El entorno sin subida de archivos informa la alternativa por URL sin exponer instrucciones sobre secretos dentro del flujo operativo. No se subieron archivos reales a proveedores.

Los stocks existentes son de solo lectura y no se envían al guardar. Las presentaciones nuevas pueden declarar stock inicial entero no negativo. Se validan nombre/categoría/precio mediante formulario/modelo, SKU obligatorio y único, combinaciones activas repetidas, referencias de variante repetidas, imágenes y pertenencia de la principal a la galería.

Las variantes omitidas o desactivadas conservan ID y unidades. «Desactivar variante» no la borra físicamente. Las existentes se actualizan por ID y las nuevas reciben otro ID, sin reemplazar referencias previas. Se permite corregir SKU; no se reescribe el SKU de los pedidos históricos.

Los errores de carga impiden mostrar un formulario vacío como si fuera un producto cargado. Existen recuperación, error de guardado y bloqueo síncrono del envío. Un guardado devuelve a filtros/página anteriores. La edición de variantes con cantidades históricas inválidas exige revisión antes de guardar: no se usa el editor para normalizarlas silenciosamente.

## 10. Protección de productos e historia

DELETE se conserva por compatibilidad, pero realiza **desactivación lógica**, no eliminación física. El producto, sus variantes, cantidades, imágenes y referencias permanecen. Se registra el cambio de publicación, sin inventar un retiro de todas sus unidades. La interfaz utiliza «Desactivar publicación» y confirmación explícita.

Cuando hay un pedido abierto que aún depende de aplicar inventario, se rechaza la desactivación del producto o de su variante. Esto protege, entre otros, pedidos Wompi pendientes. Para un pedido cuyo stock ya se aplicó, se preservan referencias y la operación de preparación puede continuar; una cancelación puede restaurar unidades incluso si la variante está inactiva.

No se modificaron pedidos para adaptarlos al producto. Los snapshots de nombre, precio, SKU, dirección y pago mantienen su significado. Registros que ya se hubieran eliminado antes de esta fase no se recrean; sus movimientos conservan la evidencia existente.

La validación de SKU entre productos se ejecuta dentro de las escrituras administrativas serializadas por `CatalogWriteGuard`, una colección pequeña con su `_id` único. Evita la carrera de dos altas/ediciones que reclamen el mismo SKU sin crear un índice nuevo sobre datos históricos. Las ventas y ajustes no toman ese control de metadatos; conservan sus transacciones sobre el producto.

Esta garantía cubre las escrituras por los controladores protegidos. Importaciones o escrituras directas que los eludan deben validar sus propias invariantes. No se habilitó un proceso de carga masiva ni se ejecutó una migración destructiva.

## 11. Roles y permisos

| Actor | Consulta | Escritura |
|---|---|---|
| Administrador / superadministrador | Productos, presentaciones, costos autorizados, movimientos y resultado de sus ajustes. | Crear/editar, publicar/desactivar y ajustar mediante endpoints protegidos. |
| Vendedor | Productos y variantes con precios de venta/existencias autorizadas, sin costos internos ni márgenes. | Sin altas, edición, cambios de precio, ajustes, borrado o consulta administrativa de movimientos/recuperación. |
| Cliente / anónimo | Sin acceso al catálogo administrativo ni al historial. | Sin acceso. |

Se preservan los roles de las fases anteriores y su validación backend. Ocultar controles no es la medida de autorización: las pruebas HTTP comprueban 403/401 en las rutas restringidas. Los costos se excluyen de la consulta agregada del vendedor y del DTO.

## 12. Integración con pedidos y fases anteriores

`inventoryService.moveStock`, checkout, Wompi, transiciones, finanzas y entrega de notificaciones permanecen sin modificaciones. El ajuste continúa moviendo exclusivamente inventario relativo; no confirma pagos ni cambia estados de pedido.

Las pruebas verifican venta concurrente con ajuste, venta mientras el editor estaba abierto y edición simultánea con compra. El saldo coincide con el historial, el stock absoluto del formulario no repone unidades vendidas y el ID sigue estable. Una cancelación conserva la restauración sobre la variante original.

El guardado de productos y la consulta del catálogo no publican correos ni alteran pedidos. Las pruebas de contraentrega, aprobación/rechazo Wompi, incidencias, recaudo y comunicaciones siguen pasando. La entrega externa no se activó.

El posible recorrido de colección de las bandejas de pedidos señalado en el cierre de Fase 3 se conserva como pendiente posterior. No se optimizó `orderWorkspace`, no se rediseñó su dashboard y no se modificó la arquitectura de Fase 2.

## 13. Archivos modificados y nuevos

Rutas relativas a la raíz `dizor`:

| Archivos | Responsabilidad |
|---|---|
| `backend/src/services/catalogWorkspace.js` (nuevo) | Consulta paginada, filtros, DTO y formato administrativo sin fabricar defaults históricos. |
| `backend/src/services/inventoryCriteria.js` (nuevo) | Clasificación/umbral común y agregaciones de alertas. |
| `backend/src/services/catalogMutationService.js` (nuevo) | Exclusión transaccional de metadatos para comprobar SKU concurrentemente. |
| `backend/src/models/stockAdjustment.js` (nuevo) | Intención persistida, estado aplicado/rechazado y protección frente a peticiones tardías. |
| `backend/src/controllers/productAdminController.js` | Consulta común, validaciones, guardado/historial transaccional, desactivación y recuperación del ajuste. |
| `backend/src/controllers/productHistoryAdminController.js` | Filtros, actor, variantes, fechas colombianas y tipos históricos. |
| `backend/src/controllers/adminAlertController.js` | Reutiliza únicamente la clasificación de inventario; otros bloques conservados. |
| `backend/src/services/productHistoryService.js` | Permite registrar metadatos y stocks iniciales en la misma sesión de producto. |
| `backend/src/models/product.js` | Talla/color opcionales, sin cambiar IDs, índices o reglas de stock. |
| `backend/src/routes/adminCatalogRoutes.js` | GET de recuperación, reservado a administradores. |
| `backend/package.json` | `test:phase4`, sin nuevas dependencias. |
| `frontend/src/components/admin/CatalogWorkspace.jsx`, `CatalogWorkspace.module.css` (nuevos) | Productos/Existencias, filtros, variantes y acciones contextuales. |
| `frontend/src/components/admin/QuickStockAdjustment.jsx` (nuevo) | Ajuste compacto, confirmación, bloqueo inmediato y recuperación persistida. |
| `frontend/src/components/admin/ProductEditor.jsx` (nuevo) | Regreso seguro a contexto y frontera de carga de parámetros. |
| `frontend/src/components/admin/ProductForm.jsx` | Organización, datos opcionales, galería conservada y stock protegido. |
| `frontend/src/components/admin/ProductHistoryList.jsx` | Movimientos integrados con filtros URL, estados y exportación. |
| `frontend/src/components/admin/AlertBell.jsx`, `frontend/src/app/admin/alertas/page.js` | Enlaces a variante y aviso de cantidades por revisar. |
| `frontend/src/app/admin/productos/page.js`, `productos/nuevo/page.js`, `productos/[id]/editar/page.js`, `inventario/page.js` | Integración manteniendo rutas. |
| `frontend/src/services/adminCatalogService.js`, `frontend/src/lib/catalogWorkspace.js` (este último nuevo) | Consulta de operación, resumen paginado y etiquetas/enlaces internos. |
| `frontend/src/styles/pages/admin-products.css` | Adaptación acotada del editor y foco. |
| `backend/test/phase4.test.js`, `frontend/test/catalog-workspace-browser.cjs` (nuevos) | Pruebas funcionales, concurrentes, volumen y recorridos de React. |
| `docs/auditoria-admin/fase4-evidencias/` (nuevo) | Registros, capturas, scripts y planes reproducibles. |

No se editaron el catálogo público, detalle público, reseñas, checkout visual, menú general, esquema `ProductHistory` ni pruebas anteriores. Los índices históricos no cambiaron.

## 14. Pruebas ejecutadas y cobertura

Reproducción y archivos de evidencia en [fase4-evidencias/README.md](fase4-evidencias/README.md). Se utilizó Node v24.15.0 y MongoDB 8.3.2 en replica set efímero de localhost. Datos `.test`, proveedores simulados, sin `.env` y con red externa bloqueada.

El resumen verificable está en [resultados-finales.json](fase4-evidencias/resultados-finales.json). [manifest-sha256.json](fase4-evidencias/manifest-sha256.json) registra las huellas del código, informe y evidencias finales, además de comprobar archivos protegidos contra la versión base.

| Cobertura solicitada | Pruebas |
|---|---|
| 1–7: paginación, búsqueda y filtros | V01–V06, V31; C01–C03 |
| 8–11: varias variantes, mezcla de stock, inactivas y sin disponibles | V06–V08, V30; C04, C15 |
| 12–19: ajustes positivo/negativo, fracciones, negativos, doble clic, clave estable y concurrencia | V09–V15, V33–V35; cuatro pruebas originales y C05–C10 |
| 20–22: edición concurrente, nuevas presentaciones, SKU duplicado | V16–V22, V40; C03 |
| 23–25: historial, filtros y responsable | V23–V24, V37–V38; C11, C14 |
| 26–28: referencias de pedidos, Wompi y desactivación | V25–V27, V40 |
| 29–30: roles y vendedor | V28–V29; C15 |
| 31–32: alertas y coherencia de saldo/movimientos | V14–V15, V24, V30–V32 |
| 33–35: carga, vacíos y errores | C10, C12–C14, C17 |
| 36: teclado/accesibilidad básica | C04–C05, C18 |
| 37–40: escritorio, tablet, 390 y 360 px | C01, C04, C11, C19–C20 y capturas |
| 41: regreso a filtros | C02–C03 |
| 42–45: checkout, Wompi, contraentrega y comunicaciones | V19, V25–V27, V41 y regresión íntegra de fases anteriores |

Pruebas adicionales: protección de tipos históricos, imágenes/precios inválidos, IDs repetidos, cantidades ausentes, resultado actual distinto del resultado original del ajuste, rechazo final persistido y rollback ante fallo de historial.

Se conservan las aserciones anteriores. El desvío de evidencias redirige solo sus JSON generados hacia esta carpeta; no reescribe pruebas, datos históricos ni informes previos.

## 15. Resultados de regresión, rendimiento y estática

| Suite | Resultado |
|---|---|
| Fases 1–3 y compatibilidad anterior | **162/162 aprobadas** |
| Seis independientes del cierre Fase 3 | **6/6 aprobadas** |
| Fase 4 V01–V42 | **42/42 aprobadas** |
| **Total Node** | **210 aprobadas, 0 fallidas, 0 omitidas** |
| Navegador C01–C20 | **20 aprobadas**, sin errores de página ni solicitudes externas observadas |
| Sintaxis Node | **15 archivos, 0 fallos**; JSX/módulos frontend comprobados además por ESLint/build |
| ESLint frontend intervenido | **3 errores y 1 advertencia, todos previos**, frente a 5 errores y 2 advertencias de la base; sin diagnósticos nuevos |
| ESLint Node explícito | **0 errores, 1 advertencia previa**, frente a 2 advertencias de la base |
| Build local aislado | **Salida 0**, Next.js con webpack, sin `.env`, credenciales heredadas ni red fetch/TCP |
| `git diff --check` | Sin errores de espacios |

V42 prepara **1.201 productos y 3.601 variantes**, consulta una página de **20 filas**, con **400 coincidencias**, y guarda tiempo HTTP y `explain("executionStats")` del pipeline en [rendimiento.json](fase4-evidencias/rendimiento.json). El explain no incluye el populate posterior; el tiempo HTTP sí incluye el endpoint completo. No se añadieron índices para favorecer la medición.

El filtro por categoría puede aprovechar el índice compuesto ya existente. La búsqueda literal no anclada y el cálculo de estado siguen examinando candidatos; la paginación limita la transferencia, no garantiza costo constante para todo filtro. Los planes y tiempos son de datos ficticios locales y no certifican producción. No se optimizaron las consultas de pedidos de Fase 3.

## 16. Capturas y revisión visual

Se probaron en Chrome los componentes reales de Catálogo, ajuste rápido, editor, historial y shell. Los servicios se sustituyen por una API HTTP ficticia y la navegación por un adaptador History API. Las rutas reales de backend se prueban por HTTP en las suites MongoDB; no se afirma una sesión integral autenticada de Next con backend real.

| Vista | Escritorio | Tablet 820 px | Móvil 390 px | Móvil 360 px |
|---|---|---|---|---|
| Productos | [Captura](fase4-evidencias/productos-escritorio.png) | [Captura](fase4-evidencias/productos-tablet.png) | [Captura](fase4-evidencias/productos-movil.png) | [Captura](fase4-evidencias/productos-movil-360.png) |
| Existencias | [Captura](fase4-evidencias/existencias-escritorio.png) | [Captura](fase4-evidencias/existencias-tablet.png) | [Captura](fase4-evidencias/existencias-movil.png) | [Captura](fase4-evidencias/existencias-movil-360.png) |
| Movimientos | [Captura](fase4-evidencias/movimientos-escritorio.png) | [Captura](fase4-evidencias/movimientos-tablet.png) | [Captura](fase4-evidencias/movimientos-movil.png) | [Captura](fase4-evidencias/movimientos-movil-360.png) |
| Editor | [Captura](fase4-evidencias/formulario-escritorio.png) | [Captura](fase4-evidencias/formulario-tablet.png) | [Captura](fase4-evidencias/formulario-movil.png) | [Captura](fase4-evidencias/formulario-movil-360.png) |

Las capturas se revisaron visualmente. Se midió ausencia de desbordamiento horizontal en los anchos probados y se comprobaron foco de confirmación, foco en variante contextual, etiquetas, carga, errores y acciones bloqueadas. El estado tiene texto, no depende solo del color. No se realizó una certificación WCAG ni un recorrido con lector de pantalla.

## 17. Problemas encontrados y corregidos

1. Límite operativo de 100 y descarga redundante: consulta única paginada con búsqueda/filtros del servidor (**ADM-31**).
2. Stock global que ocultaba presentaciones agotadas: criterio compartido por variante y prioridad explícita (**ADM-18**).
3. Ajuste dentro de un editor extenso: panel contextual con delta, previsión, motivo y confirmación (**ADM-29**).
4. Respuesta perdida sin recuperación persistida: clave conservada al navegar, consulta de resultado y rechazo final que impide aplicación tardía (**ADM-07/19**).
5. Borrado físico: desactivación lógica, preservación de IDs y control de dependencias abiertas (**ADM-31**).
6. Carrera de unicidad de SKU: comprobación dentro de escrituras de metadatos serializadas, sin migrar índices históricos.
7. Historia de altas/nuevas cantidades fuera de la transacción: ahora se confirma junto al producto; un fallo revierte la operación (**ADM-07**).
8. Defaults de Mongoose que podían aparentar cero en un stock histórico ausente: lectura administrativa sin fabricar ese dato y rechazo de su ajuste ordinario (**ADM-19**).
9. Selectores que podían perder visualmente el filtro mientras llegaban opciones: controles con estado local y reinicio por URL, sin perder el filtro aplicado.
10. Errores convertidos en listas vacías o formularios incompletos: avisos con recuperación y diferenciación de estados.
11. Identificador de recurso de galería perdido en el payload: se conserva `publicId` sin operaciones reales en el proveedor.

Se mantienen tres errores previos de frontend: `react-hooks/set-state-in-effect` en AlertBell y Alertas, y `react-hooks/purity` por `Date.now` en Alertas. La advertencia de imagen de ProductForm ya existía. Backend mantiene `no-unused-vars` por `fmt` en el controlador de historial. Los archivos nuevos no introducen diagnósticos; no se presenta el lint global como limpio.

Backend no tiene configuración ESLint propia. Las reglas explícitas aplicadas son `no-unreachable`, `no-dupe-keys` y `no-unused-vars`. No se suprimieron reglas para ocultar fallos.

## 18. Limitaciones y pendientes

No se identificaron defectos funcionales pendientes en la cobertura final. Falta la auditoría independiente de esta fase.

Los stocks históricos inválidos requieren un procedimiento autorizado de conciliación; no se corrigieron como efecto secundario. Las referencias que se hubieran borrado antes de esta fase no pueden reconstruirse sin evidencia. La protección de desactivación comprueba dependencias abiertas en la transacción; no reemplaza las verificaciones posteriores de pago/inventario de Fase 1 ni ejecuta una reparación de checkouts previos.

La recuperación del panel persiste por sesión y actor; si el navegador impide almacenamiento, la clave se conserva en memoria mientras el componente esté abierto. El servidor sigue conservando la evidencia y rechazando reutilizaciones incompatibles. No se implementó una sincronización de borradores entre dispositivos ni una política de retención/borrado de intenciones.

Las opciones abreviadas del historial y la exportación mantienen sus límites documentados. No hubo benchmark productivo, prueba exhaustiva de todos los navegadores, lector de pantalla ni prueba real de Cloudinary. La subida existente se conservó, pero no se enviaron imágenes reales al proveedor.

Pendientes externos de Fases 1–2, **distintos de defectos funcionales locales de Fase 4**: infraestructura transaccional e índice histórico de idempotencia, aceptación/entrega real de Resend y enlaces Wompi autorizados. No se validaron ni se actuó sobre ellos. Se mantienen las observaciones bajas de cierres anteriores —incluido el costo potencial de las bandejas de pedidos— sin presentarlas como corregidas aquí.

Las dos colecciones nuevas utilizan únicamente su `_id` único en las pruebas; no hubo cambios de índices históricos ni migraciones reales. Un eventual índice de SKU/búsqueda deberá evaluarse en una copia autorizada, revisar duplicados y compatibilidad y demostrar beneficio con explain antes de proponerlo. No se ejecutó ese procedimiento.

## 19. Recomendaciones para Fase 5

Reorganizar el menú general reutilizando esta experiencia como destino de Productos/Existencias/Movimientos y manteniendo las rutas históricas. Conservar enlaces contextuales por producto/variante y regresos con filtros al ajustar la navegación.

Tratar por separado los pendientes de rendimiento de pedidos y los planes de búsqueda de catálogo; no introducir índices o migraciones como efecto de un cambio de menú. Mantener la protección de roles, los estados de error reales y las regresiones de idempotencia al consolidar componentes.

No se comenzó la Fase 5. El alcance entregado corresponde a Productos e inventario de Fase 4.
