# Informe de correcciones — cierre local de Fase 1 DIZOR

Fecha: 20 de noviembre de 2026. Referencia: `INFORME_CIERRE_INDEPENDIENTE.md` y sus pruebas/evidencias originales.

**Estado funcional local: PASS para los dos defectos bloqueantes confirmados.** El reporte conciliado y la gráfica histórica aplican el mismo criterio financiero; el ajuste de stock no genera solicitudes distintas por un doble clic. Se aprobaron 57 pruebas originales, 5 pruebas de integración del cierre y 4 pruebas del componente: **66 aprobadas, 0 fallidas**. El build aislado compiló y lint no encontró errores nuevos.

Este cierre local no equivale a validar ni autorizar producción. No se realizó ninguna actividad de despliegue, migración ni comprobación de infraestructura productiva.

## 1. Causa raíz

### Defecto financiero — I16b

`getFinanceHistory`, consumido por `/admin/finance/history`, consultaba únicamente `paymentStatus=pagado` y fechas. El reporte, la tendencia mensual y el dashboard tenían copias de un filtro más restrictivo. Una corrección en esas copias no alcanzaba a la gráfica histórica.

La reproducción independiente insertaba un pedido válido de $80.000, uno cancelado de $50.000 y uno en revisión de $30.000. El reporte sumaba 1/$80.000; la gráfica sumaba 3/$160.000.

Además, la gráfica llamaba `totalRevenue` a la suma de líneas de producto, aunque el indicador `totalCollected` del reporte suma el total del pedido. Cuando hay impuestos o envío, esas magnitudes difieren incluso para las mismas ventas. La ganancia debe seguir calculándose sobre productos y costos, no sobre impuestos o envío.

### Ajuste duplicado — I19c

`handleStockAdjustment` leía `variant.adjustmentKey` del último render. Si no existía, creaba un UUID y llamaba a `setVariant` para guardarlo. Dos invocaciones antes del próximo render veían la misma ausencia y creaban dos UUID. El backend reconocía correctamente dos movimientos diferentes: su idempotencia no podía deducir que procedían de un doble clic.

El botón tampoco se deshabilitaba durante la petición y el formulario no mostraba un estado propio de procesamiento o éxito por variante.

## 2. Solución aplicada

### Definición financiera compartida

Se creó `financeCriteria.reconciledSalesFilter`. Lo usan el reporte conciliado, sus agregados por método, la tendencia mensual, el historial de la gráfica y el agregado de ingresos del dashboard. Las exportaciones CSV/XLSX/PDF siguen obteniendo su información del mismo `buildFinanceReport`.

El criterio exige pago registrado como `pagado`, excluye estados cancelado/rechazado/devuelto y `requiresReview=true`, y excluye incidencias activas. También cubre una incidencia no resuelta cuyo resumen `requiresReview` haya quedado en false. Un reembolso no satisface `paymentStatus=pagado`. Las incidencias con `resolvedAt` válido permiten volver a contar una venta cuando ya no hay revisión pendiente. Documentos históricos sin los campos nuevos siguen siendo consultables y elegibles si cumplen las reglas.

El historial suma `order.total` como ingreso total conciliado, conservando `onlineRevenue` como ingresos de productos. La ganancia y el margen usan la base de productos y costos, igual que el reporte. No se suman impuestos o envío como ganancia de productos.

No se cambian pedidos, pagos, fechas ni incidencias al consultar. Los cobros en disputa conservan sus documentos y evidencia financiera; quedan fuera de las ventas conciliadas. Una prueba compara los documentos antes/después y exige que permanezcan iguales.

### Protección síncrona del ajuste

Un `useRef` mantiene un mapa de operaciones por ID de variante. Antes de invocar el servicio se guarda sincrónicamente el bloqueo, la clave y una copia inmutable de cantidad/motivo. El segundo clic del mismo render encuentra la operación ocupada y termina sin emitir una petición.

- El estado React se usa para mostrar y deshabilitar controles; la exclusión inmediata depende del ref.
- El botón muestra `Registrando…` y queda deshabilitado mientras hay una solicitud.
- Se muestran mensajes por variante con `role=status` o `role=alert`.
- Un error de red o 5xx conserva clave y contenido para `Reintentar ajuste`; los campos quedan bloqueados para no convertir una respuesta ambigua en otra operación.
- Un rechazo de negocio explícito permite corregir la entrada. Una acción nueva, editada deliberadamente después del éxito, recibe una clave nueva.
- Tras el éxito se aplica el stock confirmado por el servidor, por ID de variante, y se limpian cantidad/motivo.
- Se conserva la marca de operación completada hasta una edición nueva: tampoco un manejador del render anterior puede volver a enviarla después de resolver la promesa y antes de repintar.
- Variantes distintas pueden ajustarse simultáneamente sin mezclar sus bloqueos, claves o resultados.

