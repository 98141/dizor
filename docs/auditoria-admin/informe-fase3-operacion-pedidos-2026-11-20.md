# DIZOR — Fase 3 de 7: operación de pedidos y dashboard

Fecha: 20 de noviembre de 2026. Alcance: implementación y verificación local. **Estado: lista para auditoría independiente local**, con los límites descritos en este informe. No constituye autorización de despliegue ni validación productiva.

## 1. Resumen ejecutivo

Se reorganizaron dashboard, bandejas y detalle alrededor de la tarea pendiente. El backend determina tanto las categorías como la siguiente acción; React presenta esa información y utiliza las operaciones protegidas existentes. No se crearon estados persistidos de pedido.

El dashboard prioriza preparación, despacho, incidencias, recaudo y comunicaciones. Cada acceso abre pedidos con su bandeja en la URL. La lista conserva filtros y página, y el detalle permite regresar al mismo contexto. El despacho registra guía, transportadora y cambio operativo juntos; la entrega y el recaudo siguen separados. WhatsApp solo se abre mediante una acción voluntaria.

Resultado: **162/162 pruebas aprobadas** —las 119 anteriores, 34 nuevas de backend y las nueve de la auditoría independiente de Fase 2—; **20 comprobaciones de navegador** con componentes React y shell reales, API ficticia y router adaptado. Sintaxis sin fallos; ESLint de los archivos intervenidos sin errores ni diagnósticos nuevos. Se conserva una advertencia de imagen ya presente. El build de producción local aislado terminó con salida 0.

No se modificaron `.env`, credenciales, producción, índices históricos ni datos reales. No hubo despliegue, correo real, pago real, activación de entrega externa, commit ni push. El trabajo concurrente de `SiteFooter.jsx` se conservó y no forma parte de esta fase.

## 2. Comparación de la navegación anterior y nueva

| Tarea | Antes | Ahora |
|---|---|---|
| Identificar trabajo pendiente | Indicadores secundarios mezclados y enlaces a pedidos sin filtro. | Cinco tareas prioritarias con contador de pedidos y enlace a la categoría exacta. |
| Encontrar un pedido | Filtros en estado local; errores podían terminar como una lista vacía. | Bandeja, filtros y paginación en URL; carga, error, vacío y recuperación diferenciados. |
| Volver desde detalle | Regreso a la lista general. | Regreso a la URL filtrada y página desde las que se abrió el pedido. |
| Preparar | Selector genérico de estados. | Acción permitida «Comenzar preparación». |
| Despachar | Tarjetas separadas de estado y guía, con instrucciones redundantes. | Formulario único «Registrar envío y despachar», con confirmación contextual. |
| Entregar y recaudar | Operaciones dispersas con riesgo de confundir los hechos. | Pasos diferenciados; el vendedor registra entrega, el administrador autorizado registra recaudo. |
| WhatsApp | Se abría automáticamente al cambiar estado. | Enlace explícito; la interfaz aclara que abrir una conversación no envía un mensaje. |
| Saber qué recibió el cliente | Historial de Fase 2 disponible en una disposición secundaria. | Historial conservado dentro del detalle y actualizado tras una operación. |

Se conservaron las rutas `/admin`, `/admin/pedidos`, `/vendedor` y `/vendedor/pedidos`. No se reorganizó `AdminShell` ni su menú, no se eliminaron rutas históricas y no se comenzó la Fase 5.

## 3. Arquitectura de bandejas

`backend/src/services/orderWorkspace.js` centraliza filtros, clasificación, contadores, fechas colombianas, DTO de lista y presentación de acciones. `orderReadiness.js` comparte los requisitos de preparación/despacho con la máquina de transiciones. `communicationCriteria.js` permite reutilizar la definición de fallo activo de Fase 2.

