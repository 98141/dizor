# Correcciones posteriores a la auditoría independiente — Fase 5

Fecha: 21 de noviembre de 2026. Alcance: F5-A01 y observaciones seguras F5-B01/B02/B03. **Entrega para verificación definitiva por Cursor; no se declara cerrada la fase ni se inicia Fase 6.**

## 1. Causa raíz de F5-A01

`ContentWorkspace.jsx` convertía cualquier fallo de `GET /api/admin/marketing/settings` en `normalizeMarketing({})`. Ese objeto completaba campos vacíos y valores de activación sin evidencia del servidor. El mismo formulario permitía enviarlo mediante PATCH. Un error de lectura se confundía con una configuración válida sin contenido.

La lógica era heredada del editor anterior y se había trasladado al componente compartido. La auditoría independiente demostró pérdida del título y cambio de activación en un fixture. La navegación y sus pruebas previas no cubrían esa rama.

Se revisaron el informe de Fase 5, el cierre independiente, sus evidencias, las cinco pruebas Node de Cursor, los diez recorridos independientes y los servicios/controladores/modelos reales. El árbol inicial contenía la Fase 5 sin commit y la auditoría de Cursor. Se conservaron esos cambios; la comparación de esta corrección usa la copia inicial, no presupone que HEAD contenga la Fase 5.

## 2. Archivos modificados

| Archivo | Cambio acotado |
|---|---|
| `frontend/src/components/admin/ContentWorkspace.jsx` | Separa las lecturas confirmadas de Marketing, Apariencia, suscriptores, carritos y cupones; elimina sustituciones por blancos ante error; protege los dos formularios. Conserva campos, identificadores y servicios. |
| `frontend/src/lib/confirmedSettings.mjs` (nuevo) | Validación de respuestas, estado de lectura/escritura, cancelación, generación de solicitudes, bloqueo inmediato y verificación de resultados ambiguos. Sin defaults comerciales nuevos. |
| `frontend/src/hooks/useConfirmedSettings.js` (nuevo) | Suscripción React al recurso y cancelación al desmontar. |
| `frontend/src/components/admin/SettingsLoadState.jsx` (nuevo) | Carga, error, reintento, guardado, verificación y éxito con mensajes y controles accesibles. |
| `frontend/src/services/adminMarketingService.js`, `adminSettingsService.js` | Configuración opcional de timeout/señal en los servicios existentes, sin cambiar endpoints o cuerpos de negocio. |
| `frontend/src/components/admin/AdminShell.jsx` | Valores semánticos `page`/`location` para destino y módulo activo. |
| `frontend/src/lib/adminNavigation.mjs` | Selección coherente de exportaciones históricas y sus ámbitos. |
| `backend/src/controllers/settingsAdminController.js` | Ignora campos históricos de envío y transportadoras bajo la política efectiva de envío incluido; mantiene impuestos/apariencia y la autorización existente. |
| `backend/test/phase5-corrections.test.js` (nuevo) | 31 pruebas Node específicas, incluyendo HTTP real contra una base efímera. |
| `frontend/test/content-settings-next-browser.cjs`, `frontend/test/helpers/contentSettingsBrowserFlow.cjs` (nuevos) | Chrome con Next, Express, autenticación y MongoDB efímeros; 25 comprobaciones específicas. |
| `cierre-fase5/correcciones-evidencias/` (nuevo) | Base inicial, prueba roja, regresiones, capturas, resultados y scripts reproducibles. |

Solo seis archivos de aplicación ya existentes cambiaron respecto al inicio de esta corrección. Las tres piezas nuevas de aplicación están limitadas a confirmar datos y proteger estos formularios. No se modificaron las aserciones originales ni los módulos de pedidos, pagos, inventario o comunicaciones.

## 3. Comportamiento anterior y reproducción previa

Antes de modificar la aplicación se ejecutó la aserción de regresión sobre Next real, Express y un replica set efímero. El popup del fixture tenía título no vacío y `enabled: true`. Se interrumpió su carga en Chrome.

