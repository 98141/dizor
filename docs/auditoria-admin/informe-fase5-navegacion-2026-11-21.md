# DIZOR — Fase 5 de 7: navegación y simplificación del administrador

Fecha: 21 de noviembre de 2026. Entorno: local aislado, datos ficticios. **Entrega para auditoría independiente con Cursor; no se declara cerrada la fase.**

## 1. Resumen ejecutivo

La navegación se organiza ahora por tareas y frecuencia. Superadministrador dispone de ocho áreas principales; administrador, siete; vendedor, tres. Productos conserva su experiencia de Fase 4, Pedidos conserva las bandejas de Fase 3 y las alertas quedan como destino secundario de Inicio y de la campana.

Tienda online y Marketing acceden a un único editor compartido, con navegación secundaria separada y pestañas en URL. Las exportaciones existentes se ofrecen desde su contexto. Solicitudes mantiene el shell del vendedor incluso en las rutas históricas `/admin/solicitudes` y su detalle. La configuración muestra la política efectiva de envío e importes históricos sin ofrecer una edición que no se aplicaría.

Se preservaron los permisos y todo el código de aplicación backend. Se aprobaron las 216 regresiones anteriores y 31 pruebas nuevas: **247 pruebas Node**, además de **48 comprobaciones originales de navegador y 35 nuevas con Next autenticado**. Sintaxis y build aislado correctos; sin diagnósticos nuevos de lint. Los resultados se detallan en las secciones 16–17. Se conservan informes, pruebas y evidencias anteriores. No hubo producción, `.env`, pagos/correos reales, activación de entrega externa, migraciones, commits, pushes ni despliegues.

## 2. Mapa de navegación anterior

Se revisaron la auditoría original, los informes de Fases 1–4, los cuatro cierres independientes y sus evidencias/pruebas. El primer cierre de Fase 1 era FAIL por dos defectos; su informe de correcciones y los cierres posteriores documentan su resolución local. Fases 2–4 cierran funcionalmente en local con bloqueantes externos de infraestructura/proveedores. No se convierten aquí en verificaciones aprobadas.

El árbol de trabajo estaba limpio al iniciar esta fase.

| Acceso anterior | Ruta | Situación |
|---|---|---|
| Dashboard | `/admin` | Operación diaria ya optimizada en Fase 3. |
| Inventario | `/admin/inventario` | Movimientos ya integrados en Productos por Fase 4, pero entrada principal aparte. |
| Pedidos | `/admin/pedidos` | Bandejas, filtros, detalle, PDF y comunicaciones. |
| Alertas | `/admin/alertas` | Entrada principal además de dashboard/campana. |
| Solicitudes | `/admin/solicitudes[/id]` | Staff; vendedor entraba a shell administrativo incoherente. |
| PQR y datos | `/admin/pqr` | Administración; proceso independiente y sensible. |
| Productos / Catálogo | `/admin/productos`, `/admin/catalogo` | Dos entradas principales para herramientas relacionadas. |
| Contenido | `/admin/contenido?tab=...` | Diez pestañas mezclaban editorial, marketing y exportaciones. |
| Cupones | `/admin/cupones` | Otra entrada independiente de Marketing. |
| Configuración | `/admin/configuracion` | Campos editables de envío sin efecto bajo la política vigente. |
| Usuarios / Finanzas | `/admin/usuarios`, `/admin/finanzas` | Exclusivos del superadministrador. |
| Auditoría | `/admin/auditoria` | Ruta existente sin entrada reconocible en el menú. |
| Vendedor | `/vendedor`, `/vendedor/pedidos`, `/admin/solicitudes` | Tres accesos, pero Solicitudes perdía Inicio/Pedidos. |

El menú anterior tenía 13 entradas para superadministrador y 11 para administrador, según la configuración inspeccionada. Son conteos de enlaces principales, no mediciones de eficiencia o tiempo.

## 3. Nueva arquitectura de información