La lista ejecuta una agregación MongoDB con filtro base, consulta relacionada de comunicaciones para administradores y `$facet`. Las facetas calculan contadores y filas sobre el mismo universo filtrado y la misma lectura. Las filas se ordenan por `createdAt` y `_id`, con paginación del servidor de 1 a 50 registros. No se descargan todos los pedidos para filtrarlos en el navegador y no hay solicitudes HTTP por cada fila.

La consulta relacionada de notificaciones conserva como máximo un resultado por pedido: una categoría no multiplica pedidos por cantidad de incidencias o fallos. Reutiliza el índice existente por pedido de la bandeja. No se crearon índices adicionales ni migraciones en esta fase. El rendimiento con volúmenes productivos no se certifica con fixtures pequeños.

Dashboard y estadísticas del vendedor llaman al mismo servicio. Los filtros de exportación PDF también se reutilizan; la exportación histórica continúa disponible, limitada a 500 pedidos y explícitamente identificada así en la interfaz.

## 4. Criterios de clasificación y prioridades

| Bandeja / parámetro `tray` | Criterio |
|---|---|
| Por preparar / `prepare` | Estado inicial `pendiente`, `pago_pendiente` o `pagado`; inventario aplicado; sin revisión/incidencia activa ni checkout incompleto; contraentrega o pago verificado registrado. |
| Por despachar / `dispatch` | `en_preparacion` y los mismos requisitos de cumplimiento. |
| En camino / `transit` | `enviado`. |
| Pendientes de recaudo / `collection` | Contraentrega `entregado` con `paymentStatus=pendiente`. |
| Requieren revisión / `review` | Bandera de revisión, incidencia sin resolución, checkout incompleto activo o inventario no aplicado en un pedido que debería poder prepararse. |
| Todos / `all` | Incluye históricos, cancelados, rechazados y devueltos, sujetos a filtros. |
| Comunicaciones / `communications` | Pedido con al menos una comunicación fallida o no enviada que cumpla el criterio activo de Fase 2. Solo administradores. |

Las categorías no pretenden ser disjuntas: un pedido enviado puede seguir requiriendo revisión, y uno entregado puede tener recaudo e incidencia. Cada contador cuenta ese pedido una sola vez **dentro de su categoría**. No se suman las tarjetas para inventar un total de pedidos pendientes. Una incidencia tiene prioridad visual en la siguiente acción y no habilita un despacho bloqueado.

Cancelados/devueltos/rechazados no aparecen como preparación, despacho, tránsito o recaudo ordinario. Un cierre con una incidencia financiera pendiente sí puede aparecer en revisión: no se oculta dinero en disputa. Los Wompi pendientes permanecen consultables sin cancelación por antigüedad.

Las incidencias activas bloquean preparación y despacho incluso si la bandera resumen `requiresReview` está desactualizada. Se reutiliza esa comprobación en la transición protegida y en la guía; no es solo una exclusión visual. La consulta no corrige ni reescribe datos históricos.

## 5. Dashboard implementado

«Requieren atención» presenta cinco tarjetas: listos para preparar, pendientes de despacho, pedidos con incidencias, entregados por recaudar y comunicaciones por revisar. Sus enlaces llevan a `/admin/pedidos?tray=...`. El vendedor recibe las categorías operativas autorizadas, con recaudo solo de consulta y sin la categoría interna de comunicaciones.

Se mantienen accesos a En camino, otras alertas/solicitudes y al historial de auditoría, sin duplicar el bloque principal. Los pedidos recientes muestran número, cliente, fecha, estado y acceso al siguiente paso. Las estadísticas de catálogo, newsletter o cupones no compiten visualmente con la operación; sus módulos y rutas existentes permanecen disponibles.

Los indicadores comerciales tienen menor jerarquía: pedidos de hoy, ventas conciliadas del mes, despachos y entregas registrados hoy. Se usa `financeCriteria.reconciledSalesFilter`, que excluye cierres e incidencias activas, incluida una bandera resumen antigua. El periodo conserva el criterio por fecha del pedido existente en Fase 1, con límite del mes colombiano hasta el momento de consulta.

