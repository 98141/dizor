# Informe Sprint 08 — Configuración de tienda, Usuarios y personal, Historial de auditoría

Dirección visual: **Operativo Premium Híbrido**. Alcance: las tres subsecciones de Configuración y su navegación secundaria.

No hubo commit, push, despliegue, cambio de `.env`, base real, migración, índice, correo, pago ni notificación externa. No se tocaron roles, permisos, reglas comerciales, la tienda pública ni otros módulos.

## 1. Diagnóstico inicial

Estado Git al empezar: `main` limpio, sin cambios concurrentes (`git status` sin entradas). Se revisaron los informes de los Sprints 01–07, `AdminShell.jsx`, `adminNavigation.mjs`, las tres páginas, `AuditLogList.jsx`, los servicios, los controladores y rutas, `admin-polish.css`, `admin-buttons.css` y las suites que leen estas pantallas.

Capturas del estado previo: `evidencias-sprint-08/antes/`.

| Pantalla | Problema observado (código y capturas) |
| --- | --- |
| Configuración | Una columna de `max-width: 720px`. El porcentaje ocupaba todo el ancho. Envíos y transportadoras eran tarjetas altas con una línea. El error de carga pedía recargar la página: no había reintento. Un `taxRate` vacío se enviaba como `0`. |
| Usuarios | El formulario «Nuevo usuario» era la columna dominante; el equipo quedaba en una tarjeta estrecha con la columna «Acciones» recortada y textos partidos («vended / or», «Inactiv / o»). En 390 px el formulario iba antes de la lista (1.920 px de alto). Roles crudos (`admin`). «Desactivar» sin confirmación. |
| Auditoría | Ocho columnas estrechas: fechas, roles y módulos partidos sílaba a sílaba, botón «Ve / r». 25 eventos por página: 3.037 px en escritorio y **9.297 px en 390 px**. Si la API fallaba, mostraba «No hay eventos con estos filtros» (afirmaba un vacío ante un error). Filtros no persistían en la URL. |

Hallazgos de backend (paginación y filtros ya eran de servidor, `skip/limit` + `countDocuments`):

- `limit` no tenía cota inferior: `?limit=-5` llegaba a Mongo como límite negativo.
- **«Hasta» excluía el propio día**: `new Date("2026-11-20")` es 00:00 UTC, es decir, las 19:00 del día 19 en Colombia. Elegir desde = hasta = hoy no devolvía los eventos de hoy.
- **«Hoy» dependía de la zona del servidor** (`setHours(0,0,0,0)` local). En un servidor UTC contaba desde las 19:00 del día anterior en Colombia.
- `auditLabels.js` no traducía los módulos y acciones que el backend ya registra (`cms`, `coupons`, `reviews`, `pqr`, `coupon_created`, `cms_page_updated`…).

## 2. Configuración de tienda

- **Escritorio**: rejilla de dos columnas desde 44 rem de contenido (1440, 1024 y 820 px), proporción 1,25 : 1, ancho máximo 74 rem. Columna principal: impuestos, lo único editable. Columna secundaria: política de envío y transportadoras.
- **Impuestos**: chip con el estado *guardado* («Activos · 19 %» o «Desactivados»), casilla «Aplicar impuestos» y tasa en un campo de 10 rem con sufijo `%`. `required`, `min=0`, `max=100`: un vacío o un 150 se bloquean antes de la red. Con la casilla desactivada aparece la nota: el checkout no los suma y la tasa se conserva. Chip «Cambios sin guardar» cuando el borrador difiere de lo confirmado. «Última actualización» desde `updatedAt`.
- **Envíos**: tarjeta compacta con el chip «Vigente» y «Envío incluido en el precio.» El histórico sigue en «Consultar configuración histórica de envío», sin campos editables y con la frase de que no se aplica.
- **Transportadoras**: Inter Rapidísimo y Servientrega en dos píldoras (`activeCarriers`). «envia», que aún figura en la base, no se ofrece. Sin edición ni integraciones nuevas.
- **Guardado**: mismo `PATCH /admin/settings`. Con envío incluido el cuerpo es exactamente `{ taxEnabled, taxRate }`. Candado por `ref` y botón deshabilitado (un doble clic = una petición). El rechazo se anuncia y conserva el borrador. Si la respuesta no llega (`!err.response`), se informa que el resultado es desconocido y se ofrece «Comprobar configuración», que lee el servidor y compara con el borrador sin reenviar nada.
- **Error de carga**: aviso con «Reintentar»; no se muestra ningún valor que pueda confundirse con el guardado.
- Si `SHIPPING_INCLUDED_IN_PRICE=false` (reversión prevista en `settingsService`), los campos de envío vuelven a mostrarse dentro del mismo formulario, como antes.