**Resultado rojo esperado:** salida 1, `true !== false`, porque existía un botón Guardar configuración habilitado después del fallo. El test se detuvo antes de ejecutar una escritura destructiva; la pérdida de información mediante guardado ya estaba acreditada por Cursor.

Evidencias propias conservadas: [reproduccion-previa.txt](correcciones-evidencias/reproduccion-previa.txt), [F5-A01-antes.json](correcciones-evidencias/F5-A01-antes.json), [captura anterior](correcciones-evidencias/F5-A01-antes.png) y copia de los seis archivos iniciales en `base/`. La misma aserción de bloqueo permanece en el recorrido final y ahora pasa.

## 4. Comportamiento corregido

| Estado | Comportamiento |
|---|---|
| Cargando | No hay datos editables inventados. Guardar no se ofrece o queda bloqueado. Hay un estado visible de carga. |
| Lectura válida | Se muestran los datos recibidos y validados. El formulario permite editar. |
| Vacío legítimo | Se admite cuando una respuesta válida del recurso confirma campos vacíos. Sigue siendo editable; no se trata como error ni se rellena con una oferta comercial nueva. |
| Error de lectura | Mensaje claro y Reintentar. Sin primera respuesta válida no se monta un formulario vacío. Si ya había datos, se conservan identificados como desactualizados y bloqueados. |
| Guardando | Bloqueo síncrono anterior al render, controles inhabilitados y estado visible. Dos submits inmediatos producen un solo PATCH. |
| Rechazo explícito al guardar | Se conserva el borrador y se muestra el error. Un reintento deliberado vuelve a ser posible. |
| Resultado ambiguo | No se declara éxito ni se repite automáticamente el PATCH. Se consulta el recurso; solo una lectura válida que coincide con lo enviado confirma el resultado. Si no coincide o falla, queda bloqueado y ofrece comprobar de nuevo. |
| Guardado confirmado | Mensaje de éxito y datos confirmados por la respuesta válida de guardado o por la lectura de verificación. |

La generación de solicitudes invalida respuestas anteriores y la cancelación impide publicar resultados de una instancia desmontada. Hay timeout de 15 segundos en estas operaciones; el timeout y el aborto son errores, no datos vacíos. Cambiar de pestaña no escribe ni reinicializa la configuración con blancos.

La verificación compara los campos de la operación, considerando las normalizaciones ya existentes del servidor, como espacios recortados y código de cupón en mayúsculas. No utiliza un objeto de respaldo para declarar éxito. Los valores de política del servidor, como `featureEnabled`, no se envían como configuración comercial editable.

El usuario puede descartar un borrador incierto y recargar explícitamente los datos actuales. Esa acción hace una lectura, no vuelve a enviar el guardado. La interfaz lo explica. No se introduce una garantía de exclusión entre administradores distintos ni un sistema nuevo de versiones del backend.

## 5. Revisión de errores de carga relacionados

| Rama | Riesgo anterior y resultado |
|---|---|
| Popup / footer de Newsletter / parámetros de carrito | El mismo formulario enviaba las tres partes de Marketing. Ahora solo se habilita con el recurso completo confirmado. Un fallo de lectura no puede sustituir ninguna parte por defaults del cliente. **Verificado con Node y Chrome.** |
| Apariencia | El estado inicial era un objeto de strings vacíos y el catch no impedía guardarlo si fallaba la lectura. Ahora requiere una respuesta válida de Configuración que contenga Apariencia; un objeto parcial no se vuelve un reemplazo editable. **Verificado con Node y Chrome.** |
| Suscriptores | El catch silencioso podía mostrar cero tras una caída. Ahora tiene carga/error/reintento propios y distingue una lista vacía válida. Es lectura; no se agregó una escritura sobre suscriptores. **Verificado con Node y Chrome.** |
| Carritos | Mismo problema de lista aparentemente vacía. Estado independiente y recuperación, conservando la desactivación de recordatorios. **Verificado con Node y Chrome.** |
| Cupones del selector | Error visible y reintento. El código de cupón ya guardado se conserva aunque no esté disponible la lista; no se reemplaza por el primer valor vacío. Se respeta el contrato actual de lista sin `status`. **Contrato validado en Node; revisión de su integración en el formulario.** |
| Inicio editorial | Ante un fallo inicial no había objeto `home` editable ni sustitución silenciosa por uno vacío. Su carga ya muestra error. No se reescribió esa lógica. **Inspección de código y regresión anterior.** |
| Páginas y banners | Los objetos vacíos pertenecen a la creación de registros nuevos. El detalle de una página se asigna tras una lectura correcta; no existe el mismo fallback de edición confirmado por la auditoría. **Inspección de código; sin refactor del CMS.** |