No se modificó el endpoint de ajustes ni su idempotencia transaccional existente.

## 3. Archivos modificados o añadidos

Aplicación, exclusivamente:

| Archivo | Cambio |
|---|---|
| `backend/src/services/financeCriteria.js` | Criterio central de venta conciliada. |
| `backend/src/services/financeService.js` | Reutilización del criterio en reporte y tendencia. |
| `backend/src/controllers/financeAdminController.js` | Historial con el criterio común y magnitudes coherentes. |
| `backend/src/controllers/dashboardAdminController.js` | Ingresos del dashboard con el mismo criterio. |
| `frontend/src/components/admin/ProductForm.jsx` | Exclusión síncrona, clave estable, controles ocupados y mensajes del ajuste. |

Pruebas y reproducción:

- `frontend/test/stock-adjustment.test.cjs`.
- `docs/auditoria-admin/cierre-fase1/correcciones-integracion.test.js`.
- `docs/auditoria-admin/cierre-fase1/correcciones-build.cjs`.
- Este informe y las evidencias nuevas con prefijo `correcciones-`.

No se editaron las 57 pruebas originales ni el código/evidencia original de la auditoría independiente. No se modificaron modelos, índices, controladores de inventario/pagos ni archivos de Home como parte de esta tarea. No se instalaron dependencias ni se crearon commits/pushes desde esta tarea.

## 4. Pruebas ejecutadas

| Verificación | Resultado | Evidencia |
|---|---|---|
| 57 regresiones originales de Fase 1 | 57 PASS, 0 fallos | `correcciones-fase1-57.txt` |
| Escenarios independientes pertinentes + regresión financiera ampliada | 5 pruebas PASS, 0 fallos | `correcciones-integracion.txt` |
| Componente real, doble invocación inmediata y reintentos | 4 PASS, 0 fallos | `correcciones-componente.txt` |
| Sintaxis JS de backend y arneses | 7 archivos, 0 errores | `correcciones-sintaxis.json` |
| Lint oficial de ProductForm y prueba de componente | Salida 0, 0 errores, 1 advertencia previa | `correcciones-eslint.json` y `correcciones-eslint-antes.json` |
| Lint Node con reglas explícitas | Salida 0, 0 errores, 1 advertencia previa | `correcciones-eslint-node.json` y `correcciones-eslint-node-antes.json` |
| Build aislado Next.js 16.2.6, webpack | Salida 0; compilación correcta y generación de rutas | `correcciones-build.txt` y `.json` |

Las pruebas de integración usaron MongoDB **8.3.2**, en un replica set temporal propio de 127.0.0.1. Variables ficticias y transporte de correo simulado antes de cargar la aplicación; sin `.env` ni red externa. El registro de hosts externos es `[]`.

### Reutilización de las pruebas independientes

Se ejecutaron, sin cambiar sus cuerpos ni sus condiciones:

- `scenarioFinanceGap`: I16/I16b. Resultado nuevo: reporte 1/$80.000 e historial 1/$80.000.
- `scenarioStockRaces`: I08/I08b/I08c. Ajustes y ventas concurrentes, una sola aplicación de la misma clave y rechazo al reutilizarla con otro contenido.
- `scenarioUiGuards`: I19/I19b/I19c. Confirma `adjustLocked=true` y stock absoluto de solo lectura.

El arnés nuevo carga el archivo original, omite su registro monolítico y expone esas funciones para ejecutarlas en tres pruebas separadas. No modifica el archivo original. No ejecuta `scenarioIndexesAndStandalone` ni `scenarioStandalone`, que son comprobaciones de índices/infraestructura ajenas a este encargo. Por tanto, **no se presenta esta ejecución como una repetición completa de las 38 comprobaciones independientes**.

La evidencia original conserva textos descriptivos del defecto aunque ahora su veredicto sea PASS. No se reescribieron esos textos para aparentar una prueba distinta. El resultado I19c también conserva `confirmLocked=false` y `statusLocked=false`: recaudo/cambio de estado no son el defecto de duplicación de stock solicitado y no se tocaron. El chequeo estático independiente no sustituye a las cuatro pruebas de comportamiento nuevas.

### Pruebas nuevas específicas

Las dos pruebas financieras adicionales insertan fixtures válidos, cancelados, devueltos, reembolsados, rechazados, pendientes, en revisión, con incidencia activa y con incidencia resuelta. Incluyen un documento histórico sin los campos nuevos y una incidencia activa sin `requiresReview=true`.

Con tres ventas elegibles, el delta es **3 pedidos/$240.000 conciliados** y **$220.000 de productos/$190.000 de ganancia**, igual en las superficies correspondientes. Una de esas ventas tiene $60.000 de productos más $15.000 de impuesto y $5.000 de envío: esos $20.000 no se convierten en ganancia de productos. Se comparan reporte, historial, dashboard, tendencia, conteos y totales por método; CSV y XLSX contienen únicamente las ventas elegibles. El endpoint PDF devuelve un PDF válido y obtiene el mismo reporte compartido; no se realizó una inspección visual del PDF.

