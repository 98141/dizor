# Informe Sprint 07 — Finanzas

Dirección visual: **Operativo Premium Híbrido**. El diagnóstico previo está en `SPRINT_07_DIAGNOSTICO_FINANZAS.md`.

No hubo commit, push, cambio de `.env`, base real, correo, pago, migración, índice ni escritura de inventario.

## 1. Diagnóstico inicial

Finanzas vive en `/admin/finanzas` y solo la abre el superadministrador, en la ruta y en `RoleRoute`. El cálculo está en `financeService.js`. La venta conciliada es una sola: `reconciledSalesFilter`. La fecha es el día civil de `America/Bogota` (`financePeriod.js`, corrección F7-01).

El defecto de lectura no estaba en qué pedidos entran. Estaba en el margen. Si una línea no tiene costo, su ingreso igual se restaba contra un COGS que no la incluía. El resultado podía mostrarse como ganancia y, si no había ningún costo, como margen del 100 %. En el ranking por producto, el costo ausente se sumaba como cero (`unitCost || 0`).

## 2. Matriz de métricas y fórmulas

La matriz completa, con fuente, fecha, exclusiones y limitación, está en el diagnóstico. Resumen de lo que el panel muestra ahora:

| Lo que se lee | Qué es |
| --- | --- |
| Ventas conciliadas | Suma de `Order.total` del filtro conciliado. No cambia. |
| Pedidos y unidades | Conteo de esos pedidos y de sus cantidades. |
| COGS conocidos | `unitCost` de la línea si existe; si no, `internalCost` actual. Un `0` guardado cuenta. Un `null` no cuenta. |
| Ganancia verificable | Solo líneas con costo. Si falta alguno, el rótulo pasa a «Rentabilidad pendiente de completar costos» o a «Ganancia sobre costos conocidos» con el porcentaje de cobertura. |
| Margen histórico | Sigue calculándose como antes (`grossProfit` / ingreso de productos) y sigue en el JSON. La interfaz no lo presenta como margen confirmado cuando `marginReliable` es falso. |
| Por cobrar | Pedidos pendientes. No entra en ventas ni en el gráfico de métodos. |
| Valor a costo | Stock de variantes activas por costo registrado. El stock sin costo no vale cero. |
| Valor potencial | Ese mismo stock por el precio actual, incluidos productos no publicados. No es una venta. |
| Ganancia potencial | Solo la parte con costo conocido. |

## 3. Origen de las cifras de las capturas

No se abrió la base real. La fórmula sí explica una existencia muy alta:

- Cada variante con `isActive !== false` suma su `stock` una vez. No hay una segunda suma por producto.
- Entran productos despublicados. No entra una variante inactiva.
- Un solo `stock` entero, multiplicado por el precio de catálogo, produce un «valor potencial» de decenas de miles de millones. Es precio por existencia, no caja y no una venta duplicada.
- El panel ahora lista los cinco productos que más unidades aportan, con «Sin costo» cuando el costo no existe. 140.098 unidades y `$ 31.522.050.000` caben en la tarjeta sin recortar el indicador principal.

No se modificó ninguna existencia.

## 4. Costos faltantes

Cuatro casos, ya separados en el código y ahora también en la pantalla:

- Costo de la venta (`item.unitCost`), incluido cero: se usa ese y no el costo actual.
- Costo actual de respaldo, solo si la línea no guardó costo.
- Cero guardado: costo real. El margen puede ser 100 % y se muestra, porque el costo existe.
- Campo ausente o `null`: no es cero. El producto queda «Sin costo», el periodo queda «No verificable» y no entra al top de ganancia.

## 5. Inventario elevado

`potentialMarginReliable` es falso si hay productos sin costo. La ganancia potencial que se enseña es `potentialProfitKnown` (precio del stock que sí tiene costo, menos ese costo). El número antiguo `potentialProfit`, que trataba el stock sin costo como costo cero, permanece en el JSON para no redefinir el campo en silencio y no se usa como titular.

La frase bajo el bloque dice que el potencial incluye productos no publicados y que no es caja ni una venta.

## 6. Correcciones de presentación

