# DIZOR — Fase 6: UX/UI y accesibilidad del administrador

Fecha: 21 de noviembre de 2026, America/Bogota. Alcance: implementación y verificación local. Este informe prepara la revisión independiente de Cursor; no concede un cierre independiente ni autorización de despliegue.

## 1. Resumen ejecutivo

Se consolidó la presentación del administrador y vendedor conservando la navegación de Fase 5 y los flujos de las Fases 1 a 4. Se reutilizan la paleta DIZOR, Verdana para la operación y la fuente editorial existente para los títulos de página. Los cambios se limitan al ámbito administrativo.

Se incorporaron campos con ayuda y errores asociados, mensajes persistentes, confirmaciones con gestión de teclado y foco, botones coherentes, tablas móviles con etiquetas, controles de mayor tamaño y estados accesibles. Los formularios antiguos intervenidos cuentan con bloqueo síncrono para impedir envíos duplicados antes del siguiente render.

La regresión final Node aprobó **292/292 casos: los 285 anteriores, incluidas las 57 pruebas originales, y 7 nuevos**. Las siete suites anteriores de navegador aprobaron **136/136 comprobaciones**. Las **59 comprobaciones nuevas de navegador también aprobaron**: total combinado **195/195**. El recorrido sobre Next y Express reales registra sus resultados en `fase6-evidencias/next-navegador.json`; las capturas y mediciones están en `fase6-evidencias/despues/`.

El cargador CMS ya no presenta los tres diagnósticos anteriores indicados en la revalidación de Fase 5. Los diagnósticos restantes se distinguen de los nuevos en §17. No se cambiaron pruebas anteriores, dependencias, modelos, índices, máquina de estados, reglas financieras ni transportes de notificaciones.

## 2. Auditoría visual inicial

Se contrastaron el informe original del administrador, los informes técnicos de las Fases 1 a 5, los cierres independientes, las correcciones de Fases 1 y 5 y la revalidación final de Fase 5. El repositorio estaba limpio al comenzar. La inspección verificó el código vigente y las imágenes, sin tomar el informe más reciente como descripción automática de cada archivo.

El arnés inicial compiló Next en una copia temporal, inició Express con sesión ficticia y Mongo temporal y recorrió **33 pantallas a cinco anchos: 165 capturas**. Se revisaron las imágenes generadas y las evidencias anteriores. Las pantallas incluyen administrador, vendedor, pedidos y detalle, comunicaciones, productos, existencias, movimientos, alta y edición, taxonomías, solicitudes y detalle, PQR, seis herramientas editoriales, Marketing, exportaciones, cupones, finanzas, usuarios, configuración, auditoría y alertas.

Se encontraron desbordamientos del documento en PQR a 360 px, Carritos a 390/360 px y Finanzas a 1024/390/360 px. También aparecieron controles pequeños, campos sin asociación de etiqueta, pestañas recortadas por desplazamiento, tablas que requerían lectura horizontal, mensajes temporizados y confirmaciones sin Escape ni retorno de foco.

Evidencia previa: [matriz por pantalla](fase6-evidencias/MATRIZ_INICIAL.md), [mediciones](fase6-evidencias/antes/pantallas.json) y capturas `fase6-evidencias/antes/`. Los contactos `antes-todas-1.png` a `antes-todas-4.png` reúnen las 33 vistas móviles inspeccionadas.

## 3. Matriz de hallazgos UX/UI

La matriz completa se conserva por pantalla en la evidencia inicial y en la [matriz final](fase6-evidencias/MATRIZ_FINAL.md), complementada por las mediciones finales. Esta tabla relaciona los problemas compartidos con su impacto y corrección.