Las cuatro pruebas del frontend compilan y ejecutan el **ProductForm real** con sus dependencias de API simuladas. El arnés mantiene las actualizaciones de estado en cola hasta un `flush`, reproduciendo el intervalo anterior al render. Comprueban:

1. Dos invocaciones inmediatas producen una petición; botón ocupado; éxito y stock confirmado; un manejador viejo no reenvía.
2. Respuesta perdida y doble reintento conservan clave y contenido; un resultado repetido no emite otra operación nueva.
3. Rechazo explícito muestra el error y permite corregir; una acción deliberadamente nueva usa otra clave.
4. Dos variantes simultáneas generan dos operaciones independientes, y los resultados actualizan la variante correcta.

No se afirma una revisión visual/responsive del administrador: es una verificación de comportamiento del componente, reforzada por las solicitudes concurrentes reales de I08b contra el backend aislado.

### Lint y build seguros

La advertencia de `@next/next/no-img-element` por el uso previo de `<img>` en ProductForm es anterior a esta corrección. La referencia utilizada es el contenido del commit auditado `35de057`, no los cambios concurrentes del árbol actual. El lint Node aplica `no-unreachable`, `no-dupe-keys` y `no-unused-vars`; el backend no tiene configuración/script de lint propio. Su advertencia por `productId` sin uso en financeService también existe en `35de057`.

Los seis errores de lint generales descritos por la auditoría están en otros archivos y no se corrigieron ni se omitieron bajo una declaración de lint global aprobado. En **los archivos de aplicación de esta corrección** no hay errores de lint nuevos ni actuales bajo las verificaciones indicadas.

El build copia el frontend a una carpeta temporal, excluye `.env*`, no hereda credenciales, desactiva telemetría y bloquea fetch/TCP. Reutiliza las dependencias locales mediante una junction. Ejecuta `next build --webpack`; no inicia servidor ni usa la API real. Después elimina exclusivamente su copia temporal, verificando el destino y retirando primero la junction. No altera `.next` ni el servidor de desarrollo existente. La sandbox bloqueó inicialmente la junction; el intento autorizado posterior compiló correctamente.

## 5. Reproducción

Desde la raíz `dizor`, con el entorno de herramientas local ya disponible:

```powershell
$env:MMS_DIR = 'C:\ruta\al\entorno-que-contiene-node_modules-mongodb-memory-server'
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION = '8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
node --test backend/test/phase1.test.js
node --test docs/auditoria-admin/cierre-fase1/correcciones-integracion.test.js
node --test frontend/test/stock-adjustment.test.cjs
node docs/auditoria-admin/cierre-fase1/correcciones-build.cjs
```

`MMS_DIR` es el mismo entorno de herramientas usado por la auditoría y debe contener `node_modules/mongodb-memory-server`. No se necesita un URI ni credenciales reales. Los arneses crean y destruyen su propia base temporal. `correcciones-resumen.json` reúne resultados y hashes de los archivos originales de prueba.

## 6. Regresiones y riesgos pendientes

**Defectos funcionales actuales del alcance solicitado:** ninguno reproducido tras la corrección; I16b y el ajuste de stock de I19c quedan resueltos. Las 57 regresiones anteriores mantienen sus resultados.

Observaciones anteriores fuera de este encargo, sin cambios: bloqueo visual de recaudo/cambio de estado, consumo de cupón tras cancelación, recarga del checkout con clave nueva, índice duplicado de solicitudes y lint general previo. No se clasifican de nuevo como defectos de estos dos arreglos ni se afirma que estén corregidas.

Limitaciones de esta verificación: no se realizó una pasada visual completa, no se efectuaron pagos/correos reales y la integración externa de Wompi no se ejercitó. Las pruebas de doble clic controlan explícitamente el intervalo antes de render, y el build usa respuestas/fallbacks locales sin red; no sustituyen una validación externa.

**Pendientes de producción previamente documentados:** compatibilidad transaccional del entorno, tratamiento controlado del índice histórico y validación externa Wompi. Permanecen fuera del cierre local y **no se ejecutó ninguna tarea, consulta ni procedimiento relativo a ellos**. No se realizaron migraciones ni cambios de índices históricos.

## 7. Estado funcional local

Los dos bloqueantes del cierre independiente están corregidos con pruebas reproducibles. La definición financiera se reutiliza en el servidor y la protección del ajuste actúa antes de que React actualice el estado. Los cobros en disputa y los datos históricos se conservan.

**Cierre funcional local de los dos defectos: PASS. Producción: fuera del alcance de esta tarea, sin acciones realizadas ni autorización inferida.**
