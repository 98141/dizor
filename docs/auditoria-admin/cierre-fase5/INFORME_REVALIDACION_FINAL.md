# Revalidación independiente y cierre definitivo de la Fase 5

Fecha: 21 de noviembre de 2026.  
Rol: revisión de cierre. No se modificó código de aplicación, `.env`, bases reales, correos, pagos, migraciones ni el despliegue. No se crearon commits ni se inició la Fase 6.

Entorno aislado: MongoDB 8.3.2 en memoria, Next.js de producción en un directorio temporal con puerto propio, Express del fixture de pruebas y un administrador ficticio. Chrome sin red externa. Las evidencias están en `docs/auditoria-admin/cierre-fase5/revalidacion-evidencias/`.

## 1. Resumen ejecutivo

F5-A01 está resuelto en local. Un fallo de carga de Marketing ya no presenta un formulario vacío como si fuera válido, y Guardar no envía un PATCH ni borra la configuración real. Las observaciones F5-B01, F5-B02 y F5-B03 también quedaron verificadas. La regresión de las Fases 1 a 5 se reprodujo sin cambiar aserciones.

**Veredicto: PASS WITH BLOCKERS.**

El cierre funcional local de la Fase 5 queda concedido. La Fase 6 puede comenzar como siguiente trabajo local. El despliegue permanece pendiente de las condiciones externas ya registradas en las Fases 1 y 2: conjunto de réplicas, índice de idempotencia, Resend real y Wompi autorizado.

## 2. Correcciones revisadas

Se contrastaron el informe de auditoría, el cierre independiente, el informe de correcciones de Codex y las pruebas nuevas `backend/test/phase5-corrections.test.js`. Los archivos de aplicación revisados, sin editarlos, fueron `confirmedSettings.mjs`, `useConfirmedSettings.js`, `SettingsLoadState.jsx`, `ContentWorkspace.jsx`, `AdminShell.jsx`, `adminNavigation.mjs` y `settingsAdminController.js`.

| Hallazgo | Calificación |
| --- | --- |
| F5-A01 — guardado tras error de carga | CORREGIDA |
| F5-B01 — `aria-current` | CORREGIDA |
| F5-B02 — selección de exportaciones | CORREGIDA |
| F5-B03 — campos históricos de envío | CORREGIDA |

## 3. Resultado de F5-A01

**CORREGIDA.**

Configuración ficticia preparada por PATCH real: título «Promoción artesanal de temporada», descripción «Descubre nuestros productos elaborados en palma de iraca.» y popup activado.

La máquina de estado, en `revalidacion.test.js` (R-A01), dejó la base temporal intacta después de HTTP 500, caída de conexión, aborto, JSON inválido, respuesta incompleta y timeout. En todos esos pasos el estado fue `load-error`, `canSave` fue falso y el contador de escrituras permaneció en 0. El reintento recuperó el título real y habilitó el guardado. Una respuesta vieja conservó «Título reciente». El doble guardado produjo una sola escritura. Un HTTP 400 dejó el borrador visible, el título persistido intacto y un mensaje sin anuncio de éxito. Un 503 anterior a la aplicación quedó en `uncertain`, con `canSave` falso y sin reenvío automático. Una configuración legítimamente vacía sí pudo guardarse.

En Chrome, sobre Next y Express reales, cada fallo de carga mostró la alerta «Error al cargar configuración de marketing… guardar está bloqueado». Guardar permaneció deshabilitado. Se intentó además `requestSubmit` y, cuando el botón estaba dentro de un `fieldset` deshabilitado, un evento `submit`. El contador de PATCH fue 0 y Mongo conservó título, texto y `enabled: true` en los cinco fallos. La recarga posterior y el botón Reintentar restauraron el formulario. Un cambio de pestaña con una respuesta tardía e incompleta mantuvo el título real y dejó Guardar bloqueado. El doble clic, ya con el formulario recuperado, envió un solo PATCH y persistió «Edición válida de temporada». Tras recargar, Newsletter, Apariencia y el regreso a Popup, ese título seguía en la base. Un PATCH respondido con 500 mostró «El resultado del guardado no está confirmado. No se ha declarado éxito.» y no cambió el documento. En 390 px de ancho, el error de carga volvió a bloquear Guardar con el mismo documento intacto.

El timeout de 15 segundos se comprobó en la máquina de estado (R-A01 y la prueba C03 de Codex): la señal se aborta, el estado pasa a `load-error` y no hay escritura. En el navegador se ejecutó el aborto equivalente, junto con el intento de envío.

Evidencia: `revalidacion-resultados.json`, `navegador-revalidacion.json`, `popup-cargado.png`, `error-movil-390.png`. `pageErrors`, `hydrationErrors` y `externalRequests` quedaron vacíos. `passed` es verdadero. Dieciocho comprobaciones, todas correctas.

