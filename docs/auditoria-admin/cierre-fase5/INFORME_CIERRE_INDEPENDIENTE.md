# Cierre independiente — Fase 5

Fecha de la auditoría: 2026-11-21.  
Alcance: reorganización de la navegación administrativa, experiencia por rol y compatibilidad con las Fases 1–4.  
Método: lectura del código vigente, reproducción de las pruebas entregadas y comprobaciones propias sobre MongoDB efímero, Express y Next.js. No se modificó código de aplicación, `.env`, producción, índices ni servicios externos. No se inició la Fase 6.

## 1. Resumen ejecutivo

La nueva organización del administrador funciona en local. Una persona con rol de superadministrador, administrador o vendedor ve el menú que le corresponde, las rutas históricas abren la herramienta prevista y el menú móvil se cierra sin dejar el contenido bloqueado.

**Veredicto de cierre funcional local: PASS WITH BLOCKERS.**

La navegación, los permisos y las rutas quedan cerrados en local. Queda un defecto alto, heredado del editor de contenido y ahora compartido por Tienda online y Marketing: si la carga de la configuración de marketing falla, el formulario aparece vacío, permite guardar y sustituye el popup real por valores vacíos. También permanecen los pendientes externos de las fases anteriores. Ninguno de los dos puntos autoriza el despliegue.

**Despliegue: no autorizado.** Siguen pendientes la topología con replica set, la migración del índice histórico de idempotencia, la aceptación real de Resend y la prueba autorizada de Wompi. `TRANSACTIONAL_NOTIFICATIONS_ENABLED` debe permanecer apagado.

## 2. Archivos revisados

Informes y evidencias: `informe-fase5-navegacion-2026-11-21.md`, `fase5-evidencias/README.md`, `resultados-finales.json`, pruebas `backend/test/phase5.test.js`, `frontend/test/navigation-next-browser.cjs` y los arneses de navegador de las Fases 2–4.

Implementación vigente:

- `frontend/src/lib/adminNavigation.mjs`
- `frontend/src/components/admin/AdminShell.jsx`
- `frontend/src/styles/layouts/admin-layout.css`
- `frontend/src/components/admin/ContentWorkspace.jsx`
- `frontend/src/components/admin/DataExports.jsx`
- `frontend/src/components/admin/TaxonomyManager.jsx`
- `frontend/src/components/admin/SpecialRequestsList.jsx`
- Páginas de contenido, marketing, configuración, solicitudes, inventario, reseñas e imágenes de inicio
- `RoleRoute.jsx`, rutas de finanzas, marketing, solicitudes y el controlador de configuración

`git diff --name-only -- backend/src` no devolvió archivos. Los servicios de pedidos, inventario, finanzas y comunicaciones no forman parte del diff de esta fase.

## 3. Reproducción de las 247 pruebas

Entorno: Node v24.15.0, MongoDB 8.3.2 mediante el binario del sistema, `mongodb-memory-server` ya presente en CrediFacil, `MONGOMS_RUNTIME_DOWNLOAD=false`. Cada suite crea su propio replica set. No se usó una base existente. El preload `preservar-evidencias.cjs` redirigió las escrituras de las suites anteriores hacia `fase5-evidencias`, sin cambiar aserciones.

| Suite | Ejecutadas | Aprobadas | Fallos | Omitidas | Duración |
|---|---:|---:|---:|---:|---:|
| Regresión anterior (Fases 1–4, cierres independientes 2–4 y ajuste de stock) | 216 | 216 | 0 | 0 | 168943.556 ms |
| Fase 5 (`phase5.test.js`, N01–N06) | 31 | 31 | 0 | 0 | 13022.438 ms |
| Total | 247 | 247 | 0 | 0 | 181965.994 ms, en dos procesos |

Evidencia: `cierre-fase5/regresion-216.txt`, `cierre-fase5/pruebas-fase5.txt`.

Las 31 pruebas nuevas cubren el menú por rol, la selección de ruta, el regreso de solicitudes y una matriz HTTP real. No sustituyen la sesión de navegador.

## 4. Reproducción de las 83 comprobaciones de navegador