«Despachos registrados hoy» usa el primer registro `enviado` del historial, independientemente del estado actual del pedido. Una entrega posterior no borra ese despacho y una corrección de guía no lo crea otra vez. Se abandonó el uso de `updatedAt` como prueba de despacho. Las entregas usan `deliveredAt` y, cuando falta, la primera evidencia de entrega del historial: registrar un recaudo posterior no cuenta otra entrega (U34). Los pedidos históricos sin evidencia suficiente no reciben fechas inventadas.

Un error del endpoint muestra error y reintento; no muestra ceros que aparenten ausencia de tareas. Las tarjetas solo aparecen cuando la consulta tiene un resultado válido.

## 6. Lista de pedidos

La lista comparte el componente entre administrador y vendedor. Las bandejas son enlaces navegables y los contadores proceden del backend. Se conservan búsqueda por número/cliente/correo/teléfono, método, estado operativo, estado financiero, intervalo y transportadora; los métodos históricos siguen sirviendo como filtros, sin habilitarlos para nuevas compras.

Los filtros avanzados se agrupan en un desplegable nativo y se abren cuando sus valores están aplicados. La búsqueda y el método siguen visibles. Una búsqueda con `[]`, `+`, `.*` u otros caracteres se escapa antes del regex de MongoDB; no se interpreta como una expresión aportada por el usuario. Se validan enumeraciones, longitud, paginación y fechas.

Las fechas sin hora representan días civiles de Colombia: desde las 00:00 hasta antes de las 00:00 del día posterior. Los timestamps del API deben indicar zona horaria. Fechas inexistentes e intervalos invertidos reciben 400. El formato visible usa `America/Bogota`.

Cada fila muestra número/fecha, cliente, valor/método, estado operativo y de pago, atención necesaria, envío y acceso al detalle. Se conservan las etiquetas de origen/canal histórico. En móvil la tabla se presenta como tarjetas, omitiendo columnas secundarias de teléfono/envío y conservando los datos completos en detalle. No hay scroll horizontal necesario en los anchos probados.

Se diferencian carga, lista realmente vacía, bandeja sin pendientes, búsqueda sin coincidencias, fallo de API, reintento y actualización exitosa. Los números no se calculan a partir de la página visible.

## 7. Detalle y «Siguiente acción»

La cabecera resume número, fecha, estado operativo, estado de pago, método, valor e incidencia. La sección principal recibe `operation` del backend; no calcula una segunda máquina de estados en React. La presentación por código de acción no concede permisos: todos los endpoints vuelven a validarlos.

El backend ofrece preparación, despacho, entrega o recaudo según el caso, o un mensaje de espera/revisión/cierre. También informa si se permite cancelar, devolver, corregir guía o consultar Wompi. El detalle conserva datos del comprador, dirección, productos, precios, promociones históricas, datos de envío, información de pago, incidencias, historial y comunicaciones.

Despacho, entrega, recaudo, consulta/conciliación, cancelación y devolución usan confirmación contextual. Cancelar/devolver solicita motivo interno; preparación y entrega conservan la nota interna opcional. El foco pasa al control de confirmación y existen indicadores de procesamiento, éxito y error. Las operaciones tienen una referencia síncrona de bloqueo: dos pulsaciones antes de un render no lanzan dos solicitudes.

Si hay un fallo de red, 5xx o se registra la operación pero falla la recarga posterior, la pantalla exige actualizar el pedido antes de permitir otra acción. No afirma que la operación fracasó sin comprobarla ni permite repetirla ciegamente. Una respuesta explícita recuperable permite corregir o reintentar. El backend mantiene la idempotencia comercial y transaccional existente.

`returnTo` conserva el contexto de lista. Se admite únicamente la ruta de pedidos correspondiente al panel y sus parámetros; una URL externa no se utiliza como regreso.

## 8. Flujo contraentrega

