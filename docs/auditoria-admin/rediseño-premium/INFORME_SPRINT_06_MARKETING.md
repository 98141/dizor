# Informe Sprint 06 — Marketing

Dirección visual: **Operativo Premium Híbrido**. Módulo: cupones, popup, newsletter y carritos abandonados.

No hubo commit, push, cambio de `.env`, base real, correo, pago, migración, índice ni activación de recordatorios.

## 1. Diagnóstico inicial

Los sprints 02 a 05 siguen en el repositorio (pedidos, productos, botones administrativos, tienda online). Marketing no se había recompuesto: seguía el layout de la fase 6.

Lo que mostraba el código y las capturas previas (`evidencias-sprint-04/antes-fase6/despues/marketing-*.png`):

- El popup ocupaba el ancho del contenido. Título, texto y retraso iban en filas completas. La pestaña activa era una pastilla negra.
- El pie de newsletter y la configuración histórica de carritos formaban parte del mismo formulario, a ancho completo y siempre desplegados.
- Newsletter y carritos vivían en una tarjeta de ancho completo. «Actualizar» y «Exportar» quedaban en filas distintas, con el aviso de privacidad entre medias.
- En cupones, el formulario «Nuevo cupón» compartía una rejilla de dos columnas con el listado. Sin registros, el formulario seguía siendo la masa principal.
- El guardado de popup, textos de pie y carrito histórico es un solo `PATCH`. `marketingPayload` elimina `abandonedCart.featureEnabled`. Esa atomicidad no se partió.
- F5-A01 ya estaba en `useConfirmedSettings` y `SettingsLoadState`: un fallo de lectura no monta el formulario. El sprint no reescribió esa máquina.
- La regresión A08 (`adminPolishInteractions.cjs`) rellena `#code` y `#value` y envía `form.admin-form` al entrar en `/admin/cupones`, y vuelve a comprobar que `#code` sigue montado y vacío después de crear. Ocultar el formulario rompe esa prueba.
- La navegación P11 exige exactamente cuatro enlaces en «Secciones de Marketing». P12 exige un `button.admin-btn--primary` deshabilitado en carritos. Los textos «Exportar newsletter (CSV)», «Exportar carritos (CSV)», «suscriptores activos (últimos 50)» y la frase de recordatorios desactivados se conservaron.

## 2. Cupones

La lista queda visualmente primero. El formulario sigue en el DOM, abierto y con `max-width: 40rem`, porque A08 tiene que poder escribir `#code` sin un clic previo y el campo debe seguir montado tras crear.

- Cabecera: «Cupones de descuento», el subtítulo existente y la cantidad real (`coupons.length`, la API devuelve la lista completa).
- Acción: «Crear primer cupón» si no hay registros y «Nuevo cupón» si los hay. Ambos enfocan `#code`.
- Vacío: «No hay cupones creados.»
- Filas: código, tipo y valor, usos (`usedCount` y `maxUses` si existe), vencimiento, Activo/Inactivo, Editar, Activar/Desactivar y Eliminar con la confirmación en la misma fila.
- Campos cortos en dos columnas desde 640 px: código y descripción, tipo y descuento, pedido mínimo y usos máximos. La fecha ocupa el ancho del formulario. En móvil, una columna.
- Validaciones, ids (`code`, `description`, `type`, `value`, `minOrderAmount`, `maxUses`, `expiresAt`) y el bloqueo del código al editar no cambiaron.
- Tras un alta correcta el formulario se vacía y se llama `form.reset()` para no dejar `:user-invalid` en los campos obligatorios. La referencia del formulario se guarda antes del `await`: después, `e.currentTarget` ya es nulo.

No se decidió si un cupón usado se libera al cancelar un pedido.

## 3. Popup

Un solo formulario, clase `mk-popup`, ancho máximo 48 rem. Tres grupos:

- **Configuración principal.** Activar, tipo de contenido, título junto a un retraso de ancho acotado, y texto a ancho del panel.
- **Imagen.** El campo existente de subida y URL. No se inventa previsualización si no hay imagen.
- **Pie de página.** Título y texto del newsletter del pie, en dos columnas. Siguen en el mismo submit.
- **Histórico de carritos.** `<details>` cerrado por defecto, resumen «Configuración histórica de carritos · desactivada». Los inputs `delayHours` y `maxReminders`, el checkbox y el aviso de recordatorios desactivados permanecen en el formulario. Contraerlos no los saca del payload, porque el guardado lee el estado de React.

El botón dominante sigue siendo «Guardar configuración». Hay una sola frase que recuerda que popup, pie y carritos históricos se guardan juntos.

## 4. Newsletter

Hoja de ancho máximo 48 rem.

- Título «Suscriptores» y el texto exacto «{n} suscriptores activos (últimos 50)». Esa cifra es la página devuelta, no un total global.
- «Actualizar suscriptores» y «Exportar newsletter (CSV)» en la misma fila. El aviso de datos personales queda debajo, una sola vez.
- Tabla con correo, nombre, fuente y fecha. En móvil, fichas con esas cuatro cifras. Un solo registro no estira la hoja al ancho de la ventana.