| Grupo | Qué ejecuta | Comprobaciones | Resultado |
|---|---|---:|---|
| Comunicaciones | Componentes reales y API ficticia | 8 | Aprobado, sin errores de página |
| Pedidos | Componentes reales y API ficticia | 20 | Aprobado, sin errores de página |
| Catálogo | Componentes reales y API ficticia | 20 | Aprobado, sin errores de página |
| Next.js autenticado | Next de producción, Express, login real y MongoDB efímero | 35 | Aprobado |

Total: 83/83. Las 48 primeras no son una sesión Next; el propio arnés lo declara. Las 35 nuevas sí lo son. Se comprobó en `navigation-next-browser.cjs` y en la ejecución:

- Copia temporal del frontend, sin `.env`, `node_modules`, `.next` ni pruebas.
- `next build --webpack` con salida 0, red de compilación bloqueada y sin credenciales heredadas.
- `next start` en `127.0.0.1` y un puerto propio. No se tocó ningún servidor ya abierto.
- Cookies obtenidas del login del fixture. `/auth/me` resuelve el rol.
- Chrome sin solicitudes externas, sin errores de página y sin errores de hidratación.
- El guardado de configuración observado envió solo `taxEnabled: false` y `taxRate: 0`.

Duración de pared de las 35 comprobaciones, compilación incluida: 77485 ms. Evidencia: `cierre-fase5/next-ejecucion.txt`, `next-navegador-reproduccion.json`, `build-reproduccion.json` y las capturas regeneradas en `fase5-evidencias/`.

P33 comprueba que cada `href` del menú responde HTTP 200 con una petición HEAD sin cookie de rol. Eso demuestra que la ruta existe. La autorización se verificó aparte, con la sesión autenticada y con las respuestas 401/403 del backend.

## 5. Pruebas independientes añadidas

Node, mismo entorno aislado, 5/5 en 11804.1041 ms: `independiente.test.js`, `independiente-resultados.json`, `independiente-ejecucion.txt`.

| Id | Qué buscó | Resultado |
|---|---|---|
| F5-I01 | Menú al cambiar de rol y parámetros no previstos | Menús correctos. `tab=exports` sin ámbito deja Marketing sin hijo activo. |
| F5-I02 | Exportaciones por URL y por rol | Vendedor 403 y anónimo 401 en finanzas y CSV personales. Administrador 403 en finanzas y 200 en los tres CSV operativos. `tray=prepare` no filtra el CSV. |
| F5-I03 | Guardar solo impuestos y un PATCH directo de envío | El formulario no altera envío ni transportadoras. Un cuerpo fabricado sí reescribe el documento; el costo efectivo sigue en 0. |
| F5-I04 | Vendedor sobre solicitudes y rutas prohibidas | Pasa a `en_revision`. Finanzas, usuarios y stock responden 403. |
| F5-I05 | Contrato de pedido, stock y comunicaciones | Preparación 200, ajuste idempotente con `repeated: true`, listado de comunicaciones 200. |

Navegador propio, segundo Next aislado, 10/10 recorridos en 62127 ms: `navegador-independiente.cjs` y `navegador-independiente.json`.

| Id | Recorrido | Resultado |
|---|---|---|
| B-I01 | Superadministrador en `/admin` | Ocho módulos, Finanzas incluido |
| B-I02 | Vendedor entra por `/admin/solicitudes?q=directa&page=1` | Inicio, Pedidos y Solicitudes |
| B-I03 | Vendedor abre `/admin/finanzas` | Termina en `/cuenta`, sin panel financiero |
| B-I04 | Recarga de reseñas con `term` y `page` | La URL y la sección se mantienen |
| B-I05 | Recarga de Newsletter | El enlace activo es Newsletter |
| B-I06 | Exportación histórica con `tray=prepare` | Un solo botón, el de pedidos |
| B-I07 | `tab=no-existe&scope=finance` | Cae en la sección predeterminada, sin exportación financiera |
| B-I08 | Abrir y cerrar el menú móvil cuatro veces | `inert` queda en falso y el foco vuelve a Menú |
| B-I09 | Ensanchar a 1440 px con el menú abierto | El diálogo desaparece y `inert` queda en falso |
| B-I10 | Inicio, reseñas, carritos, atrás y atrás | El historial regresa a `tab=home` |

La misma sesión reprodujo el defecto F5-A01. No hubo errores de página, de hidratación ni llamadas externas.

## 6. Evaluación de arquitectura de información