- Seis indicadores arriba: ventas, pedidos, unidades, ganancia según cobertura, margen según cobertura, COGS.
- Ticket, envío, impuestos, descuentos y «por cobrar» quedan en texto secundario.
- El top por ganancia solo incluye productos con costo completo.
- El top por ingresos conserva el ingreso y escribe «Pendiente» donde falta el costo.
- El historial, si el periodo no tiene cobertura total, escribe «Pendiente ($ x con costo)» y «No verificable». No pinta la barra de ganancia de ese periodo.
- CSV, Excel y PDF añaden una fila o una línea «Limitación» cuando faltan costos. Las columnas numéricas anteriores no se borran.

`sales.grossProfit` y `sales.grossMarginPct` se calculan igual que antes. Cambiar su definición habría sido un cambio de política contable. La decisión queda documentada aquí para aprobación comercial si más adelante se quiere sustituir el número histórico.

## 7. Gráficas

Sin librería nueva. Una línea SVG de seis meses, con etiqueta corta (`sept 26`) y una tabla con las mismas cifras. La ganancia solo se traza en los meses con costos completos. Al lado, barras de ingreso, COGS conocido y ganancia según cobertura, con la advertencia si la comparación no está completa.

Los métodos de pago son una tabla de ventas ya conciliadas. Wompi y contraentrega aparecen solo si el pedido ya está pagado y conciliado. La contraentrega pendiente no se dibuja como dinero recibido.

No se añadieron gráficos de ticket ni de participación que repitieran las mismas cifras.

## 8. Panel

Título **Finanzas**. Subtítulo «Analiza ventas, costos y rentabilidad de tu tienda.» Periodos: Hoy, Últimos 7 días, Mes actual, Últimos 30 días, Trimestre, Año, Histórico y rango. Hoy y 30 días se agregaron en `parseFinancePeriod` sin mover los límites de F7-01. El rango sigue exigiendo las dos fechas civiles.

La pestaña activa va en la URL (`tab`).

## 9. Costos y precios

La tabla sigue con producto, stock, precio, costo, margen, valor de inventario y «Editar costo». Sin costo, el margen es «Sin costo», no un porcentaje. El promedio dice «solo con costo».

Filtros: Todos, Activos, Sin costo, Con costo, Margen bajo, más búsqueda por nombre o SKU. Margen bajo exige costo registrado y margen menor a 25 %. Un costo ausente no ordena ni filtra como cero: al ordenar por costo o por margen, los desconocidos quedan al final mediante una marca de orden que no se muestra como valor.

La edición sigue en la fila: «Guardar costo», «Cancelar edición» y el campo «Costo de compra (COP)». Guardar solo hace `$set` o `$unset` de `internalCost`. El stock no se escribe. No hay edición masiva.

## 10. Paginación

`GET /admin/finance/products?page=` filtra y ordena en Mongo y devuelve 10, 20 o 50. El tamaño distinto de esos tres responde 400. La página se ajusta a la última válida. Sin `page`, la respuesta anterior (catálogo completo) se mantiene para no romper un cliente viejo. La pantalla siempre pide página.

El total de la página es el filtro. El resumen de valor y de productos sin costo es el del catálogo, no el de la página.

## 11. Historial

Día, semana, mes y año, con desde/hasta cuando las dos fechas existen. Cada página trae 12 periodos. El gráfico y la tabla son esa misma página. El resumen de ingresos es el de toda la ventana, no solo la página.

La ventana por defecto sigue acotada (30 días, 84 días, 12 meses o 5 años). Un rango manual muy largo sigue agregándose en el servidor; el navegador no recibe la lista entera.

## 12. Exportaciones

Siguen CSV, XLSX y PDF, el mismo `buildFinanceReport` y el mismo filtro de la pantalla. No se inventó una exportación distinta. El Excel de inventario conserva el catálogo activo completo. El JSON del panel ya no envía ese catálogo entero: envía los 10 de mayor inversión y el conteo.

## 13. Backend modificado

- `backend/src/services/financePresentation.js` — cobertura, costo cero frente a costo ausente, paginación.
- `backend/src/services/financeService.js` — campos nuevos y ranking.
- `backend/src/controllers/financeAdminController.js` — listado paginado, historial paginado, panel sin catálogo completo.
- `backend/src/utils/financePeriod.js` — `today` y `days30`.
- `backend/src/utils/financeExport.js` — nota de limitación.
- `backend/test/sprint07-finance-integrity.test.js`.

