# Informe Sprint 03 — Productos, existencias, movimientos y catálogo

Rediseño de presentación Operativo Premium Híbrido para las cuatro pantallas del módulo Productos. La lógica de inventario, el formulario completo de edición y el resto del administrador quedan fuera.

Fecha de verificación: 24 de noviembre de 2026. Datos ficticios. Sin base real, sin pagos, sin correos y sin despliegue.

## 1. Diagnóstico de las cuatro pantallas

El módulo ya paginaba, filtraba, ajustaba stock con clave de operación y conservaba el historial. La presentación alargaba la página:

- Cada producto mostraba a la vez consultar variantes, editar, publicar, movimientos y vista pública.
- En Existencias todas las variantes nacían abiertas, con SKU, stock y botones de ajuste en cada una.
- En móvil eso se volvía una lista vertical muy larga.
- Movimientos repetía fecha, stock anterior, stock posterior, responsable y resumen en cada fila.
- Configuración del catálogo funcionaba, con el correctivo F6-I01 ya aplicado para que Editar y Eliminar no se recorten, pero el formulario y el listado no compartían la densidad del resto del rediseño.

No había capturas anteriores en el repositorio. La referencia es esa presentación plana.

## 2. Arquitectura visual aplicada

Se reutilizan los tokens ya definidos: grafito `#252725`, marfil `#F7F6F2`, blanco, dorado `#B87305`, arena `#F5C37B` y borde `#E8E4DB`.

Las clases `op-` viven en `admin-products.css`, la hoja que ya carga el layout de administración. No se copió el sistema `dz-` de Inicio ni el de Pedidos, para no tocar esos módulos. La bandeja activa usa borde dorado sobre fondo blanco. El grafito queda para la acción principal. Los estados de stock usan los mismos chips discretos: disponible, bajo, agotado, inactiva y revisión.

## 3. Cambios en Productos

Cabecera corta: **Productos** y el texto “Consulta el catálogo, su publicación y la disponibilidad.” A la derecha, Nuevo producto.

Cada registro muestra miniatura, nombre, categoría y tejido, precio, publicación, disponibilidad, número de variantes y unidades disponibles. Si hay existencias por revisar, se indica junto a esa cifra, sin sustituirla.

La acción principal sigue siendo **Consultar variantes y stock**, el texto que ya usan las pruebas y la navegación. Editar, movimientos, vista pública y desactivar publicación quedan en una fila secundaria. En móvil esa fila se abre con **Más opciones**. Desactivar publicación conserva la confirmación.

## 4. Cambios en Existencias

Esta es la pantalla que más se acortó. Cada producto llega contraído y muestra:

- imagen y nombre;
- variantes activas y unidades disponibles para venta (`availableStock` del backend);
- variantes agotadas, con stock bajo, por revisar e inactivas, solo cuando el conteo es mayor que cero;
- publicación;
- **Ver existencias**.

No se muestran SKU ni botones de ajuste hasta abrir el producto. Las cifras salen del resumen que ya calcula el backend. No se recalcula la disponibilidad en el navegador.

## 5. Comportamiento de variantes

Solo hay un producto abierto. Abrir otro cierra el anterior. El mismo botón vuelve a cerrarlo. El cambio se anuncia con `aria-expanded`, `aria-controls` y una región en vivo.

Si la URL trae `productId` y `variantId`, se abre solo ese producto, la variante recibe foco y queda marcada. El resto sigue cerrado. Un enlace de alerta no despliega el catálogo entero.

Dentro del producto se ven talla y color, SKU, stock, estado, **Ajustar existencias** cuando el backend lo permite, y el enlace a los movimientos de esa variante. Una variante en revisión no ofrece ajuste. Una inactiva se etiqueta “Inactiva”. Un stock no entero o ausente se etiqueta “Revisar existencias” y no se presenta como una cantidad vendible.

## 6. Ajuste contextual

Se conserva `QuickStockAdjustment`: la misma operación relativa, la misma clave, `sessionStorage` y los mismos textos de comprobación.

El panel muestra producto, variante, stock actual, agregar o retirar, cantidad, stock previsto, motivo y confirmación. Cantidades fraccionarias y saldos negativos siguen sin habilitar la confirmación. Un doble clic no crea una segunda operación. Si la respuesta se pierde, el panel no se da por cerrado: permanece “Comprobar resultado” y la misma clave. Un rechazo definitivo deja corregir la solicitud.