No hay métricas de crecimiento ni envío masivo.

## 5. Carritos

- Título «Carritos abandonados».
- «Actualizar carritos» y «Exportar carritos (CSV)» agrupados.
- La frase obligatoria permanece: «Recordatorios desactivados. La consulta histórica y la exportación siguen disponibles; no se enviarán recordatorios.»
- «Enviar recordatorios pendientes» sigue deshabilitado cuando `featureEnabled` es falso. Conserva la clase `admin-btn--primary` porque P12 la busca y comprueba que esté deshabilitado. El sistema de botones pinta un primario deshabilitado en neutro, no en negro.
- Cuando la configuración de marketing ya cargó, no se repite «Actualizar configuración de marketing» en esta pestaña. Si la carga falla o sigue en curso, el control de reintento vuelve a mostrarse.
- Tabla: correo, ítems, subtotal, recordatorios registrados y fecha. En móvil, la misma información en fichas.

No se habilitó, programó ni envió ningún recordatorio. No se escribió la configuración comercial.

## 6. Aprovechamiento del espacio

Las hojas de newsletter, carritos y popup usan `max-width` (48 rem; el listado de cupones, 64 rem; el formulario de cupón, 40 rem). La tabla es `width: 100%` dentro de esa hoja, así que el pulido que fuerza ancho completo no estira el registro hasta el borde de la ventana.

El espacio sobrante queda en el fondo marfil. No se añadieron gráficos.

En móvil (≤759 px) las pestañas de Marketing pasan a una sola fila con desplazamiento horizontal. Las tarjetas de tabla reducen el margen y el padding respecto al pulido general. No hay alturas fijas.

## 7. Componentes reutilizados

- `SettingsLoadState` y `useConfirmedSettings`, sin cambiar textos ni la máquina de estados.
- `DataExports` en modo embebido, con las mismas etiquetas y el mismo aviso de privacidad.
- `AuthFormField`, `AuthSubmitButton`, `CmsImageField`.
- Botones `admin-btn`, `admin-btn--primary`, `admin-btn--sm` y `admin-btn--danger`.
- Tokens ya definidos: grafito, marfil, blanco, oro `#B87305`, arena y borde `#E8E4DB`.
- Pestañas `mk-tab`, con el mismo tratamiento de la tienda online (fondo blanco, filete inferior oro) y especificidad por encima de la pastilla negra del pulido.

Los estilos nuevos viven en `admin-marketing.css` y cuelgan de `.mk-page`. La tienda pública no importa esa hoja. El layout de la tienda no referencia `admin-marketing`.

## 8. Archivos modificados

- `frontend/src/components/admin/ContentWorkspace.jsx`
- `frontend/src/app/admin/cupones/page.js`
- `frontend/src/styles/pages/admin-marketing.css`
- `frontend/test/sprint06-marketing-browser.cjs`
- Este informe y `docs/auditoria-admin/rediseño-premium/evidencias-sprint-06/`

## 9. Backend

No hubo cambios. Cupones sigue devolviendo la lista completa. Newsletter sigue limitado a 50 y carritos a 30. No se paginó, no se crearon índices y no se ejecutaron migraciones.

## 10. Compatibilidad F5-A01

Se comprobó en el navegador aislado:

- Un `GET` de marketing con error no monta `#popupTitle`.
- Se ve el error y «guardar está bloqueado», con «Reintentar configuración de marketing».
- El reintento recupera el título guardado («Aviso de taller» en el fixture).
- El submit sigue dentro del `fieldset` deshabilitado mientras no se puede editar.
- Los campos históricos siguen en el mismo formulario. No hay un segundo guardado.

No se reintrodujo un formulario vacío editable.

## 11. Permisos y privacidad

No se ampliaron roles ni rutas. Las exportaciones embebidas conservan alcance, etiquetas y el aviso «Contienen datos personales…». Los límites siguen en el componente (newsletter hasta 10.000, carritos hasta 5.000). El listado no añade campos de cliente que la API no entregaba ya.

## 12. Pruebas

Navegador aislado, sin Next, sin Mongo y sin red externa: `frontend/test/sprint06-marketing-browser.cjs`.

| Comprobación | Resultado |
| --- | --- |
| M01 Cupones vacíos, listado primero, un alta y un solo POST | ok |
| M02 Popup con fallo bloqueado, reintento y retraso en la misma fila que el título | ok |
| M03 Newsletter con uno y tres registros; el texto dice «últimos 50»; la hoja mide menos de 900 px | ok |
| M04 Carritos con uno y dos registros; el botón de recordatorios queda deshabilitado y no hay POST a recordatorios | ok |
| Sin desborde horizontal a 1440, 1024, 820, 390 y 360 en popup; cupones y newsletter también a 390 | ok |
| Cuatro enlaces en «Secciones de Marketing» | ok |
| El layout público no importa `admin-marketing` | ok |
| ESLint `--max-warnings 0` en los dos archivos de interfaz tocados | ok |
| `git diff --check` en los archivos del sprint | ok (aviso de fin de línea LF/CRLF, sin error) |