| ID | Pantallas | Prioridad e impacto | Corrección |
| --- | --- | --- | --- |
| F6-V01 | Todas las vistas administrativas y vendedor | P2: jerarquía y controles inconsistentes | Capa CSS acotada; escala tipográfica, superficies, controles y acciones comunes |
| F6-V02 | PQR, Carritos, Finanzas | P1: contenido fuera del viewport | Se corrigieron mínimos de tablas, rejillas y controles; sin ocultar el desbordamiento global |
| F6-V03 | Solicitudes, PQR, usuarios, auditoría, Marketing, finanzas, taxonomías | P2: lectura horizontal y acciones difíciles de localizar | Filas móviles con etiquetas por dato y acciones conservadas |
| F6-A01 | CMS, taxonomías y reseñas | P1: confirmaciones sin teclado/foco | Diálogo compartido con nombre, descripción, Escape, ciclo de Tab, fondo inerte y retorno |
| F6-A02 | Formularios administrativos | P1: errores desaparecen antes de poder leerse | Avisos persistentes en contexto, con `alert` o `status` según el resultado |
| F6-A03 | PQR, CMS, Apariencia, auditoría y editor de costos | P2: controles sin asociación o nombre suficiente | Etiquetas visibles, asociación nativa o nombre accesible y descripción de errores |
| F6-F01 | Usuarios, cupones, configuración, solicitudes, CMS, imágenes, reseñas y taxonomías | P1: doble envío antes del render | Bloqueo inmediato mediante referencias y estado ocupado; recuperación tras rechazo |
| F6-F02 | Cargador CMS | P2: efecto/dependencias anteriores y error sin recuperación acotada | Lectura por promesas, generación de consulta, error que bloquea edición y reintento |
| F6-M01 | Popup | P2: newsletter y carrito mezclados visualmente | Secciones explícitas en el mismo formulario y fuente de datos |
| F6-C01 | Alertas, Apariencia | P2: contraste insuficiente | Insignia con texto oscuro y borde de selector con contraste suficiente |
| F6-O01 | Detalle de pedido | P2: repetición anunciada como cambio nuevo | Mensaje basado en `changed` ya calculado por backend, sin modificar transiciones |
| F6-I01 | Contador histórico de catálogo del dashboard | P2: clasificación por total distinta de Productos | Reutilización de `inventoryCriteria.summarize()` |

La principal relación con la auditoría original es **ADM-39**: mensajes, controles y foco. **ADM-29, ADM-30 y ADM-33** se conservan mediante la navegación, rutas y roles ya corregidos en Fase 5. **ADM-38** se respeta reutilizando las etiquetas y transportadoras existentes; no se modifican identificadores históricos. ADM-36 y ADM-37 no se presentan como corregidos por un cambio visual: conservan el tratamiento documentado en las fases anteriores.

## 4. Sistema visual reutilizado

Se reutilizan los tokens de `styles/base/variables.css`: Negro `#1A1A1A`, Arena `#F5C37B`, Oro `#B87305`, superficies blancas y tonos de éxito/error existentes. El acento oscuro `#8A5503` se emplea para foco y advertencias legibles. Los bordes de controles usan un tono neutro de mayor contraste que el divisor decorativo.

Los títulos de página conservan la fuente editorial existente y una escala moderada. Los títulos de sección, tareas, formularios y controles usan la familia de interfaz. Las tareas del dashboard mantienen prioridad sobre las estadísticas. No se incorporan fuentes, biblioteca de componentes, degradados ni animación decorativa.

`admin-polish.css` se carga únicamente desde los layouts de administrador y vendedor y todas sus reglas están acotadas a `.admin-shell`. La tienda pública conserva sus componentes, estilos y comportamiento.

## 5. Componentes compartidos

- `AdminFeedback`: aviso persistente en el contexto de la tarea. Éxito confirmado usa `role="status"`; error usa `role="alert"`. Se elimina la desaparición automática de errores administrativos.
- `AdminFormField`: adaptación administrativa del campo existente, con etiqueta, indicación de obligatoriedad, ayuda, `aria-describedby`, `aria-invalid` y control de contraseña accesible mediante teclado.
- `AdminConfirmModal`: adaptación administrativa de la confirmación existente, con título y descripción asociados, foco inicial en Cancelar, ciclo de tabulación, Escape, bloqueo de confirmación repetida, fondo inerte y retorno del foco.