| Frecuencia | Área | Herramientas y contexto |
|---|---|---|
| Operación diaria | Inicio | Dashboard existente; Alertas importantes como destino secundario. |
| Operación diaria | Pedidos | Bandejas internas y detalle existentes; acceso secundario al CSV histórico. |
| Operación diaria | Productos | Productos, Existencias, Movimientos y Configuración del catálogo. |
| Operación diaria | Atención al cliente | Solicitudes especiales y PQR/datos personales, con procesos separados. |
| Administración | Tienda online | Inicio editorial, imágenes, banners, páginas informativas, reseñas y apariencia. |
| Administración | Marketing | Cupones, popup, newsletter y consulta histórica de carritos. |
| Administración | Finanzas | Panel, reportes y exportaciones existentes del superadministrador. |
| Administración | Configuración | Tienda, Usuarios/personal según rol y Auditoría. |

No se crean ocho dashboards ni nuevas fuentes de datos. Las agrupaciones remiten a las pantallas existentes. El módulo tiene un destino principal y, cuando procede, un nivel de subsecciones; no se añade cada bandeja de pedidos al sidebar.

## 4. Menú final por rol

| Rol | Entradas principales | Restricciones |
|---|---|---|
| Superadministrador | Inicio, Pedidos, Productos, Atención al cliente, Tienda online, Marketing, Finanzas, Configuración | Usuarios dentro de Configuración; conserva sus herramientas autorizadas. |
| Administrador | Inicio, Pedidos, Productos, Atención al cliente, Tienda online, Marketing, Configuración | Sin enlaces a Finanzas/Usuarios. |
| Vendedor | Inicio, Pedidos, Solicitudes | Inicio/Pedidos apuntan a `/vendedor`. No PQR, Marketing, Finanzas, Usuarios, ajustes ni herramientas internas. |

Las rutas de consulta de productos permitidas al vendedor siguen protegidas por los guards y permisos anteriores; no se añade edición ni un nuevo permiso para resolver el shell. Las rutas `/vendedor` conservan su variante operativa para los roles staff que ya podían abrirlas.

## 5. Justificación de agrupaciones

- **ADM-29:** operación antes que administración ocasional; Productos absorbe los accesos generales dispersos de inventario y taxonomías; las herramientas editoriales se separan de Marketing; Auditoría se vuelve localizable.
- **ADM-30:** Configuración explica la política efectiva y deja de ofrecer importes inactivos como opciones operativas. Usa nombres legibles de transportadoras.
- **ADM-33:** el rol vendedor prevalece al construir el shell, incluso en páginas que históricamente declaraban `variant="admin"`. Conserva Inicio/Pedidos al consultar y responder Solicitudes. Las restricciones financieras ya corregidas en fases anteriores no se reimplementan.
- **ADM-39, solo navegación:** iconos SVG coherentes, foco visible, salto al contenido, atributos accesibles de expansión y gestión del foco/fondo en móvil. No se declara corregida la accesibilidad transversal del administrador.

PQR/datos personales permanece nombrado explícitamente y a un clic de Atención; no se mezcla su proceso con personalizaciones comerciales. Finanzas conserva una entrada principal para el rol autorizado. Reducir enlaces principales no fue motivo para ocultar herramientas críticas.

## 6. Funciones integradas

Pedidos conserva su definición de bandejas, criterios de preparación, revisión, tránsito, recaudo y comunicaciones. Productos conserva consultas, ajustes relativos, idempotencia, IDs, historial y enlaces por variante.

El antiguo código de `app/admin/contenido/page.js` se mueve a `ContentWorkspace.jsx`; la ruta histórica y Marketing montan ese mismo componente. Sus servicios, handlers y almacenamiento editorial son únicos. Las pestañas editoriales muestran seis accesos; Marketing muestra Cupones, Popup, Newsletter y Carritos. El identificador real de cada pestaña se conserva.

`DataExports.jsx` concentra los tres botones CSV existentes. Pedidos enlaza a `contenido?tab=exports&scope=orders`; Newsletter y Carritos ofrecen su propia exportación como acción secundaria, sin una tarjeta grande ni enlaces redundantes para regresar a la misma vista. El punto histórico `tab=exports` sin ámbito mantiene las tres exportaciones. El CSV de pedidos sigue siendo la exportación general anterior: no se presenta como filtrado por la bandeja. El PDF operativo conserva su propia implementación y filtros; las exportaciones financieras siguen dentro de Finanzas.