El refresco general del CMS dejó de reemplazar Marketing o Apariencia. Sus lecturas, borradores y errores son independientes. Se conserva la distribución actual del formulario de Popup, incluidos sus campos de footer y carrito; no se rediseñó el módulo.

## 6. Observaciones menores

**F5-B01 — Corregida.** El destino principal actual puede usar `aria-current="page"`; el módulo antecesor activo utiliza `location`. El hijo seleccionado conserva `page`. Se mantienen las clases visuales, expansión, foco, cierre móvil y roles. Chrome comprobó Inicio, Popup y su módulo; la regresión anterior comprobó el resto de la navegación.

**F5-B02 — Corregida.** Marketing tiene un acceso secundario visible a Exportaciones históricas. `tab=exports` sin ámbito o con ámbito desconocido selecciona ese destino. `scope=newsletter` y `scope=carts` seleccionan Newsletter y Carritos; `scope=orders` conserva Pedidos → Exportar pedidos. El título del contenido explicita su ámbito. No se cambian permisos, contenido, límites o implementación de los CSV. El CSV general de pedidos sigue siendo general: añadir `tray=prepare` no lo convierte en una exportación filtrada.

**F5-B03 — Corregida de forma acotada.** Cuando `isShippingIncluded(settings)` es verdadero, el controlador solo acepta los campos vigentes de impuestos y apariencia. Ignora `shippingMode`, `shippingFixedCost`, `freeShippingMinAmount`, `shippingByDepartment` y `carriers`, conservando sus valores históricos. Mantiene la respuesta HTTP compatible. No borra datos ni cambia la función de cálculo.

La prueba HTTP comprueba que un cuerpo fabricado no altera envío/transportadoras, que los impuestos y Apariencia siguen guardándose y que el vendedor recibe 403. También representa en la base efímera una política no incluida (`SHIPPING_INCLUDED_IN_PRICE=false` y modo fijo), verificando la compatibilidad del contrato histórico autorizado. No se modificó ninguna variable o dato real del negocio.

## 7. Pruebas nuevas

**31/31 pruebas Node aprobadas**, sin fallos ni omisiones. Archivo: `backend/test/phase5-corrections.test.js`; resultado: [pruebas-nuevas.txt](correcciones-evidencias/pruebas-nuevas.txt).

| Casos | Cobertura |
|---|---|
| C01–C04 | Lectura válida, carga pendiente, HTTP fallido, timeout y aborto. |
| C05 parametrizado | Respuestas nulas, incompletas, vacías sin contrato, tipos incorrectos y estado de error dentro de HTTP 200. |
| C06–C08 | Reintento, conservación de valores anteriores y vacío legítimo. |
| C09–C10, C19 | Respuestas antiguas, cancelación/desmontaje y no reemplazo de una versión más reciente. |
| C11–C13 | Doble envío, borrador inválido y rechazo explícito con conservación de borrador. |
| C14–C18 | Respuesta perdida después/antes de aplicar, respuesta de guardado inválida, comprobación posterior y recarga sin reenvío. |
| C20–C23 | Apariencia fallida/vacía/parcial, listas fallidas frente a vacías y contrato de cupones. |
| C24–C25 | Exportaciones y protección HTTP real de Configuración, compatibilidad y permisos. |