Se reutiliza el botón de envío existente y se consolidan sus estados visuales mediante CSS. Las variantes principal, secundaria, terciaria, destructiva y deshabilitada comparten dimensiones y jerarquía. Los componentes públicos de autenticación y confirmación permanecen intactos.

Los estados existentes conservan sus textos y significado: pedido, pago, recaudo, revisión, publicación, variante activa/inactiva, agotado y comunicación fallida no se unifican en un estado ambiguo ni dependen únicamente del color.

## 6. Mejoras de formularios

Los formularios administrativos reutilizan los campos nuevos sin cambiar nombres ni cuerpos de API. Se asociaron los controles personalizados de textos, imágenes, Apariencia, fechas financieras, PQR y auditoría. Los selectores de color y archivos tienen nombres accesibles. Las ayudas permanecen junto al campo y los errores de validación pueden asociarse mediante identificadores.

Usuarios, cupones, configuración, solicitudes, formularios CMS, imágenes, reseñas y taxonomías incorporan un bloqueo síncrono antes de iniciar la solicitud. Los botones existentes reflejan el procesamiento; las acciones concurrentes relacionadas quedan protegidas. Un rechazo permite corregir y reintentar. No se sustituyó la idempotencia durable de inventario ni el mecanismo de confirmación de Marketing.

PQR diferencia carga, error y lista vacía; añade reintento, etiquetas visibles, estado ocupado y confirmación del historial. Usuarios y cupones muestran un fallo de consulta explícito. Se reemplazaron los `alert()` nativos de usuarios, cupones y costos por avisos integrados.

El editor de costos identifica el campo, asocia el error, explica Guardar y Cancelar y permite regresar al control de edición. Los controles se redistribuyen en móvil. No se cambia el cálculo de costos ni el contrato de actualización.

En cupones se corrigió además la pérdida del mensaje de éxito al reiniciar el formulario. En imágenes y reseñas una recarga posterior al guardado ya no borra inmediatamente el aviso confirmado.

## 7. Mejoras de tablas

Las tablas antiguas conservan sus elementos semánticos y reciben etiquetas de dato por celda. A 700 px o menos, las filas se presentan como bloques legibles; sus encabezados siguen disponibles para tecnologías de asistencia. No se eliminan columnas, acciones, registros ni permisos.

Se corrigió el mínimo heredado de 600 px que impedía redistribuir las tablas. Las rejillas financieras usan columnas que caben en el espacio disponible. Newsletter y Carritos se comprueban tanto con listas confirmadas como con registros ficticios. Auditoría añade etiquetas visibles de filtros y estado expandido en el detalle.

Se conservaron consultas, paginación del servidor, filtros en URL y contexto de regreso de pedidos, catálogo, movimientos y solicitudes. No se cambiaron consultas para resolver problemas de presentación.

## 8. Dashboard y pedidos

Las tareas siguen precediendo a las métricas comerciales. Los contadores y acciones conservan su fuente en el backend. Se homogeneizaron encabezados, números, controles y foco; no se añadieron indicadores decorativos.

El backend ya calculaba `changed` en `updateOrderStatus`, pero devolvía siempre «Estado actualizado». Cuando `changed` es falso, ahora responde: «El pedido ya tenía este estado. No se registró una nueva transición.». El detalle presenta ese texto después de actualizar el pedido. El contrato conserva los mismos campos; no cambia la transición ni se añade una comunicación.

La prueba nueva reproduce una pantalla obsoleta porque otra operación ya inició la preparación. Se verifica el mensaje preciso y la ausencia de historial o notificaciones adicionales. La siguiente acción continúa procediendo del backend.

Se mantiene «Comenzar preparación» como acción directa: ya cuenta con bloqueo inmediato y no registra dinero ni un despacho. Se conservan las confirmaciones contextuales para despacho, entrega, recaudo, cancelación y devolución. No se agrega una confirmación por uniformidad.

Las pruebas verifican que despachar y entregar mantienen el pago pendiente, y que el recaudo se registra únicamente con su referencia, fecha y confirmación separada.

## 9. Productos e inventario