Los recordatorios de carrito permanecen deshabilitados cuando el servidor comunica que la función no está activa. Se muestra esa condición y se bloquean controles sin efecto, manteniendo lectura/exportación histórica y configuración guardada. No se ejecuta el trabajador ni se activa envío externo.

## 7. Accesos retirados del nivel principal

| Antes | Ubicación final | Funcionalidad/ruta |
|---|---|---|
| Inventario | Productos → Movimientos | `/admin/inventario` sigue abriendo Movimientos. |
| Alertas | Inicio → Alertas importantes y campana | `/admin/alertas` permanece válida. |
| Catálogo | Productos → Configuración del catálogo | Ruta y taxonomías existentes. |
| Solicitudes/PQR separadas al mismo nivel | Atención al cliente | Procesos internos separados. Vendedor conserva Solicitudes como acceso directo. |
| Contenido mezclado | Tienda online / Marketing | Un solo editor y servicios existentes. |
| Cupones | Marketing → Cupones | CRUD y ruta conservados. |
| Usuarios | Configuración → Usuarios y personal | Solo superadministrador. |
| Auditoría oculta | Configuración → Auditoría | Admin/superadmin; registro existente. |

No se eliminan endpoints ni implementaciones por retirar un enlace del primer nivel.

## 8. Rutas conservadas

Permanecen `/admin`, `/vendedor`, listas/detalles de pedidos de ambos perfiles, Productos/nuevo/editar, Inventario, Catálogo, Contenido, Cupones, Finanzas, Usuarios, Configuración, Auditoría, Alertas, Solicitudes/detalle, PQR, Marketing, Reseñas y Home-imágenes.

Se conservan parámetros `tray`, búsqueda, filtros, página, `returnTo`, `view`, `productId` y `variantId` de fases anteriores. Solicitudes ahora conserva búsqueda/tipo/estado/página en URL y devuelve desde detalle a esa lista validada.

Taxonomías usan `categories`, `colors`, `sizes`, `weave-types`, `styles`; se admite además `weaves` como alias histórico de entrada. El cambio de pestaña actualiza la URL y la recarga mantiene selección. Los IDs y contratos de datos no cambian.

## 9. Redirecciones y compatibilidad

`/admin/marketing` deja de redirigir indiscriminadamente a Contenido: monta el editor compartido con Popup por defecto. Si contiene un `tab` histórico válido, abre esa herramienta sin perder los otros parámetros. `/admin/contenido?tab=popup|newsletter|carritos` funciona y presenta el contexto Marketing; las pestañas editoriales conservan el contexto Tienda online.

`/admin/resenas` y `/admin/home-imagenes` siguen redirigiendo a sus pestañas reales, ahora preservando parámetros adicionales. Una pestaña desconocida utiliza el destino predeterminado correspondiente. `tab=exports` continúa disponible para marcadores históricos.

No se cambia la URL de las rutas operativas para reducir el riesgo. La configuración central resuelve el módulo activo por ruta y consulta, incluyendo edición, detalle, rutas históricas y contexto de exportación. No usa una coincidencia de prefijo que seleccione Productos para rutas ajenas con nombres parecidos.

## 10. Mejoras del shell administrativo

`adminNavigation.mjs` define módulos, iconos, destinos, roles visibles, subsecciones y resolución del estado activo. No contiene reglas de escritura, estados de pedidos ni definiciones financieras. El servidor sigue siendo la autoridad de permisos.

`AdminShell` comparte la misma configuración entre escritorio y móvil. Se distinguen Operación diaria/Administración. Solo el grupo correspondiente se abre inicialmente; el usuario puede expandir otro o contraerlo. La selección se conserva al cambiar filtros dentro del módulo y se adapta al cambiar de módulo, sin abrir todos los grupos ni usar almacenamiento del navegador durante el render de servidor.

La cabecera identifica rol y ubicación, con regreso al módulo cuando corresponde y sin repetir el mismo nombre en la miga. Configuración y Atención tienen navegación secundaria común para pasar entre sus herramientas. La campana y el enlace Ver tienda se conservan. Un error al cerrar sesión tiene un mensaje, no una salida silenciosa.

No se reescriben los dashboards ni los formularios comerciales por esta fase.

## 11. Experiencia móvil

