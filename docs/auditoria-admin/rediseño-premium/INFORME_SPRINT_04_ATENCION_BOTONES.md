# Informe Sprint 04 — Atención al cliente y botones del administrador

Presentación Operativo Premium Híbrido para Atención al cliente y un sistema único de botones para el panel de administración y el del vendedor. No cambia permisos, endpoints ni la tienda pública.

Fecha de verificación: 24 de noviembre de 2026. Datos ficticios, limitados a los tipos y estados que ya registra el backend. Sin base real, sin correos y sin despliegue.

## 1. Diagnóstico visual anterior

Atención al cliente ya separaba solicitudes especiales y PQR, con búsqueda, filtros, detalle, cotización e historial. La presentación era plana: el vacío ocupaba poco más que un párrafo, las acciones se veían iguales y los estados no tenían jerarquía.

Los botones del administrador compartían un aspecto genérico. Primario, secundario, volver y eliminar se distinguían poco. El cambio de este sprint es solo visual y queda dentro de `.admin-shell .admin-main > main`.

Las capturas anteriores están en `docs/auditoria-admin/rediseño-premium/evidencias-sprint-04/antes/`.

## 2. Cambios de Atención al cliente

Cabecera única, encima de las pestañas:

**Atención al cliente**

“Gestiona solicitudes, personalizaciones y consultas de tus clientes.”

Las pestañas siguen siendo las del shell: Solicitudes especiales y PQR y datos personales. La activa usa borde dorado, igual que Pedidos y Productos. El vendedor no ve PQR: su título es Solicitudes especiales y `/admin/pqr` sigue fuera de su permiso.

No se fusionaron los dos procesos. Solicitudes usa sus endpoints de cotización y estado. PQR conserva radicado, categoría, motivo, notas pública e interna e historial.

## 3. Solicitudes especiales

Tipos reales: Personalización y Pedido al por mayor. Estados reales: Pendiente, En revisión, Cotizado, Aprobado, Completado, Rechazado y Cancelado.

Escritorio: tabla con número, tipo, cliente, estado, fecha y Ver solicitud. Si el registro trae producto, cantidad estimada o valor cotizado, se muestra como línea secundaria. El correo largo se corta con puntos suspensivos; el nombre largo puede partirse.

Móvil: la misma tabla pasa a fichas. Cada una muestra número, tipo, cliente, fecha, estado y Ver solicitud.

El vacío distingue cuatro casos: todavía no hay solicitudes, no hay coincidencias (con Limpiar filtros), error con reintento y carga. No se pintan datos de ejemplo en la aplicación.

El detalle agrupa referencia y estado, cliente, tipo y descripción, datos comerciales, historial y gestión. Actualizar estado es la acción primaria. Si el nuevo estado es Rechazado o Cancelado, ese botón pasa a la variante destructiva y avisa antes de cerrar. Guardar cotización es secundario. Volver es terciario y conserva `returnTo`. Las notas de gestión dicen que no se envían mensajes automáticos. Lo visible para el cliente y lo interno van marcados con texto, no solo con color.

## 4. PQR y datos personales

El listado muestra radicado, fecha, categoría, motivo y estado. El contacto no aparece en la tabla. Datos personales lleva su propia marca, con icono y el texto “Datos personales”, distinta de Consumo.

El detalle conserva descripción, historial, nota al solicitante y nota interna. Guardar cambio de estado es la acción primaria, con bloqueo de doble envío. Cerrar detalle es terciario.

Categorías y motivos salen de `customerRequestLabels`. No se añadieron tipos. Los plazos y el contrato del endpoint no se tocaron.

## 5. Componentes compartidos

- `AttentionUI.jsx`: cabecera, chips de estado y de categoría, fecha en America/Bogota.
- `AdminShell`: `pageHeader` se pinta antes de las pestañas de sección.
- `DashboardEmptyState` y `DashboardStateNotice` para vacío y error.
- `AdminFeedback` y `AdminConfirmModal` conservan su comportamiento. El modal usa los botones del sistema.

Los chips de estado repiten el nombre del estado. El color no es el único dato.

## 6. Sistema global de botones

`frontend/src/styles/layouts/admin-buttons.css` es la fuente visual. La cargan el layout de administración y el del vendedor, al final. No la carga la tienda.

El selector es `html .admin-shell .admin-main > main`. No alcanza el sidebar, la barra superior ni un `button` de la tienda. No fija anchos ni el orden de los módulos, para no reabrir el recorte de Editar y Eliminar en taxonomías.

Clases que entran en el sistema, sin cambiar los manejadores:

| Uso | Clases |
| --- | --- |
| Secundario | `.admin-btn`, `.op-btn`, `.dz-btn`, `button` sin clase |
| Primario | `--primary`, `.op-btn--primary`, `.dz-btn--primary`, `.auth-submit` |
| Terciario | `--tertiary`, `.dz-btn--ghost` |
| Destructivo | `--danger`, `.dz-btn--danger` |
| Compacto | `--sm`, `.op-btn`, `.dz-btn--sm` |

## 7. Variantes implementadas

- Primario: grafito `#252725`, texto blanco, radio de 8 px, hover casi negro.
- Secundario: blanco, borde `#d3cdc1`, texto grafito.
- Terciario: sin caja, subrayado, para Volver y acciones de baja jerarquía.
- Destructivo: texto e borde rojo discretos, fondo blanco. El hover tinta el fondo de rosa muy suave. No es un bloque rojo.
- Deshabilitado: gris cálido, cursor no permitido. Un primario deshabilitado deja de verse como botón negro.
- Procesando: `aria-busy="true"` conserva el texto en el árbol de accesibilidad y en el ancho del botón, y muestra un indicador. La protección contra doble clic sigue en cada componente.
- Foco: anillo de 3 px, visible sobre grafito y sobre blanco.
- Contraste medido en la suite: al menos 4,5:1.
- Movimiento reducido: el indicador de carga no gira.