Productos, existencias, variantes, editor e historial reciben los controles, jerarquía y foco comunes. Se conservan la clasificación por variante, los estados de publicación y las distinciones entre stock físico y disponibilidad. El ajuste sigue mostrando el stock previsto y comprueba el stock real después de registrar.

El contador antiguo del payload del dashboard todavía clasificaba por suma del producto. Se corrigió usando `inventoryCriteria.summarize()`, la definición existente de Fase 4. Un producto con una variante agotada y otra con stock ya no aparece como saludable por su total; un stock inválido conserva la categoría de revisión. No se normaliza ni escribe ningún stock histórico.

Las pruebas incluyen productos mixtos, stock bajo con otra variante abundante, variantes inactivas, stock fraccionario o ausente en registros históricos y productos despublicados. La consulta usa `lean()` para que los valores por defecto de Mongoose no conviertan una ausencia histórica en cero durante la lectura. Se comparan los documentos antes/después de consultar el dashboard. No se cambia la arquitectura de inventario, el formulario completo no sobrescribe stock y no se crean índices.

## 10. Tienda online y Marketing

Se conserva el editor compartido y la separación conceptual de Fase 5. Las pestañas se redistribuyen y permanecen visibles en móvil. Se revisan las doce subsecciones de textos y las ocho de imágenes con archivos locales ficticios, sin utilizar Cloudinary ni subir archivos reales.

Popup contiene secciones diferenciadas para su contenido, los textos del newsletter del pie de página y la configuración histórica de carritos. Se mantiene un solo formulario, una sola fuente, el mismo payload y una sola decisión de guardado. Los recordatorios continúan desactivados.

**F5-A01 se conserva completo**: carga confirmada, fallo visible, guardado bloqueado, reintento, verificación de resultado ambiguo, descarte de respuestas antiguas y preservación de valores reales. Las 31 pruebas Node de corrección, las 2 de revalidación y los recorridos de 25 y 18 comprobaciones se reproducen sin cambiar aserciones. El nuevo recorrido añade un fallo de carga con cero PATCH y recuperación de los valores.

El cargador CMS de inicio, páginas y banners ahora usa callbacks de promesas con dependencias estables y generación de consulta. Un fallo bloquea esos formularios y ofrece reintento; una respuesta de una consulta anterior no sustituye el estado actual. Este cambio es independiente de la máquina segura de Marketing, que no se modifica.

## 11. Alertas y mensajes

Los errores administrativos permanecen visibles hasta que una nueva acción válida actualiza el resultado. El encabezado neutral «Atención» evita declarar que una escritura falló cuando su resultado todavía puede ser desconocido. Los éxitos se anuncian después de una respuesta confirmada; los estados desconocidos de pedidos, inventario y Marketing conservan sus bloqueos de verificación.

La campana permite Escape, informa su estado expandido y conserva el foco en el botón al cerrarse. Los grupos de Alertas tienen botones con nombre y `aria-expanded`; la cabecera deja de depender de un `div` pulsable. Se mantiene el refresco existente. El color de la insignia se corrigió porque blanco sobre naranja no alcanzaba el contraste requerido para ese texto pequeño.

No se activó ningún envío, reintento automático nuevo, recordatorio, correo ni pago real.

## 12. Accesibilidad

Se emplea WCAG 2.2 AA como referencia. La comprobación combina **axe-core 4.11.4 ya instalado**, el árbol de accesibilidad de Chrome, contraste calculado a partir de estilos reales y recorridos de teclado.

Las 58 evaluaciones automáticas iniciales —29 vistas administrativas a 1440 y 360 px— no registran infracciones en las reglas seleccionadas de WCAG 2 A/AA, 2.1 AA y 2.2 AA. Los resultados, incluidos los casos que requieren revisión manual, están en `despues/axe.json`. La comprobación adicional de texto y bordes y los nombres de botones están en `despues/accesibilidad.json`.

Se verifica teclado en menú móvil y confirmación, Tab y Shift+Tab, Escape, foco inicial, retorno de foco, fondo inerte, regiones de error/estado, validación de correo, campos asociados, botones deshabilitados y recuperación. La confirmación permanece dentro del viewport a 360 px. Se respeta `prefers-reduced-motion` y se comprueba la ausencia de transiciones administrativas cuando está activo.