La estructura es comprensible para quien administra la tienda y no conoce las rutas. Los nombres —Inicio, Pedidos, Productos, Atención al cliente, Tienda online, Marketing, Finanzas y Configuración— corresponden a tareas, no a módulos técnicos. Operación diaria y Administración están rotulados como grupos. Cada módulo abre como máximo un nivel de subsecciones. No hace falta recordar `/admin/inventario` ni `/admin/resenas`: siguen funcionando y el menú señala el destino nuevo.

Las tareas frecuentes quedan a un clic del módulo o de una tarjeta del inicio: preparar, despachar, revisar comunicaciones, abrir solicitudes y ajustar una variante. Reseñas, imágenes, cupones y exportaciones siguen visibles dentro de su módulo. Reducir el primer nivel no ocultó esas herramientas.

La separación entre Tienda online y Marketing se entiende en las capturas. La excepción heurística está dentro del formulario de Popup: además del popup, edita el texto del footer de newsletter y muestra el bloque de carrito abandonado, que también tienen pestañas propias. Una persona puede dudar dónde guardar el texto del footer. Alternativa, sin implementarla: dejar en Popup solo el anuncio, y dejar el footer y los recordatorios en Newsletter y Carritos. Es una observación de claridad, no un fallo de navegación. No se midió con participantes ni se calculó un ahorro de tiempo.

## 7. Menú y permisos por rol

Medido con sesión real y con el backend:

- Superadministrador: los ocho módulos. Finanzas y Usuarios responden 200 en sus endpoints y la interfaz los muestra.
- Administrador: los mismos módulos excepto Finanzas. El enlace de Usuarios no aparece. `/admin/finanzas` termina en `/cuenta`. Finanzas, sus exportaciones y el listado de usuarios responden 403.
- Vendedor: Inicio (`/vendedor`), Pedidos (`/vendedor/pedidos`) y Solicitudes (`/admin/solicitudes`). En la ruta histórica de solicitudes el menú no cambia. Finanzas, PQR, usuarios, ajustes de stock y los tres CSV personales responden 403. Una URL directa a `/admin/finanzas` termina en `/cuenta`.

El vendedor puede cambiar el estado operativo de una solicitud, incluido `en_revision`. Esa capacidad ya existía en la ruta de solicitudes y no se amplió. No obtiene confirmación financiera, conciliación, costos ni exportaciones.

Ocultar un enlace no es la autorización. Las denegaciones anteriores salen de `authorizeRoles` y de `RoleRoute`.

## 8. Compatibilidad de rutas históricas

Comprobado en la sesión Next y en la sesión independiente, con el contenido visible y no solo con el código de estado:

`/admin`, `/admin/pedidos` con bandeja y página, detalle y regreso, `/admin/productos` con búsqueda, existencias, movimientos y edición, `/admin/inventario`, `/admin/catalogo` con colores, tallas y el alias `weaves`, `/admin/contenido`, `/admin/marketing`, `/admin/cupones`, `/admin/configuracion`, `/admin/usuarios`, `/admin/finanzas`, `/admin/auditoria`, `/admin/alertas`, `/admin/solicitudes` con búsqueda, tipo y página, `/admin/pqr`, `/admin/resenas?term=conservar`, `/admin/home-imagenes?from=historial`, `/vendedor` y `/vendedor/pedidos`.

`/admin/contenido?tab=popup` abre Popup dentro del contexto Marketing. `/admin/marketing?tab=newsletter` sigue en Newsletter después de recargar. Una pestaña desconocida usa el destino predeterminado de esa página. El historial atrás/adelante devolvió a reseñas y después al inicio editorial.

## 9. Tienda online y Marketing

Hay una sola implementación, `ContentWorkspace.jsx`, montada por `/admin/contenido` y por `/admin/marketing`. No se duplicaron servicios. Las pestañas conservan su identificador. Reseñas, imágenes, banners, páginas, apariencia, cupones, popup, newsletter y carritos siguen en su sección. Los recordatorios permanecen desactivados: el texto lo dice y el botón de envío queda inhabilitado. Cambiar de pestaña actualiza la URL mediante el enlace de la sección.

Cuando la API responde, el formulario carga y el guardado de la sesión de Codex envió el contrato existente. Cuando la carga de marketing falla, el comportamiento es el de F5-A01: el vacío se presenta como contenido y se puede guardar.

## 10. Exportaciones y privacidad