No cambió el cálculo de `cartService.calculateTotals` ni ninguna regla de envío.

## 3. Usuarios y personal

Jerarquía invertida: **primero el equipo, la creación bajo demanda**.

- Cabecera «Usuarios del equipo», subtítulo «Administra los accesos y roles del personal autorizado.» y acción principal «Nuevo usuario» (`aria-expanded`, `aria-controls`), alineada con la tabla (64 rem).
- **Listado**: persona (nombre y correo con recorte), rol traducido, estado, último acceso (`lastLoginAt`, campo que la API ya devolvía) y Activar/Desactivar compacto. Contador «4 personas · 3 activas». En < 42 rem, fichas de dos filas. Nota: el superadministrador no aparece en la lista (la API solo devuelve `admin` y `vendedor`).
- **Estados**: carga (esqueleto + «Cargando equipo…»), vacío confirmado («Aún no hay administradores ni vendedores.» y «Crear primer usuario»), error («No se pudo cargar el equipo…» + «Reintentar equipo»; nunca «0 personas»). Si falla una recarga habiendo lista, se conserva la última lista confirmada y las acciones quedan bloqueadas.
- **Crear usuario**: sección expandible sobre la lista (máx. 52 rem, filete oro). Dos columnas en escritorio, una en móvil. Campos existentes: nombre, correo, contraseña, teléfono (opcional), rol (Vendedor/Administrador, con una línea sobre qué abre cada uno según `adminNavigation`). El foco va a «Nombre» al abrir; Escape o «Cancelar» cierran, vacían el borrador (contraseña incluida) y devuelven el foco al botón. `autocomplete="new-password"` y `off` para no rellenar con las credenciales del propio superadministrador.
- **Resultado desconocido** en la creación: se recarga el equipo y se comprueba si el correo ya existe antes de sugerir un reintento.
- **Desactivar** pide confirmación (`AdminConfirmModal`, foco seguro, Escape, retorno): «X no podrá iniciar sesión ni usar el panel hasta que se active de nuevo» (lo que hacen `authController` y `authMiddleware`). Activar no pide confirmación.
- Sin eliminación, restablecimiento de contraseña ni cambio de rol: el backend no los tiene.

Compatibilidad con F6 (A05–A07): esa regresión escribe en `#name`, `#email` y `#password` al entrar, sin pulsar nada. El formulario se mantiene montado con `hidden` mientras está cerrado (vacío, sin contraseña retenida) y, si se envía, la sección se abre para mostrar su progreso y su resultado. Una persona no puede enviar un formulario oculto; la regla solo hace visible el resultado de un envío. No se modificó la prueba.

## 4. Historial de auditoría