**25/25 comprobaciones nuevas de Chrome aprobadas.** El primer caso contiene la aserción que fallaba antes. Incluyen intento de submit real/forzado tras un error, lectura posterior de la base, un doble submit antes de render, fallo HTTP de guardado, respuesta perdida después de aplicar y antes de aplicar, verificación sin PATCH adicional, cambio de pestaña, respuesta antigua, vacío legítimo, Apariencia, suscriptores, carritos, roles, `aria-current`, exportaciones y recuperación en escritorio/móvil.

La simulación de respuestas conserva las cabeceras CORS necesarias entre los dos puertos propios. Las lecturas/escrituras no interceptadas usan los servicios y endpoints reales. La prueba de respuesta perdida aplicada ejecuta el PATCH en el backend efímero y pierde deliberadamente su respuesta al navegador; el resultado se confirma con GET. No se confunde ese caso con una respuesta de éxito ficticia.

## 8. Regresiones ejecutadas

| Grupo | Resultado |
|---|---|
| 247 pruebas Node existentes | Aprobadas, sin cambiar aserciones. |
| Cinco independientes de Cursor | Aprobadas. Sus observaciones originales se contrastan con el comportamiento corregido. |
| Regresión Node conjunta | **252/252**, cero fallos/omitidas; [regresion-252.txt](correcciones-evidencias/regresion-252.txt). |
| Nuevas Node | **31/31**. |
| **Total Node** | **283 aprobadas** en las dos ejecuciones. |
| Componentes de Comunicaciones/Pedidos/Catálogo | **8 + 20 + 20 = 48** comprobaciones originales aprobadas. |
| Navegación autenticada original de Fase 5 | **35/35** aprobadas. |
| Recorridos independientes de Cursor | **10/10** aprobados. |
| Nuevos escenarios de datos | **25/25** aprobados. |
| **Total navegador** | **118 comprobaciones aprobadas**. |

Las salidas se redirigen a esta carpeta mediante un preload que solo cambia el destino de evidencias. No cambia pruebas ni sus aserciones. Los informes y resultados originales de Cursor y de las fases anteriores permanecen intactos. La prueba roja previa se conserva separada del veredicto verde final.

## 9. Navegador y evidencias visuales

Las 35 comprobaciones originales, los diez recorridos independientes y los 25 nuevos usan sesiones Next reales contra Express y MongoDB efímeros, autenticadas con cookies obtenidas del login de usuarios ficticios. Las otras 48 usan componentes reales con API ficticia, como antes. No se presentan como una sesión integral.

En los nuevos escenarios se probó 1440, 390 y 360 px; la regresión original incluye también tablet 820 px. No hubo solicitudes externas, errores de página ni errores de hidratación en las sesiones finales. Las capturas se revisaron visualmente; los fallos no muestran un formulario vacío habilitado y la recuperación conserva los valores del fixture.

| Estado | Escritorio | Móvil 390 | Móvil 360 |
|---|---|---|---|
| Error bloqueado | [Captura](correcciones-evidencias/error-marketing-escritorio.png) | [Captura](correcciones-evidencias/error-marketing-movil.png) | [Captura](correcciones-evidencias/error-marketing-movil-360.png) |
| Recuperación | [Captura](correcciones-evidencias/marketing-recuperado-escritorio.png) | [Captura](correcciones-evidencias/marketing-recuperado-movil.png) | [Captura](correcciones-evidencias/marketing-recuperado-movil-360.png) |

El valor «Resultado aún desconocido» que aparece dentro del campo Título en algunas capturas es el texto ficticio usado por el caso de respuesta perdida, posteriormente confirmado y cargado. No es un mensaje de estado del sistema. Los estados de operación están fuera del campo, con mensajes propios.

La reproducción independiente conserva `preparedTitle` y `storedTitle` iguales después del fallo de carga; ya no ejecuta el guardado destructivo porque no encuentra Guardar habilitado. Su JSON se conserva en `independiente/navegador-independiente.json`.

## 10. Sintaxis, lint y build