Por debajo de 900 px, el botón Menú abre un panel superpuesto con cierre claro y desplazamiento propio. No empuja el contenido ni elimina herramientas. Los destinos son los mismos de escritorio según rol.

El foco entra en Cerrar menú, permanece dentro con Tab/Shift+Tab y regresa al disparador al cerrar. Escape y el fondo permiten salir; el contenido de detrás queda `inert` y el scroll del documento se bloquea mientras está abierto. Se restaura el valor anterior al cerrar o desmontar. Al navegar se cierra inmediatamente; también se cierra al pasar a la anchura de escritorio.

Se comprueban 1440, 820, 390 y 360 px, sin desbordamiento del documento. La barra superior mantiene ubicación y campana; no oculta funciones por ancho.

## 12. Experiencia del vendedor

El shell construye sus enlaces usando el rol efectivo, además de la variante de ruta. Por eso `/admin/solicitudes` y `/admin/solicitudes/[id]` no convierten el menú en uno administrativo parcial. El vendedor conserva Inicio y Pedidos durante lista, detalle y actualización operativa de la solicitud.

Se reutilizan `SpecialRequestsList`, `SpecialRequestDetail` y los mismos endpoints. El cambio de lista se limita a navegación, conservación de contexto, etiquetas y distinción de carga/error/vacío. El formulario comercial de detalle no se duplica.

El vendedor sigue sin recaudar, conciliar pagos, administrar usuarios, leer PQR ni exportar datos restringidos. Las pruebas llaman a los endpoints; no consideran suficiente la ausencia de botones.

## 13. Accesibilidad

La navegación tiene etiquetas, SVG decorativos, estados activos con texto/contraste y `aria-current`, botones de expansión con `aria-expanded`/`aria-controls` y subsecciones ocultas fuera de la tabulación. El botón móvil y su cierre tienen nombres accesibles y áreas de 44 px.

El panel móvil es un diálogo modal con trampa de foco, Escape y fondo no interactuable. Existe salto al contenido; el destino principal puede recibir foco. No se lee `window`, `localStorage` o tamaños del navegador para decidir el render inicial. Los efectos de DOM se ejecutan tras montar.

Se comprueban teclado, foco y ausencia de errores de hidratación en Next real. P35 retarda únicamente la respuesta local de autenticación, comprueba el estado de carga y que no aparezcan enlaces antes de conocer el rol; luego continúa con la respuesta real. No se certifica WCAG ni el uso con lector de pantalla. Los problemas generales de formularios/contraste ajenos a navegación se conservan para Fase 6.

## 14. Recorridos de tareas

Inicio de cada recorrido: sesión ficticia ya cargada en Inicio. Se cuenta cada clic, selección o escritura de un campo como una interacción; se excluyen preparación del fixture, esperas y aserciones. Son recorridos automatizados, no un estudio con participantes ni una medición de tiempos ahorrados.

| Tarea | Ruta practicada | Interacciones | Resultado y confusiones |
|---|---|---:|---|
| 1. Preparación | Inicio → Listos para preparar | 1 | Bandeja filtrada. No requiere elegir entre opciones laterales por bandeja. |
| 2. Talla agotada | Productos → escribir Sombrero → aplicar → variantes → ajustar L | 5 | Panel del SKU agotado con cantidad actual/previsión. Publicación y stock siguen separados. |
| 3. Reseñas | Tienda online → Reseñas | 2 | Moderación existente. Ya no compite con exportaciones/newsletter en una barra de diez pestañas. |
| 4. Solicitud | Atención → solicitud → En revisión → nota → actualizar | 5 | Estado/nota registrados en el fixture; no se afirma envío de una respuesta por correo. |
| 5. Movimiento | Productos → Movimientos | 2 | Historial de solo lectura y PDF existentes. Inventario histórico conduce al mismo destino. |
| 6. Comunicación | Inicio → Comunicaciones por revisar → pedido | 2 | Fallo ficticio visible en el historial, sin pulsar reenvío. |
| 7. Finanzas | Inicio → Finanzas, superadministrador | 1 | Acceso principal reconocible y panel existente. |
| 8. Vendedor | Pedidos → detalle → preparar → Solicitudes → detalle → Inicio | 6 | Preparación real del fixture y navegación del vendedor conservada en todas las pantallas. |