1. Pedido nuevo válido: Por preparar → «Comenzar preparación», con explicación de que el recaudo es posterior.
2. En preparación: Por despachar → formulario de transportadora y guía → confirmación → una petición de envío que registra el despacho completo.
3. Enviado: En camino → «Registrar entrega» → confirmación.
4. Entregado con pago pendiente: Pendientes de recaudo. La entrega no cambia `paymentStatus`.
5. Administrador autorizado: referencia/comprobante, fecha y hora de Colombia y URL opcional de evidencia → confirmación → registrar recaudo.

El campo de referencia constituye la evidencia identificable mínima exigida por las reglas actuales; la URL sigue siendo opcional. La fecha introducida se convierte explícitamente de UTC−05:00 a ISO, independientemente de la zona del navegador. El vendedor no recibe el formulario ni puede ejecutar el endpoint financiero. Confirmado el recaudo, el pedido sale de esa bandeja sin modificar el despacho ni la entrega.

## 9. Flujo Wompi

Un pedido pendiente muestra «Esperando confirmación del pago» y no ofrece preparación ni despacho. Cuando hay una transacción consultable y el actor es administrador, se ofrece la consulta/conciliación existente, con confirmación. No existe un botón para aprobar Wompi manualmente.

Tras aprobación verificable, inventario aplicado y ausencia de incidencias, el pedido entra en preparación. Una incidencia prioriza revisión y conserva evidencia. El flujo no cancela por vencimiento arbitrario, no crea nuevos enlaces ni ejecuta pagos o reembolsos. Las pruebas usan el proveedor simulado de las fases previas; no se hizo una consulta real a Wompi.

## 10. Experiencia del vendedor

`/vendedor` reutiliza el dashboard operativo con sus bandejas y acceso a solicitudes especiales, sin indicadores financieros internos del dashboard administrativo. `/vendedor/pedidos` y su detalle reutilizan los componentes de pedidos con sus rutas de regreso.

El vendedor puede consultar, preparar, despachar y registrar entrega según la máquina de Fase 1. Puede ver que un recaudo está pendiente y consultar las comunicaciones al comprador autorizadas por Fase 2. No obtiene botones de recaudo, conciliación Wompi, cancelación, devolución ni reenvío de comunicaciones. Las comprobaciones HTTP siguen rechazando las acciones restringidas. El DTO conserva la exclusión de costos internos de productos.

No se reorganizó la navegación completa del vendedor ni se modificó el flujo de solicitudes especiales.

## 11. Integración de notificaciones y WhatsApp

`OrderCommunications` permanece sin modificaciones de aplicación. Tras una operación correcta se recarga el pedido y el componente de comunicaciones, manteniendo enmascaramiento, permisos y distinción entre aceptación del proveedor y entrega al buzón.

La publicación continúa en `orderOperations` y los servicios de Fase 2. El despacho y la entrega concurrentes no crean nuevas notificaciones por repetir la misma transición. Se ejecutaron tanto la regresión anterior como las nueve pruebas independientes del cierre de Fase 2.

Se extrajo únicamente el predicado de fallo activo de comunicaciones para reutilizarlo en alertas y bandejas. No se cambiaron plantilla, transporte, política de reintentos, idempotencia de Resend ni bandera de activación. La observación baja del auditor sobre saltos de línea del nombre de producto en texto plano se conserva como pendiente de Fase 2; no se amplió este alcance para modificar plantillas.

Se eliminó `window.open` del cambio de estado. El enlace voluntario de WhatsApp utiliza el teléfono del comprador y el estado visible; aclara que abrir conversación no envía un mensaje. No se abrió WhatsApp real ni se incorporó una API de mensajería.