`DataExports.jsx` concentra los tres CSV que ya existían: pedidos, newsletter y carritos. El de pedidos está en Pedidos y en `tab=exports&scope=orders`. Newsletter y carritos tienen el suyo en su pestaña. Las exportaciones financieras siguen en las rutas de Finanzas y solo el superadministrador recibe 200.

El CSV de pedidos sigue siendo el listado general, con un tope de 5000. La pantalla de una bandeja no lo presenta como filtrado. En la prueba, `tray=prepare` no cambió el resultado: el administrador recibió el CSV y el vendedor recibió 403. No se descargaron datos de una base real. Los archivos de la sesión contienen compradores ficticios del fixture.

`tab=exports` sin ámbito muestra los tres botones, como documentó la entrega. La selección del menú en ese caso queda descrita en F5-B02.

## 11. Experiencia del vendedor

Recorrido de la sesión Next, con el mismo usuario ficticio: panel, pedidos, detalle, preparación, solicitudes, detalle de una solicitud e inicio. En cada pantalla el menú fue Inicio, Pedidos y Solicitudes. La captura `vendedor-escritorio.png` muestra ese shell y la identidad Vendedor. La entrada directa a `/admin/solicitudes` produjo el mismo menú. No apareció un shell administrativo a medias ni desaparecieron Inicio y Pedidos. La lista y el detalle siguen usando `SpecialRequestsList` y `SpecialRequestDetail`.

El panel del vendedor conserva la tarjeta «Entregados por recaudar» con la leyenda de que el recaudo lo registra un administrador. Es el comportamiento ya cerrado en la Fase 3. Esta fase no le añade la acción de confirmar el recaudo.

## 12. Evaluación de sidebar

En las capturas regeneradas de 1440, 820, 390 y 360 px las etiquetas se leen completas, los iconos acompañan al texto y no hay un segundo nivel de menú. El módulo activo se distingue con fondo e indicador. En escritorio el grupo de la sección actual nace abierto y los demás pueden contraerse. En 820, 390 y 360 el botón Menú abre un panel con cierre visible, fondo atenuado y las mismas entradas del rol. El área del cierre y de las filas es amplia. La campana permanece en el borde visible del viewport y el arnés midió que no provoca desplazamiento horizontal.

## 13. Accesibilidad y responsive

Comprobado en Chrome, no solo por la presencia de atributos:

- Al abrir, el foco entra en Cerrar menú.
- Tab y Shift+Tab recorren el panel y dan la vuelta entre el cierre y Cerrar sesión.
- Escape cierra y devuelve el foco al botón Menú.
- El contenido principal queda `inert` mientras el panel está abierto.
- Al cerrar, al navegar y al pasar a 1440 px, el diálogo desaparece y `inert` vuelve a falso. Se repitió la apertura cuatro veces.
- Hay un enlace «Ir al contenido».
- Las dos sesiones Next terminaron con cero errores de hidratación y cero errores de página.

No se usó un lector de pantalla ni una herramienta de contraste. Las etiquetas de grupo son pequeñas y en mayúsculas. Eso queda como límite de certificación, no como una barrera observada para completar las tareas con teclado.

F5-B01 registra un valor `aria-current` no previsto en el enlace del módulo. El estado visual sí se distingue y el hijo activo usa `aria-current="page"`.

## 14. Recorridos UX

Los ocho recorridos se ejecutaron en la sesión Next autenticada. Son resultados de un arnés sobre datos ficticios, no un estudio con el personal de la tienda. Las interacciones son las que contó el arnés.

| Tarea | Partida | Ruta observada | Interacciones | Resultado |
|---|---|---|---|---|
| Pedidos por preparar | Inicio | Tarjeta «Listos para preparar» | 1 | Bandeja con `tray=prepare` |
| Variante agotada | Productos | Búsqueda, variantes y ajuste de `NAV-AGOTADO` | 5 | Panel con stock 0 |
| Reseñas | Inicio | Tienda online → Reseñas | 2 | Formulario de moderación |
| Solicitud | Inicio | Atención → lista → detalle → En revisión | 5 | Estado actualizado en el fixture, sin correo |
| Movimientos | Inicio | Productos → Movimientos | 2 | Historial de lectura |
| Comunicaciones fallidas | Inicio | Comunicaciones por revisar → pedido | 2 | Estado Fallido, sin reenviar |
| Finanzas | Inicio de superadministrador | Finanzas | 1 | Panel existente |
| Vendedor | Panel vendedor | Pedidos, preparar, solicitudes, detalle, inicio | 6 | Menú de vendedor en todo el recorrido |