Se amplía realmente la fuente raíz de **15 a 30 px** a 720 px de ancho y se verifica redistribución sin desbordamiento. Esto prueba aumento de texto; los cinco anchos de viewport aportan la revisión de reflow. No se presenta esta prueba como una sesión de zoom del navegador con tecnología de asistencia.

No se declara certificación WCAG completa. Quedan fuera una sesión humana con lector de pantalla, combinaciones adicionales de navegador/tecnología de asistencia y todos los estados posibles de datos históricos.

## 13. Responsive

| Ancho | Cobertura principal |
| --- | --- |
| 1440 px | 33 pantallas, navegación de escritorio, jerarquía y acciones |
| 1024 px | 33 pantallas, especialmente rejillas y tablas financieras |
| 820 px | 33 pantallas y navegación móvil |
| 390 px | 33 pantallas y lectura móvil |
| 360 px | 33 pantallas, confirmación, formularios, listas y subsecciones editoriales |

Las mediciones finales se encuentran en `despues/pantallas.json`. Los formularios de ajuste se capturan además abiertos en los cinco anchos. Las subsecciones editoriales, las taxonomías y las listas pobladas tienen mediciones adicionales. Los errores detectados se corrigieron en su causa: mínimos de tabla, columnas, tamaño intrínseco de controles y distribución de acciones.

No se añadió `overflow-x: hidden` global. Los datos y acciones permanecen disponibles. Las pestañas se envuelven en varias líneas y los formularios largos conservan desplazamiento vertical normal.

## 14. Archivos modificados

Aplicación: 28 archivos dentro del alcance.

- Backend: `dashboardAdminController.js` y `orderAdminController.js`.
- Layouts: `app/admin/layout.js`, `app/vendedor/layout.js` y el nuevo `styles/layouts/admin-polish.css`.
- Páginas: `admin/alertas`, `configuracion`, `cupones`, `finanzas`, `pqr` y `usuarios`.
- Compartidos nuevos: `AdminFeedback.jsx`, `AdminFormField.jsx`, `AdminConfirmModal.jsx`.
- Componentes existentes: `AlertBell.jsx`, `AuditLogList.jsx`, `ContentWorkspace.jsx`, `FinanceDashboard.jsx`, `HomeImagesTab.jsx`, `HomeTextsTab.jsx`, `OrderDetail.jsx`, `ProductHistoryList.jsx`, `ReviewsTab.jsx`, `SpecialRequestDetail.jsx`, `SpecialRequestsList.jsx`, `TaxonomyManager.jsx`.
- Estilos de tareas: `OrderWorkspace.module.css` y `CatalogWorkspace.module.css`.

Pruebas nuevas: `backend/test/phase6.test.js`, `frontend/test/admin-fields.test.cjs`, `admin-polish-next-browser.cjs` y los tres helpers `adminPolishBrowserFlow.cjs`, `adminPolishInteractions.cjs`, `adminAccessibilityAudit.cjs`.

Evidencia y reproducción: este informe, `fase6-evidencias/README.md`, matrices, capturas, JSON, logs y los scripts de regresión, análisis estático, preservación y manifiesto. El manifiesto enumera rutas y SHA-256. No se modifican pruebas anteriores ni los informes/evidencias de cierres anteriores.

## 15. Pruebas nuevas

| Caso Node | Comprobación |
| --- | --- |
| F6-01 | Contador del dashboard coherente con clasificación por variante y sin cambios históricos |
| F6-02 | Consultar dashboard conserva productos, pedidos, recaudos, historial y notificaciones |
| F6-03 | Campo obligatorio con etiqueta y ayuda asociada |
| F6-04 | Error anunciado, asociado y con borrador conservado |
| F6-05 | Éxito y error usan regiones distintas, sin falso éxito |
| F6-06 | Control de contraseña con nombre y estado accesible, disponible por teclado |
| F6-07 | Repetición idempotente con texto preciso, sin historial ni comunicación adicional |