## 4. Resultado de F5-B01

**CORREGIDA.**

En Popup, el enlace del módulo Marketing usa `aria-current="location"`. El enlace Popup y la pestaña interna usan `aria-current="page"`. No apareció el valor `true`. Los recorridos reproducidos de navegación conservan estado activo, foco, submenús y el cajón móvil: 35 comprobaciones autenticadas y 10 recorridos independientes, ambos con `passed: true`, sin errores de página, hidratación ni peticiones externas.

La certificación con un lector de pantalla en vivo no se ejecutó. Los atributos verificables sí.

## 5. Resultado de F5-B02

**CORREGIDA.**

Los ámbitos del código son `orders`, `newsletter` y `carts`. Un ámbito ausente o desconocido, incluido `finance`, selecciona Marketing → Exportaciones históricas. Eso quedó cubierto por C24 y por el navegador:

| URL | Sección con `aria-current="page"` | Título | Botones |
| --- | --- | --- | --- |
| `tab=exports` | Exportaciones históricas | Exportaciones | pedidos, newsletter y carritos |
| `scope=orders` | Exportar pedidos (CSV) | Exportaciones de pedidos | solo pedidos |
| `scope=newsletter` | Newsletter | Exportaciones | solo newsletter |
| `scope=carts` | Carritos | Exportaciones | solo carritos |

La página sin ámbito muestra las tres exportaciones y no las presenta como filtradas. La de pedidos muestra únicamente su herramienta. Permisos, límites e implementación histórica de los CSV no se modificaron en esta revisión. El CSV de pedidos sigue siendo la exportación general ya documentada.

La miga de pan conserva la etiqueta de pestaña «Exportaciones» también cuando el título visible es «Exportaciones de pedidos». La selección activa y el contenido son coherentes. Queda como nota de claridad, de baja severidad.

## 6. Resultado de F5-B03

**CORREGIDA.**

Con la política de envío incluido vigente, un PATCH manipulado envió `shippingMode: fixed`, costo 1, departamento Antioquia y `carriers: ["nequi"]`, además de impuestos. Después de la operación, Mongo conservó `shippingMode: included`, costo histórico 15000 y transportadoras `interrapidisimo` y `servientrega`. C25 de Codex cubre el mismo rechazo de campos históricos, la conservación de impuestos y apariencia, y el 403 de un vendedor.

`GET /api/checkout/config` ofreció `wompi` y `contra_entrega`. Un pedido `nequi_manual` respondió 400 y no se creó. Un pedido contraentrega respondió 201. Nequi directo y manual siguen fuera de los métodos habilitados.

## 7. Verificación de formularios relacionados

Popup, Newsletter, carritos y Apariencia usan la misma máquina de confirmación. Una lectura fallida no se trata como lista vacía ni como apariencia editable: C20 deja Apariencia en `value: null` y rechaza el guardado; C21 acepta una apariencia explícitamente vacía y rechaza una apariencia parcial; C22 distingue filas no cargadas de una lista vacía legítima; C23 conserva el contrato de cupones. C08 confirma que el guardado no reenvía `abandonedCart.featureEnabled`.

En el navegador, Newsletter y Apariencia se abrieron y el regreso a Popup conservó «Edición válida de temporada». El texto de recordatorios sigue indicando que están desactivados y el botón de envío permanece inhabilitado mientras la función está apagada. No se activaron recordatorios ni notificaciones externas. `TRANSACTIONAL_NOTIFICATIONS_ENABLED` permaneció en falso en el fixture.

El cargador de inicio, páginas y banners sigue en su `catch` anterior y muestra «Error al cargar contenido CMS». Codex no lo migró. Esta revalidación no ejecutó un guardado sobre ese cargador, así que no se declara corregido ni como regresión nueva.

## 8. Pruebas nuevas

| Prueba | Resultado | Duración |
| --- | --- | --- |
| `phase5-corrections.test.js`, C01–C25 | 31/31 | 13739.4282 ms |
| `revalidacion.test.js`, R-A01 y R-B03 | 2/2 | 13089.7608 ms |
| `navegador-revalidacion.cjs` | 18/18, `passed: true` | recorrido completo, salida 0 |

Las aserciones de Codex no se modificaron. Los primeros intentos del recorrido propio fallaron por esperas del propio script: texto leído fuera del valor del input, selección incompleta del campo, una variable de Node usada dentro de la página y una comparación de mayúsculas. Esos intentos no son defectos del producto. El JSON publicado corresponde a la ejecución que terminó en salida 0.

## 9. Regresión general

Se reprodujeron, con el gancho que desvía las escrituras para no pisar las evidencias originales:

| Suite | Resultado | Duración |
| --- | --- | --- |
| Node de Fases 1 a 5, incluidas las 5 pruebas independientes previas | 252/252, 0 fallos | 155096.5386 ms |
| Correcciones de Fase 5 | 31/31 | 13739.4282 ms |
| Revalidación R-A01 y R-B03 | 2/2 | 13089.7608 ms |
| Navegador de comunicaciones, pedidos y catálogo | 8 + 20 + 20, todas correctas | — |
| Next autenticado | 35/35 | — |
| Recorridos independientes previos | 10/10; el título real permaneció | — |
| Next de las correcciones | 25/25 | — |
| Recorrido propio de Marketing | 18/18 | — |

Total Node de esta revalidación: 285/285. Total de comprobaciones de navegador: 136, sin errores de página ni peticiones externas en las suites autenticadas.

Pedidos, Wompi, contraentrega, inventario, comunicaciones, tablero, bandejas, navegación por roles, tienda, Marketing, exportaciones, permisos y rutas históricas quedaron cubiertos por esas suites. Compilar no se usó como sustituto de las pruebas funcionales.

## 10. Resultados de navegador

Next de producción, Express, Mongo temporal, sesión de administrador y datos ficticios de Marketing. Puertos propios. Escritorio 1440×900 y móvil 390×844.

El recorrido abrió Marketing, cargó Popup, simuló los fallos de carga, impidió el guardado, recuperó con Reintentar, editó, guardó una sola vez, recargó, comprobó la persistencia, visitó Newsletter y Apariencia, volvió a Popup y confirmó el documento. Después recorrió las cuatro URLs de exportaciones y repitió el error de carga en móvil.

No hubo solicitudes a orígenes externos. No hubo errores de página ni de hidratación en la ejecución final. Capturas: `popup-cargado.png` y `error-movil-390.png`.

## 11. Sintaxis, lint y build

| Comprobación | Resultado |
| --- | --- |
| Sintaxis de 8 archivos | 0 fallos |
| ESLint Node | 0 errores, 0 advertencias |
| ESLint frontend | 1 error y 2 advertencias, iguales a la línea base |
| Mensajes nuevos | ninguno |
| `next build --webpack` aislado | compiló en 19.5 s y generó 50 páginas estáticas |
| `git diff --check` | salida 0; solo avisos de `LF`/`CRLF` por `autocrlf` |

El error preexistente es `react-hooks/set-state-in-effect` en el `useEffect` del cargador CMS de `ContentWorkspace.jsx`, línea 238. Las dos advertencias preexistentes son `@next/next/no-img-element` y `react-hooks/exhaustive-deps` en el mismo archivo. No pertenecen a la máquina nueva de confirmación.

## 12. Defectos nuevos

No se detectó un defecto funcional nuevo. Los cuatro intentos fallidos del navegador propio se corrigieron en el script de evidencia y la repetición terminó en salida 0, con la base temporal conservada en cada fallo de carga.

## 13. Observaciones menores pendientes

- El cargador CMS de inicio, páginas y banners conserva su manejo anterior y muestra «Error al cargar contenido CMS». Queda pendiente de baja severidad. No formaba parte de la corrección verificada.
- El formulario de Popup sigue mostrando, en la misma ficha, campos de newsletter y de carrito abandonado. Es una nota de claridad, no un fallo de la protección de guardado.
- La miga de pan de una exportación de pedidos dice «Exportaciones» mientras el título de la sección dice «Exportaciones de pedidos». La sección activa y el único botón coinciden con pedidos.
- No hubo sesión con lector de pantalla. Los valores `page` y `location` sí se comprobaron.

Ninguna de estas notas reabre F5-A01 ni las observaciones B01, B02 y B03.

## 14. Validaciones externas pendientes

Siguen pendientes, y son ajenas a este cierre local:

- topología con conjunto de réplicas;
- procedimiento del índice histórico de idempotencia;
- entrega real con Resend y buzón;
- Wompi en el entorno autorizado.

Nequi directo y manual permanecen desactivados. Las notificaciones transaccionales permanecen apagadas. No se ejecutaron migraciones ni pagos reales.

## 15. Veredicto final

**PASS WITH BLOCKERS.**

F5-A01 quedó cerrada con evidencia reproducible: después de un error de carga no se envía un guardado y la información real permanece. F5-B01, F5-B02 y F5-B03 quedaron corregidas dentro de su alcance. La regresión local de las Fases 1 a 5 se mantiene.

Cierre funcional local de la Fase 5: concedido. La Fase 6 puede iniciarse en local.

Autorización de despliegue: pendiente de las condiciones externas de las Fases 1 y 2. Esta revalidación no las convierte en resueltas y no despliega nada.
