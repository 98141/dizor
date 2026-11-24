# Sprint 07 — Diagnóstico de Finanzas

Fecha de lectura del código: 24 de noviembre de 2026. No se consultó ninguna base real. Las cifras de las capturas (141.452 unidades, más de $31.000 millones, 36 productos sin costo) no se dan por falsas: se explica la fórmula que puede producirlas.

## Rutas y archivos reales

| Pieza | Ruta |
| --- | --- |
| Página | `frontend/src/app/admin/finanzas/page.js` |
| Panel | `frontend/src/components/admin/FinanceDashboard.jsx` |
| Cliente HTTP | `frontend/src/services/financeAdminService.js` |
| Estilos | `frontend/src/styles/pages/admin-finanzas.css` |
| API | `backend/src/routes/adminFinanceRoutes.js` montada como finanzas de superadministrador |
| Controlador | `backend/src/controllers/financeAdminController.js` |
| Cálculo | `backend/src/services/financeService.js` |
| Conciliación | `backend/src/services/financeCriteria.js` → `reconciledSalesFilter` |
| Fechas F7-01 | `backend/src/utils/financePeriod.js` |
| Exportación | `backend/src/utils/financeExport.js` (CSV, XLSX, PDF) |
| Costo de catálogo | `Product.internalCost` (`select: false`) |
| Costo de la venta | `order.items[].unitCost` |
| Permiso | `protect` + `authorizeRoles("superadmin")` en todas las rutas de este router |

Endpoints vigentes: `GET /report`, `GET /overview` (alias), `GET /history`, `GET /products`, `PATCH /products/:id/cost`, `GET /export/csv|xlsx|pdf`.

## Criterio de venta conciliada

`reconciledSalesFilter` exige, a la vez:

- `paymentStatus: "pagado"`
- `orderStatus` distinto de `cancelado`, `rechazado` y `devuelto`
- `requiresReview` distinto de `true`
- ningún incidente con `resolvedAt: null` (también cubre el legado sin fecha de resolución)

Un pago recibido no basta. Contraentrega pendiente (`paymentStatus: "pendiente"`) cae en `pending`, no en ventas. No existe una segunda definición en el dashboard: `dashboardAnalytics.js` importa el mismo filtro. La fecha contable es `createdAt`, en día civil de `America/Bogota` (F7-01). El host en UTC o Tokio no desplaza el límite: la prueba de fase 7 fija `2026-11-20` → `2026-11-20T05:00:00.000Z` hasta `2026-11-21T04:59:59.999Z`.

Periodos que el backend ya calcula: `week` (7 días), `month` (por defecto), `quarter`, `year`, `all`, y rango `from`/`to`. No existían «Hoy» ni «Últimos 30 días» como claves propias; el mes actual no es lo mismo que 30 días.

## Matriz de métricas

| Métrica | Fuente | Fórmula actual | Fecha | Exclusiones | Limitación | Verificación |
| --- | --- | --- | --- | --- | --- | --- |
| Total cobrado | `Order.total` de ventas conciliadas | Suma | `createdAt` civil CO | El filtro conciliado | Incluye envío, impuesto y descuento ya aplicados al total | P32 de fase 1 compara el total antes/después de incidencia y cancelación |
| Pedidos conciliados | Conteo de esos pedidos | `length` | La misma | Las mismas | — | Mismo informe |
| Ingresos por productos | `item.lineTotal`, o `unitPrice * quantity` | Suma de líneas | La del pedido | Las mismas | No es el total del pedido | Código de `computeOrderEconomics` |
| Unidades vendidas | `item.quantity` | Suma | La misma | Las mismas | — | Código |
| COGS | `item.unitCost` si existe; si no, `Product.internalCost` | Suma `costo * cantidad` solo cuando el costo no es `null` | Costo histórico de la línea, si se guardó | Costo ausente no entra | Un costo `0` sí entra: `!= null` | Código; no hay prueba que distinga 0 de ausente |
| Ganancia bruta | Ingreso de productos − COGS | Incluye en el ingreso las líneas sin costo | La misma | — | Si falta el costo, esa línea aporta el 100 % de su ingreso a la ganancia | Presentación engañosa. El número se conserva en la API |
| Margen bruto % | Ganancia / ingreso de productos | `0` si no hay ingreso | La misma | — | Con todo el costo ausente el margen sale 100 | Hay que dejar de mostrarlo como verificado |
| Ticket promedio | Total cobrado / pedidos | `0` si no hay pedidos | La misma | — | Usa el total del pedido, no el ingreso de producto | Código |
| Por cobrar | Pedidos `pendiente` no cancelados ni rechazados | Suma de `total` | La misma ventana | No exige el resto del filtro conciliado | No es dinero recibido | Se muestra aparte |
| Métodos de pago | Agregado sobre el filtro conciliado | Conteo y suma de `total` | La misma | Pendientes | No separa «método» de «recaudado»; al estar conciliado, ya está pagado | Código |
| Tendencia 6 meses | Seis consultas, una por mes civil | Ingreso de producto y ganancia bruta del mes | `financeMonthBounds` | El filtro conciliado | La ganancia del mes arrastra el mismo hueco de costos. Etiqueta `mes año` larga | Código |
| Historial | Pedidos conciliados agrupados por día, semana, mes o año | Misma ganancia (ingreso de línea − COGS conocido) | Clave civil CO | Ventana por defecto: 30 días, 84 días, 12 meses o 5 años | Un rango manual puede ser largo. El margen del periodo también se infla | Código |
| Valor a costo | Variantes con `isActive !== false`, de todos los productos | `internalCost * stock` solo si el costo del producto no es `null` | Costo actual del catálogo | Variante inactiva | No es caja ni una compra realizada | Código |
| Valor potencial de venta | Las mismas variantes | `precio de variante o precio efectivo * stock` | Precio actual | Variante inactiva | Incluye productos no publicados. No es una venta | Código |
| Ganancia potencial | Potencial − inversión | El stock sin costo entra con costo 0 | — | — | Se lee como utilidad confirmada | Presentación engañosa |
| Margen de catálogo | `(precio − costo) / precio` | `null` si no hay costo | Costo y precio actuales | — | El listado de costos ya distingue «Sin costo». El promedio solo promedia quien tiene costo, pero el rótulo no lo dice | Código de `getFinanceProducts` |
| Top por ganancia | Mapa por producto | `costo ausente` se suma como 0 (`unitCost \|\| 0`) | Costo de la línea o el actual | — | Un producto sin costo queda con margen 100 y sube en el ranking | Defecto de presentación |
| Mayor inversión | `catalogSummary` de productos activos, ordenado por inversión | Toda la lista | — | Inactivos de catálogo salen de esta tabla, no del total de unidades | La tabla puede ser el catálogo entero. Un costo ausente ordena como inversión 0 | Código |