Evidencia estructurada en `next-navegador.json.tasks`. La comparación con antes se limita a la estructura comprobada en código: separación de herramientas, acceso visible a Auditoría y shell incoherente de Solicitudes. No hay porcentajes ni tiempos inventados. La revisión sigue distinguiendo el menú general de los filtros y las pestañas propias de cada módulo.

## 15. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/lib/adminNavigation.mjs` (nuevo) | Fuente de navegación y pestañas, selección activa y regreso interno seguro. |
| `frontend/src/components/admin/AdminShell.jsx` | Roles, grupos, cabecera, móvil, foco y estados. |
| `frontend/src/styles/layouts/admin-layout.css` | Sidebar, drawer, cabecera, navegación secundaria y foco. Mantiene las clases compartidas de estadísticas. |
| `frontend/src/components/admin/ContentWorkspace.jsx` (movido) | Editor anterior único, agrupación de pestañas, URL y estado inactivo de recordatorios. |
| `frontend/src/components/admin/DataExports.jsx` (nuevo) | Botones CSV existentes compartidos con contexto y error visible. |
| `frontend/src/app/admin/contenido/page.js`, `marketing/page.js` | Entradas al editor compartido; no otra fuente editorial. |
| `frontend/src/app/admin/resenas/page.js`, `home-imagenes/page.js` | Redirecciones compatibles conservando parámetros. |
| `frontend/src/styles/pages/admin-cms.css` | Mismo estilo de pestañas aplicado a enlaces de navegación. |
| `frontend/src/app/admin/catalogo/page.js`, `TaxonomyManager.jsx` | Regreso a Productos y selección por URL; CRUD intacto. |
| `frontend/src/app/admin/configuracion/page.js` | Política efectiva, importes históricos solo lectura, nombres de transportadoras y payload sin campos inactivos. |
| `frontend/src/components/admin/SpecialRequestsList.jsx`, `frontend/src/app/admin/solicitudes/[id]/page.js` | Contexto de regreso, URL, carga/error y reutilización del detalle. |
| `backend/test/phase5.test.js`, `frontend/test/navigation-next-browser.cjs` (nuevos) | Navegación, permisos y recorrido Next autenticado aislado. |
| Informe y `fase5-evidencias/` (nuevos) | Reproducción, resultados, capturas y huellas. |

No se modificó código backend de aplicación, guards de autorización, servicios financieros, de inventario o comunicaciones, plantillas, dashboard, bandejas, editor de producto, catálogo público, checkout ni detalle público. No hay dependencias nuevas.

## 16. Pruebas ejecutadas

Comandos y política de aislamiento en [fase5-evidencias/README.md](fase5-evidencias/README.md). El [resumen final](fase5-evidencias/resultados-finales.json) consolida resultados y el [manifiesto SHA-256](fase5-evidencias/manifest-sha256.json) identifica el código y las evidencias entregadas.

- Regresión Node: 210 anteriores más seis independientes del cierre de Fase 4. Incluye las cuatro originales del ajuste de stock.
- Nuevas N01–N06: 31 casos del runner, por parametrización de roles y rutas; contiene también matriz HTTP real de permisos.
- Navegadores anteriores: Comunicaciones 8, Pedidos 20, Catálogo 20, con aserciones originales y datos ficticios.
- Next autenticado: componentes/rutas/servicios/AuthProvider/guards reales, Express real, cookies ficticias, replica set efímero y puertos propios. Incluye tareas, rutas directas, recarga, roles, menú, foco, responsive y enlaces internos.
- Sintaxis, ESLint antes/después, build aislado y `git diff --check`.