El recorrido nuevo añade 33 comprobaciones por pantalla y 26 casos de interacción/accesibilidad: **59 comprobaciones**. Comprueba los cinco anchos, nombres, contraste, axe, menú, confirmación, validación, doble envío de usuario/cupón/PQR, reintento, stock real, repetición de pedido, despacho, entrega, recaudo, finanzas, fallo de Marketing, subsecciones, newsletter, carritos, CMS, movimiento reducido y texto ampliado.

Se usan componentes reales sobre Next de producción y Express, autenticación ficticia y Mongo temporal. Los fallos de lectura o rechazo se inyectan mediante interceptación local con CORS explícito. No se modifican las aserciones de suites anteriores. Los intentos intermedios sirvieron para corregir selectores del arnés y defectos de presentación; los resultados finales se identifican con `passed: true` y salida 0.

## 16. Regresión completa

| Suite anterior | Resultado |
| --- | --- |
| Node Fase 1 | 57/57 |
| Node Fase 2 y compatibilidad | 53 + 5 |
| Node Fase 3 | 34/34 |
| Node Fase 4 | 42/42 |
| Node Fase 5 | 31/31 |
| Node correcciones Fase 5 | 31/31 |
| Independientes Fases 2, 3, 4 y 5 | 9 + 6 + 6 + 5 |
| Revalidación final de Fase 5 | 2/2 |
| Ajuste de stock frontend original | 4/4 |
| **Subtotal anterior Node** | **285/285** |
| **Casos nuevos Node** | **7/7** |
| **Total Node** | **292/292; 0 fallos, omitidos o cancelados** |
| Navegador comunicaciones, pedidos, catálogo | 8 + 20 + 20 |
| Next navegación | 35/35 |
| Navegador independiente Fase 5 | 10/10 |
| Next correcciones Marketing | 25/25 |
| Navegador revalidación final | 18/18 |
| **Subtotal anterior navegador** | **136/136** |

La ejecución final Node está en `regresion-node-final.txt`; las siete suites de navegador se registran por separado en `regresion-navegador.json` y sus logs. Se repitieron además los 35 recorridos de navegación y las 4 pruebas de campos tras los ajustes correspondientes. Los casos cubren Wompi simulado, conciliación, contraentrega, devoluciones, ajustes concurrentes, duplicación de notificaciones, permisos, URL, paginación, filtros, exportaciones y F5-A01.

## 17. Resultados de lint y build

La sintaxis de JavaScript/JSX se verifica con Node y el compilador SWC existente; CSS se parsea con PostCSS. El resultado detallado por archivo está en `estatico.json`. `git diff --check` termina con salida 0.

En los **23 archivos frontend JavaScript/JSX intervenidos**, ESLint conserva **7 errores y 3 advertencias anteriores, con 0 diagnósticos nuevos**. Los archivos nuevos no añaden diagnósticos. ESLint Node termina con 0 errores y 0 advertencias. No se suprimen reglas.

| Pendiente anterior | Archivos |
| --- | --- |
| `react-hooks/set-state-in-effect` | Alertas; los dos cargadores de Finanzas; AuditLogList; FinanceDashboard; HomeImagesTab; ReviewsTab |
| `react-hooks/exhaustive-deps` | AuditLogList |
| `@next/next/no-img-element` | HomeImagesTab y OrderDetail |

El diagnóstico de imagen de ProductForm sigue fuera de los archivos intervenidos. El análisis de todo el administrador distingue ese aviso adicional. El cargador `ContentWorkspace.jsx` queda con **0 errores y 0 advertencias**; también se corrigieron los diagnósticos anteriores de TaxonomyManager, AlertBell, usuarios y cupones mediante cambios acotados.

El build `next build --webpack` se ejecuta en la copia aislada: compilación y generación de las 50 páginas correctas, sin copiar `.env`, sin red externa ni despliegue. `build-fase6.json` registra salida 0. Compilar no sustituye las pruebas funcionales.

## 18. Capturas antes/después