## Costos: cuatro casos que el código ya separa, y uno que no

| Caso | Cómo se reconoce | Efecto en COGS | Efecto visible hoy |
| --- | --- | --- | --- |
| Costo histórico de la venta | `item.unitCost` numérico, incluido `0` | Se usa ese valor y no el costo actual | Correcto |
| Costo actual de respaldo | Línea sin `unitCost` y producto con `internalCost` | Se usa el costo actual | El informe lo declara en una nota. No se reescribe la línea |
| Costo legítimo `0` | `internalCost === 0` o `unitCost === 0` | Entra como cero real | El margen es 100 % y, en este caso, es coherente |
| Costo no registrado | Campo ausente o `null` | La línea no suma COGS | El ingreso sí suma ganancia: el margen del periodo puede mostrar 100 % |
| Costo desconocido en el ranking de producto | El mismo `null` | `row.cost += 0` | El top de ganancia lo trata como costo cero |

`getFinanceProducts` ya pone `marginPct: null` si no hay costo. El semáforo pinta «Sin costo». Esa pantalla no es la que fabrica el 100 %. Lo fabrican la ganancia del periodo, el historial y el top por ganancia.

Editar el costo hace `$set` o `$unset` de `internalCost`. No toca `variants.stock`. Un valor negativo responde 400.

## Inventario elevado

El total de unidades es la suma de `variant.stock` de cada variante cuyo `isActive` no es `false`. Se recorre cada variante una vez: no hay una segunda suma por producto. Entran productos despublicados (`isActive: false`). No entra el stock de una variante inactiva.

Un solo documento puede tener un stock entero muy alto (`Number.isSafeInteger`). 140.098 unidades en una variante, por un precio de catálogo, alcanzan para explicar decenas de miles de millones de «valor potencial». Eso es una simulación de precio por existencia, no una venta ni una duplicación detectada en la fórmula. Este sprint no corrige existencias.

`Math.round` y `Intl` de es-CO cubren esas magnitudes dentro de enteros seguros. El riesgo visual es una tarjeta o una etiqueta que no pueda partir la cifra.

## Listas, gráficas y periodos

- Costos descarga el catálogo completo y filtra en el navegador. No hay página.
- El historial devuelve todos los periodos con ventas de la ventana. La ventana por defecto está acotada; un rango manual no lo está en número de filas.
- Las barras usan la ganancia como escala máxima, así que el ingreso puede pintar más del 100 % del alto. La etiqueta mensual es `nov 2026` o más larga y se corta.
- El panel no ofrece Hoy, Últimos 30 días ni rango en la interfaz, aunque el rango ya existe en `parseFinancePeriod`.

## Qué no se va a cambiar

- `reconciledSalesFilter`
- Los límites civiles de F7-01
- El significado de `sales.grossProfit` y `sales.grossMarginPct` en el JSON (siguen calculándose igual para no redefinir la política en silencio)
- Estados de pedido, pagos, Wompi, inventario y costos históricos
- Permiso de superadministrador
- CSV, XLSX y PDF como formatos ya implementados

## Qué sí se va a cambiar en la presentación

Campos nuevos, sin sustituir los anteriores: cobertura de costos, ganancia solo sobre líneas con costo, margen verificable, estado `complete | partial | pending | empty`, y el mismo criterio en historial y tendencia. La interfaz deja de mostrar el porcentaje heredado como rentabilidad confirmada cuando la cobertura no es total. El archivo de exportación gana una nota de la misma limitación. El ranking de ganancia deja fuera al producto con costo incompleto. La valoración potencial distinguirá la parte con costo conocido. Costos se pagina en el servidor. El historial se pagina sin pedir periodos ilimitados al navegador.