| Requisitos de pruebas de Fase 5 | Evidencia |
|---|---|
| 1–6: roles, enlaces ocultos y rechazo backend | N01, N03, N06; P01–P02, P22–P24, P30–P31. |
| 7–13: Inicio, Pedidos, filtros y Productos/Existencias/Movimientos/Catálogo | N02; P03–P09. |
| 14–21: Solicitudes, vendedor, PQR, Tienda, Marketing, Finanzas, Usuarios, Auditoría | N02–N03, N06; P10–P19, P22–P24. |
| 22–28: alertas, rutas/pestañas, regresos, variantes y exportaciones | N02, N04–N06; P04, P06–P07, P11–P15, P18, P21. |
| 29–36: submenús, estado activo, teclado, foco y móvil | P06, P25–P29, P34; capturas 1440/820/390/360. |
| 37–41: URL directa, recarga, carga, hidratación y fuente única | P09, P14–P15, P30–P33, P35; recorridos anteriores de carga/error y revisión del editor movido. |
| 42–45: comunicaciones, finanzas, inventario y rutas históricas | Las 216 regresiones, N06, P14–P15, P20–P24 y los 48 recorridos anteriores. |

La existencia de enlaces por HEAD en Next comprueba que resuelven, no su autorización. Esta se verifica mediante guards reales y respuestas HTTP 401/403 del backend. La carga de autenticación utiliza el guard original; no se añade otra sesión ni se evade la autorización para mostrar el shell.

## 17. Resultados

| Verificación | Resultado final |
|---|---|
| Regresión Node anterior | 216 aprobadas, 0 fallos/omitidas. |
| Nuevas pruebas Node | 31 aprobadas, 0 fallos/omitidas. |
| Total Node | 247 aprobadas. |
| Navegadores originales | 48 comprobaciones aprobadas: 8 + 20 + 20. |
| Next real autenticado | **35 comprobaciones aprobadas y ocho tareas completadas**; sin errores de página/hidratación ni solicitudes externas. Evidencia: `next-navegador.json` / `next-ejecucion.txt`. |
| Sintaxis | Seis archivos Node/.mjs, sin fallos. JSX además pasa por ESLint y build. |
| ESLint intervenido | 4 errores y 2 advertencias previos; base 11 errores y 5 advertencias. Sin diagnósticos nuevos. |
| Lint básico de scripts Node | 0 errores, 0 advertencias. |
| Build aislado | Next.js con webpack, salida 0; copia sin `.env`, sin credenciales heredadas. |
| Espacios y compatibilidad | `git diff --check` sin errores; archivos protegidos comprobados contra HEAD. |

Los cuatro errores previos son uno de `set-state-in-effect` en el editor de Contenido movido, dos de `preserve-manual-memoization` y uno de `set-state-in-effect` en TaxonomyManager. Las advertencias previas son imagen y dependencia de efecto del editor. Se conserva el código original como referencia del archivo movido; no se suprimieron reglas para aprobar la comparación.

No se afirma que todo el repositorio pase ESLint. Permanecen además las observaciones anteriores en Alertas/campana y otros archivos fuera del cambio. Los avisos de Mongoose de índice duplicado de Solicitudes, nombre reservado y opción deprecada son anteriores y no se corrigen con una migración en esta fase.

## 18. Capturas

Capturas de Next auténtico: menú y contenido en cada ancho, además de Tienda, Marketing, Configuración y Vendedor. Se complementan con las capturas regeneradas de los componentes originales de Pedidos y Productos bajo el nuevo shell.

| Vista | Escritorio | Tablet 820 | Móvil 390 | Móvil 360 |
|---|---|---|---|---|
| Menú | [Captura](fase5-evidencias/menu-escritorio.png) | [Captura](fase5-evidencias/menu-tablet.png) | [Captura](fase5-evidencias/menu-movil.png) | [Captura](fase5-evidencias/menu-movil-360.png) |
| Contenido operativo | [Captura](fase5-evidencias/contenido-escritorio.png) | [Captura](fase5-evidencias/contenido-tablet.png) | [Captura](fase5-evidencias/contenido-movil.png) | [Captura](fase5-evidencias/contenido-movil-360.png) |

Otras vistas: [Tienda online](fase5-evidencias/tienda-escritorio.png), [Marketing](fase5-evidencias/marketing-escritorio.png), [Configuración](fase5-evidencias/configuracion-escritorio.png), [Vendedor](fase5-evidencias/vendedor-escritorio.png).

Las carpetas `regresion-fase3/` y `regresion-fase4/` contienen las vistas operativas de escritorio/tablet/móvil y los formularios existentes. Las capturas se revisaron además de las medidas automáticas; una inspección de JSX no se presenta como recorrido de navegador.

## 19. Problemas detectados y corregidos