## 12. Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/src/services/orderWorkspace.js` (nuevo) | Consultas, clasificación, contadores, DTO, acciones y fechas. |
| `backend/src/services/orderReadiness.js` (nuevo) | Requisitos comunes de cumplimiento. |
| `backend/src/services/communicationCriteria.js` (nuevo) | Criterio compartido de fallos activos de comunicación. |
| `backend/src/controllers/orderAdminController.js` | Lista/estadísticas/exportación compartidas; acciones del detalle; protección de guía. |
| `backend/src/controllers/dashboardAdminController.js` | Contadores compartidos, periodos colombianos e indicadores operativos fiables. |
| `backend/src/controllers/adminAlertController.js` | Revisión administrativa mediante el mismo criterio de bandejas. |
| `backend/src/controllers/notificationAdminController.js` | Reutiliza el predicado extraído, manteniendo el comportamiento de Fase 2. |
| `backend/src/services/orderTransitions.js` | Reutiliza el requisito común de cumplimiento antes de preparar/despachar. |
| `backend/package.json` | Añade `test:phase3`, sin dependencias nuevas. |
| `frontend/src/components/admin/AdminDashboard.jsx` | Resumen dirigido a tareas, reutilizable para vendedor. |
| `frontend/src/components/admin/OrdersList.jsx` | Bandejas, URL, filtros, paginación y estados de interfaz. |
| `frontend/src/components/admin/OrderDetail.jsx` | Jerarquía del detalle, ejecución bloqueada y WhatsApp voluntario. |
| `frontend/src/components/admin/OrderNextAction.jsx` (nuevo) | Formularios y confirmaciones según acciones del backend. |
| `frontend/src/components/admin/OrderWorkspace.module.css` (nuevo) | Diseño acotado, foco y adaptación responsive. |
| `frontend/src/lib/orderWorkspace.js` (nuevo) | Etiquetas de bandejas, formato colombiano y regreso interno seguro. |
| `frontend/src/app/vendedor/page.js` | Reutiliza el dashboard operativo sin cambiar su shell. |
| `backend/test/phase3.test.js` (nuevo) | U01–U34, pruebas HTTP y de criterios con MongoDB efímero. |
| `frontend/test/orders-workspace-browser.cjs` (nuevo) | B01–B20, recorridos reales de componentes/shell con API ficticia. |
| `docs/auditoria-admin/fase3-evidencias/` (nuevo) | Resultados, capturas, scripts de build/estática y conservación de evidencias anteriores. |

`AdminShell.jsx`, los servicios frontend y las rutas administrativas existentes se revisaron y reutilizaron sin necesitar cambios. No se editaron catálogo público, checkout visual, detalle público de productos, reseñas, modelos financieros o de inventario, entrega externa ni archivos `.env`.

## 13. Pruebas realizadas y resultados

Comandos reproducibles en [fase3-evidencias/README.md](fase3-evidencias/README.md). Entorno: Node v24.15.0, MongoDB 8.3.2 en replica set temporal de localhost, datos `.test`, proveedores simulados y salida externa bloqueada.

| Verificación | Resultado |
|---|---|
| 57 Fase 1 + 53 Fase 2 + 5 cierre financiero + 4 ajuste frontend | **119/119 aprobadas**, sin modificar esas pruebas. |
| Nuevas de Fase 3, U01–U34 | **34/34 aprobadas**. |
| Independientes del cierre Fase 2 | **9/9 aprobadas**, sin modificar aserciones. |
| Ejecución conjunta | **162 aprobadas, 0 fallidas, 0 omitidas**, 91,1 s en la ejecución registrada. |
| Navegador B01–B20 | **20 aprobadas**, `pageErrors: []`, `externalRequests: []`. |
| Sintaxis Node | **13 archivos, 0 fallos**; JSX y módulo frontend comprobados además por ESLint/build. |
| ESLint Node explícito | **0 errores, 0 advertencias** con las reglas documentadas. |
| ESLint frontend intervenido | **0 errores, 1 advertencia**, frente a 2 errores/3 advertencias en `HEAD`. Sin diagnósticos nuevos. |
| Build local aislado Next.js | **Salida 0**, sin `.env`, credenciales heredadas ni red fetch/TCP. |
| `git diff --check` | Sin errores de espacios. |