Al confirmar, la lista se actualiza sin perder los filtros ni el producto abierto.

## 7. Movimientos

En escritorio es una tabla de cuatro columnas: movimiento, cantidad con signo, fecha corta de Colombia y detalle. En anchos menores cada registro es una ficha con producto, tipo, cantidad, fecha y responsable.

**Ver detalle** abre SKU histórico, saldo anterior, saldo posterior, responsable, motivo, origen y la fecha completa. El resumen y el correo siguen visibles en la fila, porque el historial de auditoría no debe quedar escondido detrás de un clic para quien ya está leyendo el registro. La paginación y el PDF conservan el tope de 5.000. No se descarga el historial completo para pintarlo cerrado.

## 8. Configuración del catálogo

Categorías, colores, tallas, tejidos y estilos usan pestañas compactas. En escritorio el formulario y el listado siguen en dos columnas, alineados arriba, sin una franja vacía debajo del formulario. En móvil van uno bajo el otro.

Cada registro muestra nombre, estado, Editar y Eliminar. Los botones llevan nombre accesible con el registro (“Editar Sombreros de iraca”) y el texto visible sigue siendo Editar y Eliminar. La confirmación de borrado no cambió. No se reescriben datos históricos.

F6-I01 se mantiene: Editar y Eliminar quedan completos y dentro del ancho en 1440, 1100, 1024, 900, 390 y 360. No se volvió a imponer un `min-width` que los recorte.

## 9. Mejoras de filtros

Productos y Existencias: búsqueda, estado de existencias, Filtros y Aplicar filtros. Categoría, tejido y publicación están en el panel y se abren solos si la URL ya los trae. Limpiar filtros vuelve a la vista actual.

Movimientos: búsqueda, tipo de movimiento y Filtros. Producto, tipo histórico, responsable y fechas quedan en el panel. Hay aviso de filtros activos.

Un error de API sigue mostrando el mensaje de carga fallida y el reintento. No se sustituye por “No hay productos registrados”.

## 10. Experiencia responsive

Comprobado en 1440, 1024, 820, 390 y 360, sin desborde horizontal.

En móvil las secciones del módulo pasan a un selector (Productos, Existencias, Movimientos y Configuración del catálogo). En escritorio siguen siendo pestañas. Las rutas no cambian: `/admin/productos`, `view=stock`, `view=movements`, `/admin/inventario` y `/admin/catalogo`.

Las fichas de móvil enseñan primero el resumen. Las acciones secundarias no ocupan varias filas hasta que se piden.

## 11. Accesibilidad

Los controles de apertura anuncian estado con `aria-expanded` y `aria-controls`. La variante llegada desde una alerta es enfocable. El diálogo de ajuste mueve el foco al confirmar. Editar, Eliminar y Ajustar identifican el producto o la variante. El foco visible usa el dorado. El movimiento reducido no añade animaciones. No hay `overflow-x: hidden` global ni alturas fijas que corten el contenido.

## 12. Archivos modificados

- `frontend/src/components/admin/CatalogWorkspace.jsx`
- `frontend/src/components/admin/ProductHistoryList.jsx`
- `frontend/src/components/admin/QuickStockAdjustment.jsx`
- `frontend/src/components/admin/TaxonomyManager.jsx`
- `frontend/src/app/admin/catalogo/page.js`
- `frontend/src/styles/pages/admin-products.css`
- `frontend/test/sprint03-catalog-browser.cjs`
- `docs/auditoria-admin/rediseño-premium/evidencias-sprint-03/`

No se modificó backend, inventario, pagos, pedidos, Inicio, tienda pública, `.env` ni el formulario de edición más allá de dejarlo accesible desde la lista.

## 13. Pruebas ejecutadas

`frontend/test/sprint03-catalog-browser.cjs`, con Chrome y datos ficticios, sin red:

1. Productos compactos, sin SKU hasta abrirlos.
2. Existencias contraídas.
3. Apertura de un producto.
4. Cierre del mismo producto.
5. Acordeón móvil: abrir otro cierra el anterior.
6. Enlace con `productId` y `variantId`.
7. Foco en la variante.
8. Stock disponible, agotado, bajo y en revisión.
9. Variante inactiva.
10. Stock histórico inválido, mostrado como revisión.
11. Ajuste positivo.
12. Ajuste negativo.
13. Doble clic, una sola operación.
14. Respuesta perdida.
15. La clave de operación se conserva y se comprueba.
16. Historial y detalle expandible.
17. Filtros, URL y limpieza.
18. Vendedor sin publicar, sin costo interno y sin movimientos.
19. Foco de teclado.
20. 1440, 1024, 820, 390 y 360 sin desborde.
21. F6-I01 en 1440, 1100, 1024, 900, 390 y 360.

`frontend/test/catalog-workspace-browser.cjs`: las 20 comprobaciones C01–C20, incluida la edición que no altera el stock, la idempotencia del ajuste, el vendedor y el formulario.

## 14. Resultados

Las dos suites terminaron en verde, sin errores de página ni peticiones externas. ESLint de los archivos de este sprint: 0 errores.

## 15. Regresión

La regresión de catálogo cubre ajuste, doble clic, respuesta ambigua, rechazo, publicación, vendedor, paginación y el regreso desde el editor. No se modificaron esas pruebas para ocultar fallos.

Pedidos, pagos y notificaciones no se editaron en este sprint. Su suite no se volvió a ejecutar aquí. La suite completa de F6 con Next y una réplica de Mongo tampoco: el correctivo se comprobó con el mismo criterio de recorte (texto completo y botón dentro del ancho) sobre `TaxonomyManager` real y `admin-polish.css`.

## 16. Capturas

Después, en `docs/auditoria-admin/rediseño-premium/evidencias-sprint-03/`:

| Archivo | Qué muestra |
| --- | --- |
| `productos-escritorio.png` | Lista compacta, una acción principal |
| `productos-movil.png` y `productos-movil-360.png` | Ficha y Más opciones |
| `productos-filtros.png` | Panel avanzado |
| `existencias-contraidas.png` | Resúmenes, sin SKU |
| `existencias-expandido.png` | Un solo producto abierto |
| `existencias-movil.png` | Acordeón |
| `ajuste-abierto.png` | Panel de ajuste relativo |
| `movimientos-escritorio.png` | Tabla corta |
| `movimientos-movil.png` | Ficha y detalle |
| `configuracion-escritorio.png` | Formulario y listado en dos columnas |
| `configuracion-movil.png` | Filas con Editar y Eliminar |
| `resultado.json` | Comprobaciones del harness |

No hay capturas anteriores en el repositorio.

## 17. Problemas corregidos

- El botón Más opciones aparecía también en escritorio, porque la regla de los botones ganaba a `display: none`. En escritorio la fila secundaria queda visible y el botón solo existe en móvil.
- El selector de sección se veía debajo de las pestañas en escritorio. Quedó oculto desde 760 px.
- Un producto con stock por revisar perdía la cifra de unidades y solo decía “Existencias por revisar”. Ahora muestra variantes, unidades disponibles y el aviso de revisión por separado.
- La miniatura y el nombre comparten la primera línea. El precio y la acción principal no forman una pila de botones.

## 18. Limitaciones

- El formulario largo de alta y edición conserva su presentación. Solo se mantiene el enlace y el regreso.
- Inicio, Pedidos y la tienda pública no entran en este sprint.
- La suite F6 con Next y Mongo no se repitió. La comprobación de este sprint usa el componente y la hoja de estilos reales, en un navegador aislado.
- El punto en que la tabla de movimientos pasa a fichas depende del ancho del contenido (64 rem). Si el sidebar cambia, conviene mirar de nuevo 1024.

## 19. Recomendaciones para el siguiente módulo

Conviene seguir el mismo patrón: resumen visible, detalle bajo demanda y una sola acción primaria. Los textos que las pruebas ya pulsan (“Consultar variantes y stock”, “Ajustar existencias · SKU”, “Aplicar filtros”) deben permanecer, aunque el resto de la interfaz se compacte.

El siguiente rediseño no debería reabrir el cálculo de stock ni el formulario de producto entero hasta tener sus propias capturas. Si se toca el detalle de producto, el ajuste relativo tiene que seguir siendo el único camino para cambiar existencias.