| Vista | Antes | Después |
| --- | --- | --- |
| Dashboard | [1440](fase6-evidencias/antes/inicio-1440.png) | [1440](fase6-evidencias/despues/inicio-1440.png) |
| Solicitudes | [360](fase6-evidencias/antes/solicitudes-360.png) | [360](fase6-evidencias/despues/solicitudes-360.png) |
| PQR | [360](fase6-evidencias/antes/pqr-360.png) | [360](fase6-evidencias/despues/pqr-360.png) |
| Marketing/Carritos | [360](fase6-evidencias/antes/marketing-carritos-360.png) | [360](fase6-evidencias/despues/marketing-carritos-360.png) |
| Finanzas | [1024](fase6-evidencias/antes/finanzas-1024.png) | [1024](fase6-evidencias/despues/finanzas-1024.png) |
| Usuarios | [360](fase6-evidencias/antes/usuarios-360.png) | [360](fase6-evidencias/despues/usuarios-360.png) |
| Popup | [1440](fase6-evidencias/antes/marketing-popup-1440.png) | [formulario completo](fase6-evidencias/despues/popup-configuracion-completa-1440.png) |

También se conservan las otras vistas a los cinco anchos, las subsecciones editoriales, el ajuste abierto, la confirmación móvil, el recaudo confirmado y el texto al 200%. Las imágenes se inspeccionaron visualmente; las mediciones automáticas se usaron para localizar la causa y comprobar las correcciones.

## 19. Defectos encontrados y corregidos

Se corrigieron los desbordamientos de PQR, Carritos y Finanzas; mínimos heredados que impedían redistribuir tablas; el contraste de insignia y selectores de color; etiquetas sin asociación, incluido un subtítulo descubierto al ampliar la inspección editorial; confirmaciones sin foco/Escape; errores temporizados; envíos repetidos en formularios antiguos; pérdida del mensaje de éxito en cupones, imágenes y reseñas; estados expandibles sin información accesible; el contador de catálogo incoherente y la respuesta imprecisa de transición repetida.

Durante la revisión de capturas también se detectó una regla base con mayor especificidad que la variante principal del botón y un borde de error que perdía prioridad frente al estado de foco. Se corrigió la especificidad y se añadió una aserción del color calculado en Chrome. Los errores propios de los primeros intentos del arnés —selector de pestañas y contabilización del preflight CORS como escritura— se corrigieron en las pruebas nuevas, sin modificar el producto ni las pruebas anteriores para ocultar fallos.

## 20. Limitaciones pendientes

**Locales:** los diagnósticos previos identificados en §17 permanecen pendientes. La evaluación automatizada y los recorridos ejecutados no equivalen a una certificación WCAG; falta revisión humana con lector de pantalla y una matriz más amplia de tecnologías de asistencia. Los datos ficticios cubren los estados descritos, sin pretender representar toda combinación histórica. Se conservan estilos en línea de módulos antiguos cuando retirarlos requeriría un refactor mayor.

El cierre independiente de Fase 6 corresponde a Cursor. Este documento informa implementación y evidencia local; no sustituye ese veredicto.

**Producción, separados del estado funcional local:** siguen pendientes las condiciones externas documentadas en las Fases 1 y 2: conjunto de réplicas, procedimiento autorizado para el índice histórico de idempotencia, entrega real con Resend y Wompi en el entorno autorizado. La observación del índice único global de SKU no se aborda aquí. No se validó infraestructura productiva ni se ejecutó ninguna de esas acciones.

No se cambiaron `.env`, bases reales, migraciones, índices, métodos de pago habilitados ni reglas de correo. No hubo commits, pushes, despliegues, pagos reales ni envío de mensajes a terceros.

## 21. Recomendaciones para Fase 7

Entregar esta evidencia a la auditoría independiente y resolver únicamente los hallazgos que confirme. Priorizar una sesión con lector de pantalla y teclado en tareas completas, revisar los diagnósticos anteriores de efectos/dependencias de forma acotada y ampliar los datos históricos ficticios para estados visuales poco frecuentes.

Mantener la separación entre el cierre local y cualquier trabajo posterior de infraestructura. Estas recomendaciones no inician la Fase 7 ni autorizan producción.