La advertencia restante es `@next/next/no-img-element` en la imagen del producto del detalle, regla ya presente en ese archivo antes de esta fase. Se conservó la imagen remota existente sin introducir optimización ni servicios nuevos. Los dos errores previos de hooks y las advertencias de dependencias resueltos estaban en las pantallas reorganizadas. No se afirma que el lint global de todo el repositorio esté limpio. Backend carece de configuración ESLint propia: se aplicaron explícitamente `no-unreachable`, `no-dupe-keys` y `no-unused-vars`.

Cobertura de los 36 escenarios pedidos:

| Escenarios solicitados | Evidencia |
|---|---|
| 1–9: contraentrega/Wompi, preparación, despacho, tránsito, recaudo, revisión y cierres | U01–U09 |
| 10: contadores frente a resultados | U10, U29; dashboard B01 |
| 11–15: filtros, búsqueda, caracteres especiales y paginación | U11–U15, U32; B02–B03 |
| 16–17: URL y regreso a contexto | B02–B03 |
| 18: acción principal por estado | U16, U02, U18, U21; B04–B07, B09–B10, B19 |
| 19–20: vendedor sin finanzas y administrador autorizado | U17–U18, U07; B09, B18 |
| 21–24: guía/despacho, entrega, recaudo independiente y bloqueo por incidencia | U06–U07, U19–U21; B05–B07, B10 |
| 25: doble clic | U22 y B04, junto con las cuatro regresiones del ajuste de stock |
| 26–28: error/reintento, vacío real y carga | B11–B14, B17, B20 |
| 29: WhatsApp no automático | B07–B08 |
| 30: historial de comunicaciones | U30, 53 pruebas Fase 2 y nueve independientes; B08 |
| 31: integridad financiera | U23–U24, U07 y pruebas financieras anteriores |
| 32: histórico consultable | U25 y regresión anterior |
| 33: zona horaria colombiana | U26–U28, U33–U34; B07 |
| 34–35: responsive y teclado | B05, B15–B16, capturas verificadas visualmente |
| 36: ausencia de notificaciones duplicadas | U19, U22 y regresión Fase 2/concurrencia independiente |

El navegador utiliza los componentes reales `AdminDashboard`, `OrdersList`, `OrderDetail`, `OrderNextAction`, `OrderCommunications` y `AdminShell`. Los adapta a un router local de historial y sustituye servicios por una API HTTP ficticia. Las rutas de backend reales se verifican por HTTP en las suites MongoDB. No se presenta esta separación como una sesión completa de autenticación contra un servidor Next real.

## 14. Capturas de escritorio, tablet y móvil

Capturas finales, con información ficticia y el CSS administrativo existente más los módulos nuevos:

| Vista | Escritorio | Tablet 820 px | Móvil 390 px / 360 px |
|---|---|---|---|
| Dashboard | [Captura](fase3-evidencias/dashboard-escritorio.png) | [Captura](fase3-evidencias/dashboard-tablet.png) | [390 px](fase3-evidencias/dashboard-movil.png), [360 px](fase3-evidencias/dashboard-movil-360.png) |
| Bandejas/lista | [Captura](fase3-evidencias/pedidos-escritorio.png) | [Captura](fase3-evidencias/pedidos-tablet.png) | [390 px](fase3-evidencias/pedidos-movil.png), [360 px](fase3-evidencias/pedidos-movil-360.png) |
| Detalle | [Captura](fase3-evidencias/detalle-escritorio.png) | [Captura](fase3-evidencias/detalle-tablet.png) | [390 px](fase3-evidencias/detalle-movil.png), [360 px](fase3-evidencias/detalle-movil-360.png) |

Se inspeccionaron visualmente las capturas y se midió la ausencia de desbordamiento horizontal. Se verificaron etiquetas, navegación de teclado, foco de confirmación y estados anunciados. Los colores acompañan textos explícitos; no son la única señal del estado. No se realizaron pruebas con lector de pantalla ni una certificación WCAG completa.

## 15. Problemas encontrados y corregidos