La dispersión de primer nivel, la mezcla editorial/marketing, Auditoría oculta y el shell del vendedor se corrigen mediante configuración compartida y entradas al mismo editor (**ADM-29/33**). Los campos de envío inactivos se vuelven información y no se envían al guardar impuestos; las transportadoras usan etiquetas (**ADM-30**).

Las pestañas de Contenido no actualizaban su URL y las de taxonomías no conservaban la selección al recargar. Ahora lo hacen. Las redirecciones históricas descartaban parámetros adicionales y ahora los preservan. Solicitudes perdía filtros/página al regresar desde detalle; ahora conserva contexto validado y distingue errores de lista/detalle.

El menú móvil anterior no gestionaba el foco ni impedía interacción con el contenido de detrás. El panel actual incorpora foco, trampa, Escape e inert, sin depender de valores de navegador durante render (**ADM-39, alcance navegación**).

P16 guarda la configuración desde el formulario real: el PATCH contiene únicamente `taxEnabled` y `taxRate`; el modo, costo, mínimo y transportadoras del fixture permanecen iguales.

La sesión Next con alertas no vacías reveló un desbordamiento de seis píxeles: una regla histórica de Alertas anulaba el espaciado móvil de la cabecera y el badge salía del viewport. Se corrigió la prioridad de los selectores exclusivamente en el shell y se acotó el desplegable al ancho disponible; se comprueba también la campana abierta en móvil. No se ocultó el desbordamiento con overflow global.

El arnés integrado se ajustó a respuestas 304 válidas, etiquetas reales y esperas de transición, y utiliza localizadores que resuelven controles visibles entre renderizados. No se cambiaron aserciones de pruebas anteriores ni reglas comerciales para acomodar el arnés. Los resultados finales son los archivos de esta entrega, no intentos intermedios.

## 20. Limitaciones y pendientes

La revisión independiente de Fase 5 corresponde a Cursor y permanece pendiente. Esta entrega no declara su cierre por cuenta propia. El resultado solo certifica los casos locales ejecutados; no hay prueba de todos los navegadores, lector de pantalla o certificación WCAG.

El recorrido integrado usa cookies de login real del fixture y `/auth/me`, pero no evalúa la experiencia de escribir credenciales, recuperación de contraseña ni caducidad prolongada de sesión. La prueba no envía archivos/imágenes a Cloudinary ni prueba buzones, pagos o proveedores externos. Las exportaciones conservan límites y permisos originales; no se añade un sistema nuevo de reportes.

El editor editorial conserva su lógica de carga y edición anterior; esta fase cambia su agrupación y navegación. No se hizo un refactor transversal de formularios, subida de medios, rendimiento editorial o accesibilidad. Las listas/acciones comerciales ajenas a navegación no se rediseñan.

Se conservan, sin declararlas resueltas, observaciones previas: costo potencial de consultas de pedidos, contador de inventario no visible del dashboard basado en total, unicidad de SKU dependiente de los caminos de aplicación, dos variantes activas sin ejes rechazadas, total en la campana de stock bajo, umbral público independiente, cupón tras cancelación y saltos de línea en correo de texto plano. No se cambian estos módulos durante la fase.

**Pendientes externos de Fases 1–2, distintos del alcance funcional actual:** infraestructura transaccional, procedimiento del índice histórico de idempotencia, aceptación/entrega real de Resend y enlace Wompi autorizado. No se consultó producción ni se ejecutó esa validación. Las notificaciones externas no se activaron.

## 21. Recomendaciones para Fase 6

Usar la arquitectura de navegación entregada como base y abordar el pulido visual/accesibilidad de los módulos sin cambiar sus reglas comerciales. Evaluar con personal de tienda el reconocimiento de Tienda online/Marketing y de PQR, mantener destinos contextuales y comprobar lectores de pantalla en un alcance autorizado.

Tratar los diagnósticos antiguos de hooks y la consistencia de formularios como trabajo separado, conservando la regresión y los permisos. Revisar mensajes, tablas y componentes compartidos con evidencia visual y de teclado. Las optimizaciones de consultas y los pendientes externos requieren su alcance propio.

No se comenzó la Fase 6 ni se realizaron tareas de despliegue.