- Cabecera «Historial de auditoría», subtítulo pedido y chip «Solo lectura».
- **KPI compactos** (≈ 76 px): eventos totales, hoy (con «Día civil de Colombia») y fallidos (filete rojo si > 0). Si `/stats` falla: «—» y «Indicadores no disponibles» con reintento; nunca ceros.
- **Filtros**: búsqueda con lupa y «Buscar»; módulo, acción, resultado, desde y hasta. En escritorio (≥ 60 rem) una fila de seis pistas; entre 42 y 60 rem, dos filas; en móvil la búsqueda queda visible y «Filtros (n)» abre el resto en dos columnas. Los selectores aplican al cambiar; texto y fechas con «Buscar»/«Aplicar fechas». Fecha inicial posterior a la final: mensaje anunciado y sin consulta.
- **Tabla de escritorio** (`table-layout: fixed`): fecha (día y hora en dos líneas), usuario (correo con elipsis y rol), módulo, acción (con la descripción en una línea recortada), resultado («Exitoso»/«Fallido») y «Ver detalle». Correos y referencias largas ya no rompen columnas.
- **Detalle bajo demanda**: un evento abierto a la vez, en la fila siguiente (`aria-controls`). Muestra fecha completa con segundos y zona, usuario, rol, acción, módulo, resultado, descripción, referencia (`entityType · entityId`), IP y datos anteriores/nuevos (clave–valor si son planos, JSON si no). El nombre accesible de cada botón incluye la acción y la fecha («Ver detalle de Inicio de sesión, 26 nov 2026, 10:31 a m»).
- **Móvil**: fichas de 3 líneas (98–111 px): acción + resultado; módulo + fecha; usuario abreviado (parte local del correo) + «Ver detalle». La IP, el rol, el correo completo y la descripción quedan en el detalle.
- **Estados**: cargando (esqueleto o filas atenuadas con `aria-busy`), vacío («Aún no hay eventos registrados.»), sin coincidencias («Sin coincidencias» + «Limpiar filtros») y error («No se pudo consultar el historial… no significa que no existan» + «Reintentar historial»).

## 5. Arquitectura visual aplicada