En pantallas táctiles la altura compacta sube a 44 px.

## 8. Alcance transversal

El archivo aplica a Inicio, Alertas, Pedidos, Productos, Atención al cliente, Tienda online administrativa, Marketing, Finanzas, Usuarios, Configuración y Auditoría, porque todos viven dentro del shell. No se rediseñaron esas pantallas. Pedidos sigue usando `.op-btn` y el dashboard `.dz-btn`; ahora comparten altura, radio y color con `.admin-btn`.

La tienda pública no importa esta hoja. El vendedor sí, junto con la hoja premium del panel.

## 9. Archivos modificados

- `frontend/src/styles/layouts/admin-buttons.css`
- `frontend/src/styles/pages/admin-atencion.css`
- `frontend/src/styles/layouts/admin-premium.css` (cabecera y chips reutilizados)
- `frontend/src/components/admin/attention/AttentionUI.jsx`
- `frontend/src/components/admin/SpecialRequestsList.jsx`
- `frontend/src/components/admin/SpecialRequestDetail.jsx`
- `frontend/src/components/admin/AdminShell.jsx`
- `frontend/src/app/admin/solicitudes/page.js`
- `frontend/src/app/admin/pqr/page.js`
- `frontend/src/app/admin/layout.js`
- `frontend/src/app/vendedor/layout.js`
- `frontend/test/sprint04-atencion-browser.cjs`
- `frontend/test/helpers/sprint04Fixtures.cjs`

No hay cambios de backend, de `.env` ni de la tienda pública.

## 10. Pruebas

`frontend/test/sprint04-atencion-browser.cjs` compiló las páginas reales con Chrome y fixtures locales. Resultado: `passed: true`, sin errores de página ni peticiones externas. Cubre:

1. Listado con los dos tipos y los siete estados.
2. Filtros, búsqueda y limpieza.
3. Paginación Anterior / Siguiente.
4. Vacío, sin coincidencias, error y carga.
5. Detalle, historial, cotización y `returnTo`.
6. Cierre destructivo al elegir Cancelado o Rechazado.
7. Doble clic: una sola petición.
8. Vendedor sin PQR y con la gestión de solicitudes que el backend ya permitía.
9. PQR, datos personales, notas pública e interna, filtro vacío y error.
10. Texto al 200 % en 1280 y 390.
11. Botones primario, secundario, terciario, destructivo, deshabilitado y procesando.
12. Foco, hover, contraste y retorno de foco del diálogo.
13. 1440, 1024, 820, 390 y 360 sin desborde.

Los fixtures usan solo `customization`, `wholesale` y los estados de `specialRequestLabels`, y las categorías reales de PQR (`consumo`, `datos_personales`).

## 11. Responsive

Solicitudes, detalle, PQR, vista del vendedor y la muestra de botones se capturaron en 1440, 1024, 820, 390 y 360. En móvil la tabla de solicitudes es una ficha: referencia, tipo, cliente, fecha, estado y Ver solicitud. Los botones caben y no se tapan. La navegación del shell no se reemplazó.

## 12. Accesibilidad

Ver solicitud y Ver llevan el número o el radicado en el nombre accesible. El foco del detalle de PQR va al título al abrir. El diálogo devuelve el foco al cerrarse. Deshabilitado y procesando no se confunden. El estado no depende solo del color. Con movimiento reducido no hay animación de espera.

## 13. Capturas

| Carpeta | Contenido |
| --- | --- |
| `evidencias-sprint-04/antes/` | Presentación anterior, incluidas muestras de botones |
| `evidencias-sprint-04/despues/` | Solicitudes con datos y vacías, detalle, PQR, botones, móvil y escritorio |
| `despues/navegador-componentes.json` | Comprobaciones de la suite |

Piezas principales: `solicitudes-1440.png`, `solicitudes-390.png`, `solicitudes-vacias-1440.png`, `detalle-1440.png`, `pqr-1440.png`, `pqr-vacia-1440.png`, `pqr-detalle-datos-1440.png`, `botones-1440.png`, `botones-390.png`.

## 14. Regresiones

La suite de este sprint no modifica pruebas anteriores. Comprueba que el vendedor no entra a PQR, que un doble clic no duplica el guardado y que Volver conserva los filtros.

F6-I01 no se reabre desde esta hoja: no cambia `min-width` ni el `overflow` de la tabla de taxonomía. La comprobación completa de F6 con Next y Mongo no se repitió en esta pasada. La de catálogo y pedidos de los sprints anteriores tampoco, porque sus reglas de negocio no se editaron.

## 15. Limitaciones

- El formulario largo de producto, el detalle de pedido y el dashboard no se rediseñaron. Solo heredan el botón.
- La suite F6 con réplica de base no se volvió a ejecutar aquí.
- Un `button` fuera del `main` del shell, por ejemplo en el sidebar, conserva su estilo anterior a propósito.

## 16. Recomendaciones para el siguiente sprint

Conviene no crear otra familia de botones. Si una pantalla nueva necesita una acción, debe usar primario, secundario, terciario o destructivo. El grafito sólido debe quedar para una sola acción dominante por bloque.

El siguiente módulo puede repetir la cabecera compacta y las pestañas de Atención al cliente. Los estados que no ejecutan nada deben seguir siendo chips, no botones.