El fixture de marketing cumple `validMarketing`. Los correos son ficticios (`example.test`).

## 13. Regresión

No se modificaron aserciones de fases anteriores.

No se volvieron a ejecutar en este sprint las suites Next + Mongo de las fases 5, 6 y 7, ni el flujo completo `contentSettingsBrowserFlow` / `adminPolishInteractions` / `navigation-next-browser`. La protección se hizo conservando los contratos que esas pruebas leen: ids, textos, cuatro enlaces, formulario de cupón montado, `admin-btn--primary` deshabilitado en carritos y un solo payload de marketing.

Pedidos, pagos, inventario, reseñas y la tienda pública no se tocaron en este sprint.

## 14. Capturas

Antes (fase 6, sin rehacer): `docs/auditoria-admin/rediseño-premium/evidencias-sprint-04/antes-fase6/despues/marketing-popup-1440.png` y las parejas de newsletter y carritos. Ahí el popup es una columna a ancho de contenido y la pestaña activa es negra.

Después, en `evidencias-sprint-06/`:

- `cupones-vacio-1440.png`, `cupones-datos-1440.png`, `cupones-390.png`
- `popup-1440.png`, `popup-390.png`, `popup-360.png`, `popup-error-1440.png`
- `newsletter-uno-1440.png`, `newsletter-varios-1440.png`, `newsletter-390.png`
- `carritos-uno-1440.png`, `carritos-varios-1440.png`
- `navegador.json`

Revisión visual: el listado de cupones precede al formulario; el retraso ya no ocupa una fila propia; newsletter y carritos agrupan Actualizar y Exportar; un solo registro no estira la tabla al ancho de la ventana; el histórico de carritos llega contraído.

## 15. Responsive

Revisado en el mismo navegador: 1440, 1024, 820, 390 y 360. A 390 el formulario de cupón pasa a una columna, las pestañas caben en una fila con scroll y las tablas se convierten en fichas con `data-label`. No se ocultó contenido con `overflow: hidden` global. `overflow-wrap` en `.mk-page` es `break-word`, para no partir «Colección» letra a letra.

## 16. Accesibilidad

Se mantuvieron `label`/`htmlFor`, `aria-current` en la pestaña activa, `role="status"` y `role="alert"` del estado de carga, y el botón de recordatorios deshabilitado con texto visible. El resumen del histórico y las pestañas `mk-tab` tienen anillo de foco de 3 px. `prefers-reduced-motion` anula la transición de las pestañas. El orden de tabulación sigue el DOM: en cupones el formulario está después del listado en pantalla y también en el orden de lectura, porque el orden visual usa `order` de flex sobre el mismo flujo.

Esto no certifica WCAG 2.2 AA. No se auditó contraste con herramienta ni se recorrió el módulo completo solo con teclado fuera del navegador de prueba.

## 17. Defectos encontrados y corregidos

- El primer corte del popup dejó el retraso duplicado y la rejilla sin cerrar. Quedó un solo campo `delay` y el JSX cerrado.
- `className` en `AuthFormField` no llega al contenedor: el texto del popup se dejó fuera de la rejilla, a ancho del panel, en vez de pasar una clase que el componente ignora.
- `e.currentTarget.reset()` después del `await` lanzaba, el `catch` sustituía «Cupón creado correctamente» por un error falso y no recargaba la lista. Se guarda el formulario antes de la petición.
- En carritos, la frase de recordatorios compartía columna con los botones y se partía. Pasó a una fila propia, debajo del título y encima del aviso de privacidad.

## 18. Limitaciones

- El formulario de cupón no se oculta. A08 lo exige visible al entrar y montado después de crear. La lista va primero y el formulario queda acotado; no es un panel que se abra solo al pulsar «Nuevo cupón».
- El botón de recordatorios conserva `admin-btn--primary` por P12. Visualmente queda deshabilitado y neutro.
- No se ejecutaron las suites de regresión con Next y Mongo. Una auditoría independiente debería lanzarlas antes de dar por cerrado el sprint.
- No hay paginación nueva. Si hicieran falta más de 50 suscriptores o 30 carritos en pantalla, el contrato actual no lo permite sin cambio de API, y ese cambio quedó fuera.
- La previsualización de imagen depende del campo ya existente. Con URL vacía no se dibuja una imagen de relleno.

## 19. Recomendaciones para el siguiente sprint

1. Correr `adminPolishInteractions`, `contentSettingsBrowserFlow` y `navigation-next-browser` contra esta interfaz antes de la auditoría, sin relajar A08, A14, A15, A17, A24, P11 ni P12.
2. Si más adelante se quiere el formulario de cupón solo bajo demanda, hay que actualizar A08 en el mismo cambio: hoy el campo tiene que existir al primer pintado.
3. La política de liberar un cupón usado cuando se cancela el pedido sigue pendiente y no debe resolverse dentro de un sprint visual.