No aparecieron errores de navegación ni callejones. La comprensión de Tienda online frente a Marketing es inmediata en las etiquetas; la mezcla interna del formulario de Popup es la única duda heurística, descrita en la sección 6.

## 15. Configuración de tienda

La pantalla muestra «Envío incluido en el precio» y explica que los importes guardados no se aplican. Esos importes están dentro de un desplegable de consulta, no en campos editables, mientras la política vigente es envío incluido. Los impuestos sí se editan. Las transportadoras se leen como Inter Rapidísimo y Servientrega. Guardar desde el formulario envió únicamente los dos campos de impuesto. Después del guardado, modo, costo, mínimo y transportadoras del fixture siguieron iguales. El formulario no ofrece Nequi ni otro método de pago.

F5-B03 describe un PATCH directo, distinto del formulario, que todavía puede reescribir los campos antiguos en el documento. El costo cobrado en el cálculo vigente permaneció en 0.

## 16. Regresiones de Fases 1–4

Las 216 pruebas anteriores cubren registro, preparación, despacho, entrega, recaudo, conciliación, inventario transaccional, ajustes relativos, alertas, comunicaciones, reenvíos, historial, permisos del vendedor, filtros, productos, variantes, movimientos y finanzas conciliadas. Todas pasaron. F5-I05 repitió preparación por el vendedor, un ajuste relativo idempotente y la consulta de comunicaciones. `backend/src` no tiene cambios en el diff. Las observaciones ya documentadas —contador de stock del dashboard, índice único de SKU, variantes sin ejes, total de la campana y saltos de línea del correo— no se reabren: esta fase no las modifica.

## 17. Sintaxis, lint y build

`verificar-estatico.cjs` sobre los archivos intervenidos:

- Sintaxis: 7 archivos, 0 fallos.
- ESLint Node: 0 errores y 0 advertencias, igual que la base.
- ESLint frontend: 4 errores y 2 advertencias. La base comparada tenía 11 errores y 5 advertencias. `newMessages` está vacío.
- Compilación aislada reproducida por la sesión Next: salida 0, copia sin `.env`, sin credenciales heredadas, fetch y TCP bloqueados durante el build, compilador `next build --webpack`.

Los cuatro errores y las dos advertencias son diagnósticos previos de hooks, pureza o `<img>`, trasladados o ya presentes en los archivos tocados. No se cambió código para ocultarlos. No se exige corregirlos para cerrar esta fase.

Evidencia: `estatico-reproduccion.json`, `build-reproduccion.json`.

## 18. Hallazgos nuevos por severidad

### F5-A01 — Alta

- Componente: `ContentWorkspace.jsx`, carga y guardado de marketing. El mismo `catch` ya estaba en `app/admin/contenido/page.js` de HEAD. La Fase 5 lo convierte en el único editor de Tienda online y Marketing.
- Pasos: en un fixture aislado, guardar el popup con título «Titulo real de auditoria»; abrir `/admin/marketing?tab=popup` con el GET de `/api/admin/marketing/settings` abortado; observar el formulario; pulsar Guardar configuración; leer de nuevo el recurso.
- Observado: el título llega vacío, «Activar popup» queda desmarcado, no hay alerta de error y Guardar está habilitado. Tras guardar aparece «Configuración de marketing guardada». El título almacenado pasa a cadena vacía y `enabled` queda en falso.
- Esperado: un fallo de carga se muestra como error. El formulario no se ofrece como configuración vacía y Guardar permanece deshabilitado hasta obtener los datos reales.
- Evidencia: `navegador-independiente.json` (`preparedTitle`, `storedTitle: ""`) y `marketing-error-carga.png`. Código en el `catch` que llama `setMarketing(normalizeMarketing({}))` y en `saveMarketing`, que envía ese estado.
- Corrección recomendada, sin aplicarla: conservar el estado anterior, mostrar el error y no permitir el guardado hasta una carga correcta. Revisar en el mismo método los `catch` silenciosos de suscriptores, carritos y apariencia; esas tres ramas no se ejecutaron en el navegador.

### F5-B01 — Baja

