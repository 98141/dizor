# Rediseño visual del checkout DIZOR

Trabajo local del **23 de noviembre de 2026**, conservando el checkout en una página, el catálogo/buscador nacional y los cambios previos de pasarela que ya estaban en el árbol.

## Resultado

- Fondo marfil `#fbf9f5` solo en la zona de compra, tarjetas blancas con borde continuo y radio de 16 px; campos y medios de pago de 10 px.
- Familia editorial de la tienda para títulos y Verdana/UI de DIZOR en formularios; texto y acción principal carbón `#1a1a1a`, arena `#f5c37b` en realces y ocre `#b87305` en detalles. Sin fuentes nuevas, sellos, banners ni textos comerciales añadidos.
- Pago seleccionable en toda su tarjeta: radio nativo marcado, fondo arena suave y borde ocre. Foco sólido de teclado, objetivos principales de 44 px o más e inputs de 16 px para móvil.
- Resumen conserva productos, variante, cantidad/precio, subtotal, Envío incluido y las autorizaciones originales. Total COP sobre fondo cálido, importe alineado a la derecha, botón de Wompi/contraentrega inmediatamente después y volver al carrito como enlace secundario.
- Escritorio: dos columnas próximas y alineadas por arriba, contacto más compacto. El resumen queda **en el flujo normal**, sin fijarlo ni limitar su altura; se puede alcanzar completo en pantallas bajas.
- Móvil: contacto → dirección → pago → resumen; espaciado más compacto. Las sugerencias envuelven nombres largos y tienen scroll interno. Su altura se ajusta a `visualViewport`; si falta sitio bajo el input, se desplaza lo necesario respetando el encabezado real.

## Superposiciones comprobadas

**WhatsApp: reproducida y corregida.** A 375 × 667, el flotante cubría el extremo derecho del botón principal y, en otras posiciones de scroll, parte de Dirección y de una opción de pago. Captura reproducible: `checkout-redesign/before/checkout-375-wa-check.png`. Las intersecciones se registran en `before/visual.json`.

El checkout reutiliza el contexto de WhatsApp que ya existe en la tienda: el flotante cede la esquina cuando su caja coincide con el formulario y vuelve al salir de esa zona. La comprobación final no registró intersecciones con los controles observados (`after/visual.json`). La página limpia ese contexto al desmontarse; no se cambió el componente global ni su comportamiento en otras páginas.

**Navegación: no se reprodujo una barra en mitad de la ventana.** Se recorrieron campos, municipio, autorizaciones y total con el encabezado real, en escritorio y móvil. El encabezado visible permaneció arriba: 60 px en móvil y 72/114 px en escritorio, según su estado compacto/completo. No se modificó el encabezado global. Su posición dentro de una imagen de página completa tomada tras desplazar no demuestra por sí sola una superposición en la ventana; las evidencias incluyen capturas de viewport y medidas DOM.

## Capturas antes y después

Se usan los mismos datos sintéticos, importe, municipio, dimensiones y puntos de captura. Las tomas del cierre esperan que termine la recotización antes de colocar el total. Las capturas completas parten del inicio de la página.

| Vista | Antes | Después |
| --- | --- | --- |
| 375 × 667, inicio | `checkout-redesign/before/checkout-375-top.png` | `checkout-redesign/after/checkout-375-top.png` |
| 375 × 667, sugerencias abiertas | `checkout-redesign/before/checkout-375-suggestions.png` | `checkout-redesign/after/checkout-375-suggestions.png` |
| 375 × 667, total y botón final | `checkout-redesign/before/checkout-375-total.png` | `checkout-redesign/after/checkout-375-total.png` |
| 1440 × 1000, inicio | `checkout-redesign/before/checkout-1440-top.png` | `checkout-redesign/after/checkout-1440-top.png` |
| 1440 × 1000, total | `checkout-redesign/before/checkout-1440-total.png` | `checkout-redesign/after/checkout-1440-total.png` |

También se incluyen `checkout-375-full.png` y `checkout-1440-full.png` en ambas carpetas, y las capturas de contraste `checkout-375-wa-check.png`.

La versión anterior se capturó antes de editar. Sus tres archivos de presentación se conservaron bajo `before/source/`, con manifest SHA-256, para poder repetir la captura en una copia temporal sin revertir el trabajo actual.

## Pruebas de interfaz

- **Next real + Chrome, diseño final: 6 comprobaciones aprobadas**, sin errores JavaScript, de hidratación ni solicitudes externas. Capturas de 375/1440, scroll del encabezado, ausencia de superposición de WhatsApp, radios 16/10, alturas táctiles, resumen en flujo normal, tarjeta de pago completa y compra contraentrega con doble envío → un pedido. Registro: `checkout-redesign-after.txt` y `checkout-redesign/after/next-navegador.json`.
- Se verifican además **320 × 568**, **375 × 320** y **1440 × 550**: nombres largos, lista dentro de la ventana, elección por teclado y sin desbordamiento horizontal. La ventana móvil reducida simula el espacio disponible con teclado abierto; no es una prueba en un iPhone físico ni una captura del teclado de iOS.
- **Regresión existente de checkout: 7 comprobaciones aprobadas**, con backend real temporal: invitado/cliente, municipio, foco/errores, direcciones guardadas, conservación de borradores, cambio de pago, doble clic, Wompi simulado con retorno pendiente y posterior evento verificado. Evidencia separada en `checkout-redesign/regresion/resultado.json`, sin sobrescribir las capturas de la tarea de municipios.
- **ESLint dirigido y comprobación de sintaxis: aprobados**. `git diff --check`: aprobado.

## Build

`npm run build`: **aprobado**, 50 páginas. Registro: `checkout-redesign-build.txt`. También se construyeron las copias aisladas de Next con `--webpack` para las capturas; sus resultados están en `before/build-fase7.json` y `after/build-fase7.json`.

Los procesos usan puertos loopback propios, MongoDB temporal, datos sintéticos, sin `.env` ni credenciales heredadas en las copias de Next. No se modificaron reglas de pedidos, pagos, precios, inventario o envío, ni se efectuaron cobros reales, despliegues o commits.

## Archivos de esta intervención

- `frontend/src/styles/pages/checkout.css`: tratamiento visual acotado a `.checkout-surface`.
- `frontend/src/app/(shop)/checkout/page.js`: contenedor visual y cesión de espacio del flotante usando el contexto existente.
- `frontend/src/components/checkout/MunicipalityCombobox.jsx`: adaptación del popup al viewport disponible.
- `frontend/test/checkout-visual-browser.cjs` y `test/helpers/checkoutVisualFlow.cjs`: capturas y verificación con Next real.
- `frontend/test/checkout-browser.cjs`: destino de evidencias configurable mediante `DIZOR_CHECKOUT_BROWSER_OUT`; conserva su destino predeterminado.

Para repetir las capturas: configurar las herramientas locales existentes (`MMS_DIR`, `MONGOMS_SYSTEM_BINARY`, `MONGOMS_RUNTIME_DOWNLOAD=false`), ejecutar desde `frontend` `node test/checkout-visual-browser.cjs` con `DIZOR_CHECKOUT_VISUAL_PHASE=before` o `after`. El modo `before` usa los archivos guardados, el modo `after` usa el árbol actual.