1. **Criterios dispersos:** dashboard, estadísticas y lista tenían reglas distintas y enlaces generales. Se centralizaron y se comprobó su equivalencia por HTTP.
2. **Indicador de despacho basado en edición:** `updatedAt` podía confundir cambios administrativos con envíos. Se usa el primer despacho del historial; una corrección de guía posterior no suma otro despacho (U33).
3. **Incidencia con resumen desactualizado:** podía quedar fuera del indicador y del bloqueo operativo. Se comprueba también la incidencia activa tanto en consultas como en las transiciones y guía.
4. **Errores presentados como vacío:** la lista/detalle borraban datos sin distinguir una caída de API. Ahora existe error con recuperación y filtros conservados.
5. **Acciones genéricas y redundantes:** se reemplazó el selector principal por la acción del backend y un formulario único de despacho.
6. **Doble pulsación y resultado incierto:** se incorporó bloqueo inmediato y verificación obligatoria del pedido antes de repetir tras ambigüedad.
7. **WhatsApp automático:** se retiró del cambio de estado y quedó únicamente el enlace manual.
8. **Render inicial de la lista nueva:** el primer recorrido detectó una lectura sobre un valor booleano de carga; se corrigió antes de la pasada final.
9. **Título vertical en tabla móvil:** detectado al inspeccionar la captura; se corrigió el comportamiento del caption y se añadió una medición de altura al recorrido. Los filtros avanzados se agruparon para reducir la extensión inicial.

La primera ejecución de pruebas nuevas también corrigió dos supuestos del fixture: la transportadora inicial no era vacía y `createdAt` es inmutable en Mongoose. Los escenarios de fechas utilizan escrituras crudas **solo dentro de la base efímera de fixtures**. No se debilitó ninguna aserción ni se alteraron pruebas previas.

## 16. Limitaciones y pendientes

No se identificaron defectos funcionales pendientes en la cobertura final ejecutada; la auditoría independiente de esta fase aún no se ha realizado.

Pendientes locales conocidos de alcance distinto: no existe todavía un flujo general para resolver todas las incidencias comerciales o decidir reembolsos; el detalle expone revisión y las acciones realmente existentes, sin inventar una resolución. Los históricos conservan sus valores y fechas ausentes. El PDF conserva su límite de 500 registros. Los contadores son actuales al consultar/refrescar, sin suscripción en tiempo real; dos consultas distintas pueden observar operaciones nuevas entre ellas. No hubo benchmark productivo, certificación de accesibilidad completa ni prueba de todos los navegadores.

Se conserva la observación baja de Fase 2 sobre saltos de línea de nombres en el correo de texto plano. No afecta al flujo de acciones de esta fase y no se oculta como una corrección realizada aquí.

Pendientes externos de fases anteriores, **distintos de defectos funcionales locales de Fase 3**: aceptación e idempotencia reales de Resend, llegada/render en buzones, enlace Wompi en entorno autorizado, infraestructura compatible con transacciones y procedimiento de índices históricos. No se validaron ni se actuó sobre ellos. `TRANSACTIONAL_NOTIFICATIONS_ENABLED` permanece sin activar y no se modificó `.env`.

## 17. Recomendaciones para Fase 4

Reutilizar la clasificación de revisión para señalar inventario pendiente de verificar, sin resolverlo mediante un cambio de estado manual. Al implementar la experiencia de inventario, mantener ajustes relativos, clave estable, bloqueo inmediato y trazabilidad por variante; conservar las cuatro pruebas frontend existentes y los escenarios concurrentes.

Evaluar volumen y planes de consulta en un entorno aislado autorizado antes de proponer índices; no cambiar índices productivos por esta fase. Coordinar la futura gestión de incidencias comerciales con su evidencia financiera. La reorganización global del menú corresponde a Fase 5 y los ajustes generales de accesibilidad al alcance posterior acordado.

Estas recomendaciones no se implementaron como Fase 4. El código y las evidencias entregados corresponden exclusivamente a la Fase 3.