- Hoja nueva `styles/pages/admin-config.css`, prefijo `cf-`, siempre bajo `.admin-shell .cf-page` (salvo las pestañas, por su `aria-label`). Se importa en `app/admin/layout.js` después de `admin-store.css`, antes de pulido y botones.
- Lienzo marfil `--admin-canvas` (#F7F6F2), superficies blancas, bordes `--admin-border-soft` (#E8E4DB), grafito `--admin-graphite` (#252725), oro `--dizor-oro` (#B87305) para el filete activo y acentos; arena para iconos.
- `container-type: inline-size` en la página: las decisiones responsive dependen del ancho real del contenido (con o sin barra lateral, o con texto ampliado), igual que Sprint 04.
- Navegación secundaria: control segmentado compacto. Activa = superficie blanca con filete oro inferior (el grafito sólido queda para la acción dominante, como recomienda Sprint 04). En ≤ 640 px, tres segmentos iguales en una sola fila de 44 px, con el texto en dos líneas dentro de cada segmento; sin desplazamiento horizontal ni varias filas de pestañas.

## 6. Componentes reutilizados

`AdminShell` (pestañas contextuales, migas, estado activo; sin cambios), `RoleRoute`, `AdminFeedback`, `AdminFormField`, `AuthSubmitButton`, `AdminConfirmModal`, `useFlashMessage`, `CARRIER_LABELS`, `formatCOP`, iconos `react-icons/hi2` (ya en el proyecto) y el sistema de botones de Sprint 04: primario (Guardar configuración, Crear usuario, Nuevo usuario), secundario (Buscar, Reintentar, Aplicar fechas), terciario (Ver detalle, Cancelar, Limpiar filtros) y destructivo discreto (Desactivar). No se añadieron dependencias.

## 7. Cambios de frontend

- `frontend/src/app/admin/configuracion/page.js` — composición en dos columnas, validación, estados y comprobación de resultado desconocido.
- `frontend/src/app/admin/usuarios/page.js` — equipo primero, sección de creación bajo demanda, confirmación de desactivación, estados.
- `frontend/src/app/admin/auditoria/page.js` — cabecera y chip de solo lectura. Se retiró el enlace «← Dashboard»: las migas y las pestañas ya llevan a otras secciones.
- `frontend/src/components/admin/AuditLogList.jsx` — filtros y página en URL, 15 por página, tabla/fichas, detalle bajo demanda, estados.
- `frontend/src/lib/auditLabels.js` — etiquetas de módulos/acciones reales y de roles (`getAuditRoleLabel`). Las funciones existentes mantienen su firma.
- `frontend/src/styles/pages/admin-config.css` (nuevo) y `frontend/src/app/admin/layout.js` (una importación).

## 8. Cambios de backend

Necesidad demostrada en filtros y paginación (sección 1). Solo lectura de consultas:

- `backend/src/utils/auditQuery.js` (nuevo): `parseAuditPagination` (página ≥ 1; límite 1..100, por defecto 25 si falta o es ≤ 0), `auditDateFilter` (fecha `YYYY-MM-DD` = día civil de Bogotá; «hasta» incluye el día entero; fecha inválida o rango invertido → 400; un instante con hora conserva el comportamiento anterior) y `bogotaDayStart`.
- `backend/src/controllers/auditAdminController.js`: usa esas tres funciones. El formato de respuesta, la búsqueda, los filtros por módulo/acción/rol/resultado, las rutas, `protect` y `authorizeRoles("superadmin","admin")` no cambiaron. No se crearon índices; los cuatro existentes del modelo ya cubren `createdAt`, `module` y `action`.

No se tocaron autenticación, roles, el registro de eventos (`auditService`), usuarios ni configuración.

## 9. Paginación y filtros

- Servidor: `GET /admin/audit?page&limit&term&module&action&success&from&to`. La pantalla pide **15 por página** (antes 25), dentro de la cota 1..100 del servidor. Nunca descarga el historial entero; no hay scroll infinito.
- URL: `q`, `module`, `action`, `result`, `from`, `to`, `page`. Recargar conserva la vista; atrás/adelante recorren los estados (cada aplicación de filtro o cambio de página es una entrada de historial). Valores inválidos en la URL se ignoran.
- Una `page` superior a la última real se sustituye (`replace`) por la última página.
- Cada respuesta se etiqueta con la consulta que la pidió; una respuesta tardía de una consulta anterior no sustituye a la actual.
- Página actual, total, Anterior, Siguiente y rango «138 eventos · 16–30» se conservan.

## 10. Experiencia móvil

| Pantalla (390 px, carga inicial) | Antes | Después |
| --- | --- | --- |
| Configuración | 1.013 px | 986 px (con estado de impuestos, histórico y «Vigente») |
| Usuarios con 4 registros | 1.920 px | 900 px (la altura de la ventana) |
| Auditoría, página 1 | 9.297 px (25 fichas de 8 líneas) | 2.267 px (15 fichas de 3 líneas, −76 %) |
| Auditoría 360 px | 9.422 px | 2.546 px |
| Auditoría 1440 px | 3.037 px | 1.521 px |

Fichas de auditoría: 98–111 px cada una. Sin desbordamiento horizontal en 1440, 1024, 820, 390 y 360 en las tres pantallas. La información completa sigue disponible en el detalle y tras «Filtros».

## 11. Accesibilidad

Referencia WCAG 2.2 AA; **no se declara conformidad completa**, solo lo comprobado:

- Tablas semánticas con `th scope="col"`; encabezado «Acciones» del equipo accesible pero oculto visualmente.
- Campos con `label` asociado; pistas con `aria-describedby`; errores con `role="alert"`; confirmaciones con `role="status"`; contadores de resultados como estado.
- «Nuevo usuario» y «Filtros» con `aria-expanded`/`aria-controls`; «Ver detalle» con nombre contextual único por evento.
- Foco: al abrir el formulario va al primer campo; Escape/Cancelar lo devuelven al botón; el modal de desactivación conserva su trampa de foco y retorno. Anillo de foco del sistema (3 px) comprobado con teclado.
- Objetivos táctiles de 44 px en pestañas móviles, botones y campos (36 px solo en botones `--sm` con puntero fino, como el sistema de botones).
- El estado nunca depende solo del color: «Exitoso/Fallido», «Activo/Inactivo», «Vigente», «Solo lectura».
- Movimiento reducido: no se añadieron animaciones; el giro de los botones en proceso ya respeta `prefers-reduced-motion`.
- Diseño por contenedor: con texto ampliado el contenido pasa antes a fichas y a una columna.

## 12. Permisos

Sin cambios. Comprobado en la API real (prueba backend S08-05, S08-07, S08-10) y en la interfaz:

| Recurso | superadmin | admin | vendedor | cliente / sin sesión |
| --- | --- | --- | --- | --- |
| `GET/POST /admin/users`, `PATCH …/status` | 200/201 | 403 | 403 | 403 / 401 |
| `GET /admin/audit`, `/stats` | 200 | 200 | 403 | 403 |
| `PATCH/PUT/DELETE /admin/audit/:id`, `POST /admin/audit` | 404 (no existe) | — | — | — |
| `PATCH /admin/settings` | 200 | 200 | 403 | — |

En la interfaz, el administrador no ve «Usuarios y personal» en las pestañas y `RoleRoute` lo envía a `/cuenta`; el vendedor tampoco entra en Auditoría. Ocultar no es la protección: la API ya respondía 403 y sigue haciéndolo.

## 13. Archivos modificados

Modificados: `backend/src/controllers/auditAdminController.js`, `frontend/src/app/admin/auditoria/page.js`, `frontend/src/app/admin/configuracion/page.js`, `frontend/src/app/admin/layout.js`, `frontend/src/app/admin/usuarios/page.js`, `frontend/src/components/admin/AuditLogList.jsx`, `frontend/src/lib/auditLabels.js`.

Nuevos: `backend/src/utils/auditQuery.js`, `backend/test/sprint08-config-users-audit.test.js`, `frontend/src/styles/pages/admin-config.css`, `frontend/test/sprint08-configuracion-browser.cjs`, `frontend/test/helpers/sprint08Mocks.cjs`, este informe y `evidencias-sprint-08/`.

## 14. Pruebas

**Backend** — `node --test backend/test/sprint08-config-users-audit.test.js` con Express real y MongoDB temporal (`mongodb-memory-server`, réplica de un nodo, `mongod` 8.3.2 local). **10/10** (`evidencias-sprint-08/backend-sprint08.txt`). Sin `MMS_DIR` las seis pruebas de integración se omiten de forma explícita.

| Id | Cubre |
| --- | --- |
| S08-01 | Tamaño de página acotado (negativo, cero, 500, texto) |
| S08-02 | «Hasta» incluye el día civil completo; 23:30 del día elegido entra |
| S08-03 | Fechas inválidas / invertidas → 400; instante explícito sin cambio |
| S08-04 | «Hoy» desde medianoche de Bogotá, independiente del servidor |
| S08-05 | Usuarios: 403 a admin, vendedor y cliente; 401 sin sesión; sin hashes ni `password` en la respuesta |
| S08-06 | Validaciones de creación (contraseña débil, rol superadmin, correo, nombre, duplicado) |
| S08-07 | Auditoría: 403 a vendedor/cliente; sin rutas de escritura; un evento real queda idéntico |
| S08-08 | Filtros combinados por día civil, resultado y término; página 2 de 15; límites |
| S08-09 | «Hoy» y «Fallidos» desde la base, con un evento de ayer en Bogotá que no cuenta |
| S08-10 | Guardar impuestos no toca envío ni transportadoras; 150 % → 400; vendedor → 403 |

**Navegador** — `node frontend/test/sprint08-configuracion-browser.cjs`: páginas reales compiladas con el webpack/SWC de Next, servicios simulados con los contratos reales, Chrome sin red externa. **34/34**, 0 errores de página, 0 peticiones externas (`evidencias-sprint-08/navegador-sprint08.txt`, `despues/navegador.json`).

Correspondencia con la lista obligatoria del sprint:

| # | Caso | Prueba |
| --- | --- | --- |
| 1 | Configuración cargada | C01 |
| 2 | Error de configuración | C02 |
| 3 | Impuestos | C03, S08-10 |
| 4 | Envío incluido | C04 |
| 5 | Transportadoras | C01, C05 |
| 6 | Protección de campos históricos | C06, S08-10 |
| 7 | Guardado | C07 |
| 8 | Doble clic | C08, U08 |
| 9 | Usuarios vacíos | U09 |
| 10 | Usuarios con registros | U10 |
| 11 | Crear usuario | U11, S08-06 |
| 12 | Validaciones | U12, S08-06 |
| 13 | Roles | U13, S08-06 |
| 14 | Rechazo a no autorizados | U14, S08-05, S08-07 |
| 15 | Formulario contextual | U15 |
| 16 | Estados de carga | U16 |
| 17 | Error y recuperación | U17, U19, A17, C02 |
| 18 | Auditoría con pocos eventos | A18 |
| 19 | Auditoría con muchos eventos | A19 |
| 20 | Filtros combinados | A20, S08-08 |
| 21 | Paginación | A19, A21, S08-01, S08-08 |
| 22 | Cambio de página | A22 |
| 23 | Eventos de hoy | A23, S08-04, S08-09 |
| 24 | Eventos fallidos | A24, S08-09 |
| 25 | Detalle expandible | A25 |
| 26 | Historial de solo lectura | A26, S08-07 |
| 27 | Protección de datos | A27, S08-05 |
| 28 | Responsive | A28, N01 y medición en las 5 anchuras de cada pantalla |
| 29 | Teclado | A29, U15 |
| 30 | Sin regresiones en pedidos, pagos e inventario | Sección 15 |

Además: U18 (desactivar con confirmación, una petición) y N01 (pestañas: estado activo, permisos, una fila de 44 px a 360).

ESLint sobre los archivos tocados y las pruebas nuevas: 0 problemas (incluidas las reglas del React Compiler).

## 15. Regresión

No se modificó ninguna prueba anterior. Las escrituras de las suites antiguas se redirigieron a `evidencias-sprint-08/regresion/` (`preservar-salidas.cjs`, mismo método que Sprint 01); `git status` final no muestra ninguna evidencia previa modificada. Entorno: `mongod` 8.3.2 local vía `mongodb-memory-server`, sin `.env`, sin red externa.

### Node (F1–F7, cierres independientes, Sprints 01/07/08, checkout y Wompi)

`node docs/auditoria-admin/rediseño-premium/evidencias-sprint-08/regresion-node.cjs` sobre este árbol y sobre una copia exacta de HEAD (`git archive` en el scratchpad, sin `git stash` ni cambios en el árbol de trabajo):

| Árbol | Pruebas | Pasan | Fallan |
| --- | --- | --- | --- |
| HEAD (`910349c`) | 402 | 371 | 31 |
| Sprint 08 | 412 | 381 | 31 |

`comparacion-regresion-node.json`: **el conjunto de fallos es idéntico** (0 nuevos, 0 desaparecidos). Las 10 pruebas añadidas son las de Sprint 08 y pasan. Los 31 fallos son previos y ajenos al módulo: 29 flujos de aprobación Wompi/webhook (C1–C3, P04–P35, N03–N34, U03, Q03–Q11, F2-I01, F2-I05, F4-I02: el pago aprobado queda en `pago_pendiente`) y 2 archivos que no cargan porque falta `docs/auditoria-wompi-pedidos/…/fixture-claude.cjs` (`checkout.test.js`, `phase1-v2.test.js`). Coincide con lo registrado desde Sprint 01. Pedidos, inventario, finanzas (P32 incluido en el mismo estado que HEAD), cupones y notificaciones no cambian de resultado.

### Navegador

`regresion-navegador.cjs` (suites originales, sin cambios):

| Suite | Resultado | Motivo |
| --- | --- | --- |
| Marketing / ajustes confirmados (cierre F5) | PASA | — |
| Sprint 04 Atención y botones | PASA (27) | — |
| Sprint 07 Finanzas | PASA (3) | — |
| Navegación F5 (Next + Mongo) | FALLA en P08 | espera «Movimientos e historial», texto que el commit `38fee86` (Sprints 3–4) quitó de Productos. Se detiene antes de Configuración. |
| Pulido F6 (Next + Mongo) | FALLA en el recorrido | misma ruta de Movimientos. |

Ambos fallos son anteriores al sprint y ocurren antes de llegar a las pantallas de este módulo. Para no quedarse sin esa cobertura, `ejecutar-suite-derivada.cjs` compila los archivos originales en su ruta con sustituciones en memoria, contadas y registradas en `derivada-*.json` (los archivos en disco no cambian):

- **Navegación F5 derivada** (solo «Movimientos e historial» → «Historial de ventas, ajustes y cambios», 2 apariciones): **PASA completa**, incluidos P14 (`/admin/auditoria`), P16 (configuración: envío incluido, sin `#shippingMode` ni `#shippingFixedCost`, transportadoras, histórico, guardado real con payload exacto `{taxEnabled, taxRate}` y campos de envío sin cambios en la base) y P23 (`/admin/usuarios`). `derivada-navegacion.txt`.
- **Pulido F6 derivada** (misma sustitución): Usuarios, Configuración y Auditoría inspeccionadas en 5 anchos, sin desbordamiento; **axe-core WCAG 2.0/2.1/2.2 A y AA: 0 infracciones** en las tres a 1440 y 360 px; contraste básico sin incidencias y 0 botones sin nombre. La suite se detiene en su aserción global A23 por infracciones en Productos, Existencias, Movimientos, Taxonomías y Finanzas.
- **Pulido F6 «continuar»**: además, A23, A19 y A25 se registran sin abortar y se imprimen como **NO SUPERADA**, nunca como aprobadas. Resultado: A01–A09 pasan, entre ellas **A05 (validación nativa de correo), A06 (doble envío = una petición, «Guardando…», error persistente) y A07 (reintento con creación real en Mongo y éxito confirmado)** sobre el formulario bajo demanda. Se detiene en A10 (Existencias, Sprint 03). `derivada-fase6-continuar.txt`.
  - A23 no superada: productos, existencias, movimientos, taxonomías (360) y finanzas (1440).
  - A19 no superada: contraste de controles en productos, existencias, movimientos y taxonomías.
  - A25 no superada: el botón primario mide `rgb(37, 39, 37)` (#252725, sistema de Sprint 04) y la prueba de F6 espera `rgb(26, 26, 26)`.

Ninguna de esas tres afecta a Configuración, Usuarios o Auditoría; quedan para el cierre visual de sus módulos.

## 16. Capturas antes/después

`evidencias-sprint-08/antes/` (código de HEAD, mismos datos ficticios) y `evidencias-sprint-08/despues/`.

| Tema | Antes | Después |
| --- | --- | --- |
| Configuración escritorio | `configuracion-1440.png` | `configuracion-1440.png` |
| Configuración móvil | `configuracion-390.png` | `configuracion-390.png` |
| Usuarios con registros | `usuarios-1440.png`, `usuarios-390.png` | `usuarios-1440.png`, `usuarios-390.png` |
| Usuarios vacíos | `usuarios-vacios-1440.png` | `usuarios-vacios-1440.png` |
| Formulario Nuevo usuario | (siempre abierto: `usuarios-1440.png`) | `usuario-nuevo-1440.png`, `usuario-nuevo-390.png`, `usuario-nuevo-error-1440.png` |
| Desactivar | — | `usuario-desactivar-confirmacion-1440.png` |
| Auditoría escritorio | `auditoria-1440.png` | `auditoria-1440.png`, `auditoria-pocos-1440.png` |
| Auditoría móvil | `auditoria-390.png` | `auditoria-390.png` |
| Evento expandido | `auditoria-detalle-1440.png` | `auditoria-detalle-1440.png`, `auditoria-detalle-390.png` |
| Filtros abiertos | — | `auditoria-filtros-390.png`, `auditoria-sin-coincidencias-1440.png` |
| Estados de error | `configuracion-error-1440.png`, `usuarios-error-1440.png`, `auditoria-error-1440.png` (muestra «vacío») | los mismos nombres + `configuracion-error-guardado-1440.png` |

Todas se inspeccionaron. La inspección encontró y corrigió, antes de cerrar: la celda «Último acceso» rota por un `display:block` en un `td`; «Ver detalle» partido en dos líneas y el botón «Filtros» visible en escritorio (ambos por la especificidad del sistema de botones); la etiqueta de la tasa partida; el campo Teléfono desalineado por el estiramiento de la rejilla; y «0 personas» duplicando el estado vacío.

## 17. Problemas corregidos

1. Auditoría móvil de 9.297 px → 2.267 px; escritorio sin columnas partidas.
2. Error de la API de auditoría presentado como «No hay eventos» → error explícito con reintento; indicadores «—» si fallan.
3. Filtro «Hasta» que excluía el día elegido (backend).
4. «Hoy» dependiente de la zona del servidor (backend).
5. `limit` negativo sin acotar (backend).
6. Filtros y página no persistían en la URL.
7. Formulario de usuarios dominante y siempre abierto → equipo primero, creación bajo demanda.
8. Desactivar acceso sin confirmación.
9. Configuración sin reintento de carga; tasa vacía guardada como 0; resultado desconocido sin comprobación.
10. Etiquetas crudas de roles, módulos y acciones.

## 18. Limitaciones

- El arnés de navegador del sprint usa dobles de servicio (contratos reales, datos ficticios); la API real se cubre en la prueba backend y en las suites Next + Mongo de la sección 15.
- El filtro de auditoría sigue usando una expresión regular sin índice de texto para `term`. Con cientos de miles de eventos conviene medirlo; no se creó ningún índice.
- `AuditLog.distinct("module")` y `distinct("action")` se siguen calculando en cada página, como antes.
- La redacción de claves sensibles en el detalle es de presentación. El backend no registra contraseñas en `previousData/newData`, pero tampoco hay una lista negra en `auditService`; no se cambió el registro de eventos.
- El selector compacto de pestañas en móvil son enlaces en tres segmentos, no un `<select>`: tres opciones caben en una fila de 44 px y conservan URL, estado activo e historial sin JavaScript adicional.
- Los textos que explican qué abre cada rol se basan en `adminNavigation.mjs`; si cambian los permisos habría que actualizarlos.
- Las suites originales de navegación F5 y pulido F6 no pasan completas en este árbol ni en HEAD (sección 15). Su cobertura del módulo se obtuvo con ejecuciones derivadas y documentadas, no con las suites intactas.
- Las 31 pruebas Wompi/checkout que fallan en HEAD siguen fallando igual; este sprint no las investigó.

## 19. Recomendaciones para el cierre visual final

1. Decidir con el equipo cómo actualizar las expectativas de F5 P08, F6 A19/A23/A25 y la ruta de Movimientos a lo que aprobaron los Sprints 03 y 04 (o corregir esas pantallas), para que las suites originales vuelvan a pasar completas. Este sprint no las editó.
2. Restaurar el fixture `docs/auditoria-wompi-pedidos` y revisar los 31 fallos Wompi preexistentes antes del cierre.
3. Unificar en un componente las cabeceras de módulo (`cs-head`, `cf-head`, `dz-hero`) y las pestañas de Atención, Marketing, Tienda y Configuración: hoy son equivalentes visuales con tres implementaciones.
4. Medir la búsqueda de auditoría con un volumen realista antes de decidir si hace falta un índice de texto (decisión de infraestructura, fuera de este sprint).
5. Decidir si `auditService` debe filtrar claves sensibles al registrar, además de la protección de presentación.