- Componente: `AdminShell.jsx`, enlace principal de cada módulo.
- Pasos: abrir el administrador y leer `aria-current` del módulo activo.
- Observado: el enlace del módulo usa `aria-current="true"`. El hijo activo usa `page`.
- Esperado: un valor de `aria-current` reconocido cuando se quiera anunciar la página actual.
- Evidencia: atributo en el enlace del módulo. El teclado y el cierre del panel sí se probaron.
- Corrección recomendada: reservar `aria-current="page"` para el destino actual. El estado visual ya existe y no impidió la navegación.

### F5-B02 — Baja

- Componente: `locateNavigation` en `adminNavigation.mjs`.
- Pasos: resolver `/admin/contenido?tab=exports` y la misma ruta con `scope=newsletter`.
- Observado: el módulo resultante es Marketing y el hijo buscado, `order-exports`, no existe entre sus hijos. La miga puede decir Marketing mientras el título de la página es Exportaciones. Los tres CSV, o el CSV del ámbito válido, sí se muestran.
- Esperado: la sección activa del menú coincide con Exportaciones o con el ámbito pedido.
- Evidencia: F5-I01 en `independiente-resultados.json`.
- Corrección recomendada: asociar `tab=exports` a un hijo visible del módulo que corresponda al `scope`, también cuando el ámbito no es `orders`.

### F5-B03 — Baja, heredada

- Componente: `settingsAdminController.js`. No está en el diff de la Fase 5. La pantalla nueva sí cumple su contrato.
- Pasos: guardar solo `taxEnabled` y `taxRate`; después enviar un PATCH directo con `shippingMode: "fixed"`, `shippingFixedCost: 1` y `carriers: ["nequi"]`.
- Observado: el primer guardado no cambia modo, costo, mínimo ni transportadoras. El segundo deja el documento en modo fijo, costo 1 y esa lista de transportadoras. `shippingIncluded` sigue en verdadero y `getShippingCost` devuelve 0. El formulario no muestra Nequi ni vuelve a ofrecer los campos de envío.
- Esperado para la pantalla: cumplido. El cálculo vigente no empieza a cobrar envío.
- Evidencia: F5-I03 y la comprobación P16.
- Corrección recomendada: mientras la política efectiva sea envío incluido, ignorar en el controlador los campos de envío y la lista histórica de transportadoras. No reactivar métodos de pago desde este formulario.

No hay hallazgos críticos ni bloqueos de acceso. El vendedor no recibió permisos nuevos. Las rutas históricas probadas muestran su herramienta. El menú móvil no impide navegar.

## 19. Limitaciones pendientes

De esta ejecución:

- No hubo participantes de la tienda. Las conclusiones de comprensión son heurísticas, apoyadas en los recorridos automatizados.
- No hubo lector de pantalla ni medición formal de contraste. El teclado, el foco y el viewport sí se probaron.
- P33, por sí sola, solo demuestra que la ruta Next existe.
- La sesión usa cookies del login del fixture. No se escribió una contraseña, no se probó la recuperación ni una sesión caducada.
- No se subieron imágenes a Cloudinary ni se enviaron correos, pagos o notificaciones externas.

De fases anteriores, siguen abiertos para una preparación de despliegue y no impiden por sí solos el cierre local de la navegación:

- Replica set y procedimiento del índice histórico de idempotencia.
- Aceptación y entrega real con Resend.
- Prueba autorizada del enlace Wompi.
- Las observaciones de stock del dashboard, unicidad de SKU, variantes sin ejes, campana de stock bajo y texto plano de correo, ya registradas y no modificadas aquí.

## 20. Veredicto final

**PASS WITH BLOCKERS.**

La reorganización puede declararse cerrada en local en lo que corresponde a navegación, permisos por rol, rutas históricas, exportaciones, experiencia del vendedor, menú responsive y regresión de las Fases 1–4. 247/247 pruebas Node y 83/83 comprobaciones de navegador pasaron en esta auditoría, además de 5 pruebas Node y 10 recorridos de navegador propios.

Antes de continuar con la Fase 6 conviene corregir F5-A01. Un fallo de carga no debe poder guardarse como si el popup estuviera vacío. F5-B01, F5-B02 y F5-B03 pueden entrar en ese mismo pulido; no rompen las tareas actuales.

**El despliegue no queda autorizado.** Los pendientes de infraestructura, índice, Resend y Wompi se mantienen fuera de este cierre y deben resolverse en su propia preparación.