- `node --check`: ocho archivos Node/.mjs, cero fallos. JSX se analiza además con ESLint y el build.
- ESLint Node explícito: cero errores y cero advertencias.
- ESLint de los ocho archivos frontend de la corrección: **un error y dos advertencias, los mismos de la base inicial**, sin diagnósticos nuevos. El error es el manejo de estado desde el efecto del cargador general del CMS; las advertencias son su dependencia de efecto y la imagen existente. No se suprimieron reglas ni se presenta el lint global como limpio.
- Build aislado: salida 0 con `next build --webpack`, copia temporal sin `.env` ni credenciales heredadas. El arnés propio bloquea fetch/TCP durante compilación y permite solo loopback en runtime; Chrome y el fixture impiden accesos externos.
- `git diff --check`: sin errores de espacios.

La comparación de lint usa las copias iniciales de los seis archivos, porque la Fase 5 estaba sin commit. Las reglas Node son `no-unreachable`, `no-dupe-keys` y `no-unused-vars`; el backend no tiene una configuración global propia. Los JSON conservan diagnósticos completos antes/después y la lista exacta de archivos.

Reproducción: [README.md](correcciones-evidencias/README.md). Resultados consolidados: [resultados-finales.json](correcciones-evidencias/resultados-finales.json). Huellas de entrega: [manifest-sha256.json](correcciones-evidencias/manifest-sha256.json).

## 11. Compatibilidad con Fases 1–4

Las reglas y servicios de pedidos, pago, conciliación, ajustes relativos, idempotencia de inventario, historial, notificaciones y plantillas no se modificaron. Las regresiones reales y las pruebas independientes volvieron a pasar. La protección de envío no altera `getShippingCost`, transportadoras efectivas, impuestos sin una petición explícita ni métodos de pago.

Se conservan las rutas `/admin/contenido?tab=...`, `/admin/marketing`, reseñas, imágenes, catálogo, inventario y las pestañas existentes. El vendedor conserva su shell y las restricciones de backend. No se añadieron dependencias, migraciones, índices o datos de backfill.

La comparación por hashes confirma que los únicos archivos ya existentes alterados desde el inicio son los seis señalados. Los cambios de Fase 5 y la auditoría que ya estaban en el árbol no se sobrescribieron.

## 12. Riesgos y observaciones pendientes

No se introdujo control de versiones multiactor en los endpoints de configuración ni una exclusión global entre sesiones. Los GET representan el estado observado en ese momento. La corrección protege el estado del formulario, evita escrituras desde datos no confiables y no repite automáticamente una escritura ambigua; no sustituye un protocolo futuro de concurrencia entre administradores.

Las respuestas que no cumplen el contrato se bloquean para edición hasta recuperarlas; no se reparan documentos históricos ni se normalizan datos de negocio mediante esta corrección. La mezcla interna de campos de footer y carrito dentro de Popup se conserva como observación de claridad, sin abordarla como un rediseño de Fase 6.

Persisten diagnósticos antiguos del cargador general de CMS y otros archivos fuera de alcance. No hubo prueba con lector de pantalla, certificación WCAG, subida real a Cloudinary, recepción de correo o proveedor de pagos.

Siguen pendientes externos de fases anteriores: topología transaccional, procedimiento del índice histórico de idempotencia, aceptación/entrega real de Resend y Wompi autorizado. No se validaron ni se actuó sobre ellos. Son distintos del defecto local F5-A01 y no se presentan como resueltos.

## 13. Estado para auditoría de cierre

**F5-A01 protegido y verificado en local; F5-B01, F5-B02 y F5-B03 corregidos dentro del alcance seguro.** Los resultados finales cumplen los casos ejecutados y están listos para que Cursor contraste el cierre definitivo.

No se declara cerrada Fase 5 por cuenta propia. No se comenzó Fase 6. No hubo producción, bases reales, `.env`, credenciales reales, correos/pagos reales, activación de comunicaciones externas, despliegues, migraciones productivas, commits ni pushes.