No se tocó `reconciledSalesFilter`, ni pedidos, ni pagos, ni stock.

## 14. Frontend modificado

- `frontend/src/app/admin/finanzas/page.js`
- `frontend/src/components/admin/FinanceDashboard.jsx`
- `frontend/src/services/financeAdminService.js`
- `frontend/src/styles/pages/admin-finanzas.css`
- `frontend/test/sprint07-finanzas-browser.cjs`

## 15. Rendimiento

No se ejecutó un banco de 1.000 pedidos ni de 1.000 productos, y un tiempo local no se presentaría como producción. El listado de costos ya no viaja entero cuando la pantalla pide página. El panel deja de adjuntar `catalogSummary` completo. El historial que ve el navegador está paginado. Las seis consultas mensuales de la tendencia siguen igual que antes.

## 16. Permisos

La ruta sigue con `protect` y `authorizeRoles("superadmin")`. La página sigue en `RoleRoute` de superadministrador. No se abrió ningún campo de costo a otro rol. Ocultar el menú no es la protección: la denegación de la API ya existía y no se amplió.

## 17. Pruebas

`node --test backend/test/sprint07-finance-integrity.test.js`: 8/8.

Cubren costo ausente, costo cero, costo histórico por encima del actual, cobertura parcial, producto excluido del ranking, Hoy y 30 días en hora de Colombia, página inválida y una cifra de stock elevado.

Navegador aislado, sin red externa: `frontend/test/sprint07-finanzas-browser.cjs`.

| Comprobación | Resultado |
| --- | --- |
| F01 Panel con rentabilidad pendiente, 140.098 unidades y sin desborde a 1440, 1024, 820, 390 y 360 | ok |
| F02 Costos, «Editar costo», «Guardar costo» y paginación | ok |
| F03 Historial con «No verificable» y etiqueta corta | ok |
| ESLint de los archivos de interfaz tocados | ok |

## 18. Regresión

No se modificaron aserciones de fases anteriores. No se relanzó la suite Next + Mongo de la fase 7 ni P32. Esas pruebas siguen cubriendo el total conciliado y los límites de fecha. Este sprint no cambia `totalCollected` ni `parseFinancePeriod` para `month` y fechas civiles.

La pantalla conserva los textos que la regresión de pulido busca: «Finanzas», «Costos y precios», «Editar costo», «Guardar costo», «Cancelar edición», «Costo de compra (COP)», «Ingresa un valor válido», «Historial» y `#finance-history-from`.

## 19. Capturas

Después, en `evidencias-sprint-07/`:

- `panel-1440.png`, `panel-390.png`
- `costos-1440.png`, `costos-390.png`, `costo-edicion-1440.png`
- `historial-1440.png`, `historial-390.png`
- `navegador.json`

El antes de fase 6, si se compara, está en las capturas históricas de `finanzas-*.png` del cierre. No se rehicieron.

## 20. Limitaciones y riesgos

- `grossProfit` y `grossMarginPct` siguen en la API con la fórmula anterior. Quien lea el JSON crudo, y no la pantalla, puede seguir viendo un margen inflado. La pantalla y la nota de exportación avisan.
- El Excel de inventario sigue listando el catálogo activo completo, con ganancia potencial vacía cuando no hay costo.
- No hay benchmark de mil pedidos. No se afirma capacidad de producción.
- No se relanzó la suite con Mongo.
- Un rango histórico manual muy amplio sigue leyendo los pedidos de ese rango en el servidor.
- La política de sustituir el margen histórico por el margen solo-conocido, dentro del propio número exportado, queda pendiente de una decisión comercial. Este sprint no la tomó.

## 21. Recomendaciones

1. Correr la suite de fase 7 y el flujo de navegación del superadministrador antes de la auditoría, sin cambiar P32 ni las fechas F7-01.
2. Si el negocio quiere que CSV y PDF dejen de imprimir el margen inflado y pasen a imprimir solo `knownProfit`, hay que aprobarlo como cambio de política y actualizar a quien lea esas columnas por posición.
3. Una existencia de decenas o cientos de miles de unidades merece revisión humana en el catálogo. El panel ya señala al producto. No debe corregirse con una consulta de finanzas.
