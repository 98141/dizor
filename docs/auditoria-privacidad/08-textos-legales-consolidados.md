# H. Textos legales consolidados — DIZOR

> **Documento interno.** Reproduce el texto **exacto** que verá el cliente en la versión local preparada el 2026-11-16 (fase 3). Las páginas se extrajeron del HTML generado por el build aislado, y las casillas de `backend/src/config/legalTexts.js`; por eso coinciden con lo publicado y con lo que queda registrado como evidencia.
> Estado: textos `published` y **vigentes por decisión del propietario (2026-11-20)**; los ajustes futuros los hace él directamente (subiendo la versión). Sin aprobación de un abogado. Política de privacidad v3 y de cookies v4: se quitó la palabra "opcional" sin cambiar el tratamiento (siguen requiriendo permiso).

## Reglas de versión y vigencia

- Cada casilla registra la **versión** del texto aceptado (`ConsentRecord.textVersion`) y, en los pedidos, `Order.legal.privacyNoticeVersion` y `termsVersion`.
- Si cambia una sola palabra de una casilla, se sube su versión en `legalTexts.js`. Si cambia una página, se sube su versión en `frontend/src/lib/businessInfo.js` (`LEGAL_DOCS`).
- La línea "Vigente desde …" **no aparece** hasta que se defina `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE` al publicar. No se usó la fecha de edición local como fecha de vigencia.
- Las autorizaciones obtenidas en la fase 1 con la marca "Texto en revisión" (versión `2026-11-16-draft-1`) **no** se regularizan.

## 1. Casillas de autorización y aceptación

Ninguna viene marcada. Las obligatorias impiden enviar el formulario si no se marcan, y el servidor exige `true`.

| Formulario | Finalidad | Versión | Tipo | Texto exacto |
|---|---|---|---|---|
| Checkout: tratamiento para gestionar el pedido | `order_processing` | 3 | Obligatoria | Autorizo a DIZOR a usar mis datos para gestionar mi pedido. *(enlace: «Ver política»)* |
| Checkout: aceptación de términos | `terms` | 2 | Obligatoria | Acepto los Términos y condiciones de compra. *(enlace: «Ver términos»)* |
| Registro de cuenta y registro opcional tras la compra | `account` | 3 | Obligatoria | Autorizo a DIZOR a usar mis datos para crear y administrar mi cuenta. *(enlace: «Ver política»)* |
| Encargos personalizados y pedidos por mayor | `special_request` | 3 | Obligatoria | Autorizo a DIZOR a usar mis datos para responder y cotizar mi solicitud. *(enlace: «Ver política»)* |
| Reseñas de producto | `review_publication` | 3 | Obligatoria | Autorizo publicar mi nombre, ciudad, calificación y comentario si la reseña se aprueba. *(enlace: «Ver política»)* |
| PQR y solicitudes sobre datos personales | `customer_request` | 3 | Obligatoria | Autorizo a DIZOR a usar mis datos para atender esta solicitud. *(enlace: «Ver política»)* |
| Newsletter (pie de página, inicio y ventana emergente) | `marketing_newsletter` | 4 | Opcional | Quiero recibir novedades y ofertas de DIZOR por correo. *(enlace: «Ver política»)* |
| Recordatorio de carrito (función desactivada: no se muestra) | `marketing_cart_reminder` | 4 | Opcional | Quiero recibir un recordatorio de este carrito por correo. *(enlace: «Ver política»)* |

## 2. Identificación del vendedor (pie de página de todas las páginas públicas)

> DIZOR es una marca de COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS · NIT 901.027.825-5
> Domicilio registrado: CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia · dizorsandona@gmail.com · Atención: lunes a viernes, en horario laboral

Enlaces del bloque "Información": Envíos y entregas · Garantías, retracto y devoluciones · Términos y condiciones · Política de privacidad · Política de cookies · Peticiones, quejas y reclamos (solo cuando el canal esté activo) · Superintendencia de Industria y Comercio (SIC).

## 3. Textos del proceso de compra

| Lugar | Texto |
|---|---|
| Carrito y checkout, fila de envío | "Envío: Incluido en el precio" |
| Checkout, medios de pago | "Tarjeta, PSE y otros medios (Wompi)" — "Pago en línea a través de Wompi"; "Pago contra entrega" — "Pagas al recibir tu pedido" |
| Checkout, transportadoras | "Inter Rapidísimo", "Servientrega" |
| Checkout, plazo de entrega | **No se muestra** mientras el plazo no esté definido (07 J-8). Cuando se defina, aparecerá en el resumen antes de confirmar y se guardará con el pedido |
| Respuesta a un cliente antiguo que intente Nequi | "Este método de pago no está disponible. Recarga la página y elige Wompi o pago contra entrega." |
| Confirmación de pedidos históricos Nequi pendientes | "Este pedido se registró con un medio de pago que ya no ofrecemos. No realices transferencias por tu cuenta: escríbenos indicando el número de pedido y te indicaremos cómo continuar." |

## 4. Correos transaccionales

**Acuse de recibo del pedido** (asunto: "Recibimos tu pedido {número} — Dizor"): número y fecha del pedido; tabla de productos con cantidad, precio unitario y subtotal; subtotal, descuento, IVA (si aplica), "Envío: Incluido en el precio" y total; forma y estado del pago; "Tiempo de entrega: te lo confirmaremos por este medio." (mientras no haya plazo definido); en contraentrega: "Pagarás el total al recibir el pedido. Hasta entonces el pago figura como pendiente."; contacto: "Si tienes una duda o una solicitud sobre este pedido, escríbenos a dizorsandona@gmail.com indicando el número de pedido (atención: lunes a viernes, en horario laboral)."; pie: "Vendedor: COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS (DIZOR), NIT 901.027.825-5. Mensaje transaccional sobre tu compra."

**Constancia de PQR** (asunto: "Radicado {radicado} — Dizor"): radicado, fecha y hora de recepción (hora de Colombia) y código de consulta; "La recepción por el sitio es permanente; la atención personal es de lunes a viernes, en horario laboral. Si necesitas añadir información, escríbenos a dizorsandona@gmail.com indicando tu radicado."; pie con razón social y NIT.

## 5. Páginas públicas

Nota: los enlaces al formulario de PQR que aparecen en algunas páginas solo se muestran cuando el canal esté activo (`NEXT_PUBLIC_PQR_ENABLED=true`). Este texto se extrajo de un build de pruebas con el canal activo; sin él, esas frases terminan en el correo electrónico.

---

<!-- Ruta: /terminos-y-condiciones -->

## Términos y condiciones de compra

Condiciones que aplican a las compras realizadas en este sitio. Antes de confirmar tu pedido te pediremos aceptarlas.

Versión 1

### 1. Quién vende

DIZOR es una marca de COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS, NIT 901.027.825-5, con domicilio registrado en CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia. Esta sociedad es quien vende los productos y emite la factura.

- Correo: dizorsandona@gmail.com
- WhatsApp: +57 315 916 2520
- Atención personal: lunes a viernes, en horario laboral.

### 2. Alcance

Vendemos y entregamos únicamente dentro de Colombia. Estos términos aplican a las compras hechas en este sitio; la versión que aceptas queda registrada con tu pedido.

### 3. Productos

Nuestros productos son elaborados a mano. Por eso pueden presentar pequeñas variaciones de tono, tejido o medida entre una pieza y otra, propias del trabajo artesanal; esas variaciones no son un defecto. Las fotografías y descripciones buscan mostrar el producto de la forma más fiel posible.

Distinguimos tres situaciones, que tienen efectos distintos sobre el derecho de retracto (ver Garantías, retracto y devoluciones):

- Variante de catálogo: eliges talla, color u otra opción entre las que ofrece la ficha del producto. Es un producto estándar.
- Producto que admite personalización: su ficha muestra la opción "Solicitar personalización" (por ejemplo, pines, color de cinta, o colores y tejidos en bolsos y sombreros). Si lo compras tal como aparece en el catálogo, sigue siendo un producto estándar.
- Producto personalizado: el que fabricamos o modificamos según especificaciones particulares que nos pides a través de "Solicitar personalización". Te enviamos una cotización con el detalle de lo acordado, en la que te indicamos que se trata de un producto personalizado, antes de que confirmes el encargo.

### 4. Precios

Los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables. El valor del envío también está incluido en el precio de cada producto: no se cobra un cargo adicional por envío. El precio que pagas es el que aparece en el resumen del pedido antes de confirmarlo.

### 5. Cómo se hace un pedido

1. Agregas los productos al carrito y revisas cantidades y variantes.
2. Indicas tus datos de contacto y la dirección de entrega en Colombia.
3. Eliges el medio de pago.
4. Revisas el resumen: productos, cantidades, precio unitario, subtotal y total. Puedes volver atrás para corregir cualquier dato.
5. Aceptas estos términos y autorizas el tratamiento de tus datos para gestionar el pedido, y confirmas.
6. Te mostramos el número de pedido y te enviamos por correo un acuse de recibo con el detalle de la compra.

### 6. Medios de pago

- Wompi: pago en línea con los medios que Wompi ofrece en su página de pago (por ejemplo, tarjeta, PSE o Nequi). El pago se entiende confirmado cuando Wompi nos notifica que fue aprobado; volver a nuestro sitio desde la pasarela no basta para confirmarlo.
- Pago contra entrega: pagas al recibir el pedido. Hasta ese momento el pedido figura con pago pendiente.

No te pediremos transferencias a cuentas personales ni comprobantes de pago por WhatsApp. Si recibes una solicitud así a nombre de DIZOR, no la atiendas y escríbenos a dizorsandona@gmail.com.

### 7. Envíos y entregas

Las condiciones de envío, las transportadoras y lo que ocurre ante un retraso o un problema en el transporte están en Envíos y entregas.

### 8. Garantía, retracto, reversión del pago y cambios

Son cuatro figuras distintas y las explicamos por separado en Garantías, retracto y devoluciones. Ninguna condición de estos términos limita los derechos que la ley te reconoce como consumidor.

### 9. Atención, peticiones, quejas y reclamos

Puedes escribirnos a dizorsandona@gmail.com o usar el formulario de peticiones, quejas y reclamos, que te entrega un número de radicado con fecha y hora para hacer seguimiento. También puedes escribirnos por WhatsApp. La atención personal es de lunes a viernes, en horario laboral.

### 10. Datos personales

El tratamiento de tus datos se rige por la Política de Tratamiento de Datos Personales y el uso de cookies por la Política de Cookies.

### 11. Cambios a estos términos

Podemos actualizar estos términos. Cada pedido se rige por la versión que aceptaste al confirmarlo.

### 12. Ley aplicable y autoridad

Estas condiciones se rigen por las leyes de Colombia, en especial el Estatuto del Consumidor (Ley 1480 de 2011). La autoridad de protección al consumidor es la Superintendencia de Industria y Comercio.

---

<!-- Ruta: /garantias-y-devoluciones -->

## Garantías, retracto y devoluciones

Garantía, retracto, reversión del pago y cambios voluntarios son figuras distintas. Aquí te explicamos cada una y cómo solicitarla.

Versión 1

### Cómo hacer cualquier solicitud

Para cualquiera de estos trámites, escríbenos a dizorsandona@gmail.com, usa el formulario de peticiones, quejas y reclamos o por WhatsApp, indicando tu número de pedido y lo que solicitas. Puedes usar el canal que prefieras: ninguno es obligatorio frente a los demás. Te pediremos solo la información necesaria para identificar el pedido y entender la situación; no exigimos video, factura impresa ni empaque original como condición para atender tu solicitud.

La atención personal es de lunes a viernes, en horario laboral. Si debes enviarnos un producto, te indicaremos la dirección y la forma de envío antes de que lo despaches.

### 1. Garantía legal

Respondemos por la calidad, idoneidad, seguridad y buen estado de los productos que vendemos, incluidos los que compres en promoción o con descuento, durante el término de garantía legal, que se cuenta desde la entrega (Ley 1480 de 2011, arts. 7 y 8).

- Si el producto presenta un defecto, te ofreceremos su reparación sin costo y, cuando corresponda según la ley, su cambio por otro igual o la devolución del dinero.
- Los costos de transporte asociados a la garantía corren por nuestra cuenta.
- Las variaciones propias del trabajo artesanal (pequeñas diferencias de tono, tejido o medida) no son defectos. El desgaste por uso normal y los daños por uso indebido no están cubiertos por la garantía.

### 2. Producto equivocado o dañado en el transporte

Si recibes un producto distinto al que pediste, o llega dañado por el transporte, nosotros asumimos los costos de recogerlo y de enviarte el producto correcto o en buen estado. No necesitas reclamar a la transportadora: nosotros gestionamos el caso con ella. Este derecho no se limita a un plazo de pocos días; te recomendamos avisarnos tan pronto lo notes para resolverlo más rápido.

### 3. Derecho de retracto

Por ser una compra a distancia, puedes retractarte dentro de los cinco (5) días hábiles siguientes a la entrega del producto, sin indicar el motivo (Ley 1480 de 2011, art. 47).

1. Avísanos dentro de ese plazo por cualquiera de los canales indicados.
2. Devuelve el producto por los mismos medios y en las mismas condiciones en que lo recibiste. Los costos de transporte de la devolución corren por tu cuenta.
3. Te devolveremos la totalidad del dinero pagado, sin descuentos ni retenciones, en un plazo máximo de quince (15) días calendario desde que ejerciste el derecho.

Productos personalizados. El retracto no aplica a los productos confeccionados conforme a tus especificaciones o claramente personalizados (art. 47, num. 3), es decir, los encargos que acordamos contigo mediante "Solicitar personalización". Elegir talla, color u otra variante del catálogo no convierte el producto en personalizado, y tampoco lo hace que el producto sea artesanal o que admita personalización si lo compraste tal como aparece en el catálogo. La garantía legal aplica también a los productos personalizados.

### 4. Reversión del pago

Si pagaste en línea con tarjeta u otro instrumento de pago electrónico (por ejemplo, a través de Wompi), puedes solicitar la reversión del pago cuando hayas sido objeto de fraude, la operación no haya sido solicitada, no hayas recibido el producto, el producto entregado no corresponda a lo que pediste o esté defectuoso (Ley 1480 de 2011, art. 51).

1. Preséntanos la queja dentro de los cinco (5) días hábiles siguientes a la fecha en que tuviste noticia de la situación.
2. En el mismo plazo, informa al emisor de tu tarjeta o instrumento de pago para que reverse la transacción.
3. Cuando corresponda, devuélvenos el producto; te indicaremos cómo.

Si pagaste contra entrega, puedes usar la garantía, el retracto o las demás opciones de esta página.

### 5. Cambios voluntarios de talla

Si recibiste el producto correcto y en buen estado pero quieres otra talla, puedes solicitarnos el cambio. En ese caso, los costos de transporte del cambio corren por tu cuenta. Si la talla que necesitas no está disponible, te informaremos las alternativas.

Este cambio es una opción adicional que te ofrecemos: no reemplaza ni limita la garantía, el retracto ni la reversión del pago. Si el producto llegó equivocado o con un defecto, aplican las secciones 1 y 2, y no asumes ningún costo.

---

<!-- Ruta: /pagina/envios -->

## Envíos y entregas

Cobertura nacional, transportadoras y envío incluido en el precio.

Versión 1

### Cobertura

Vendemos y enviamos únicamente dentro de Colombia, con cobertura nacional.

### Transportadoras

Enviamos tus pedidos con Inter Rapidísimo o Servientrega. Cuando despachamos el pedido, te informamos la transportadora y el número de guía para que puedas seguirlo.

### Costo del envío

El valor del envío ya está incluido en el precio de cada producto. No se cobra un cargo adicional por envío en el checkout.

### Retrasos e incidencias en el transporte

- Si tu pedido se retrasa, se pierde o llega dañado, escríbenos: somos tu canal para resolverlo y nosotros gestionamos el caso con la transportadora. No necesitas reclamarle directamente.
- Si no podemos entregar en el plazo acordado, te avisaremos. Podrás ejercer los derechos que te reconoce la ley, incluida la terminación de la compra con la devolución del dinero cuando proceda.
- Solo los hechos de fuerza mayor o caso fortuito, en los términos de la ley y debidamente verificables, pueden justificar un retraso.

### Productos dañados o equivocados

Si recibes un producto equivocado o dañado por el transporte, los costos de la solución corren por nuestra cuenta. Consulta Garantías, retracto y devoluciones.

### Contacto

Escríbenos a dizorsandona@gmail.com indicando tu número de pedido. Atención: lunes a viernes, en horario laboral.

---

<!-- Ruta: /politica-de-privacidad -->

## Política de Tratamiento de Datos Personales

Qué datos personales tratamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos.

Versión 2

### 1. Responsable del tratamiento

- COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS, titular de la marca DIZOR.
- NIT 901.027.825-5.
- Domicilio registrado: CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia.
- Correo: dizorsandona@gmail.com · WhatsApp: +57 315 916 2520

### 2. Qué datos tratamos y para qué

Solo pedimos los datos necesarios para cada trámite. Cada formulario te muestra, antes de enviarlo, la finalidad concreta y te pide tu autorización.

| Tratamiento | Datos | Finalidad |
|---|---|---|
| Compras | Nombre, correo, teléfono, dirección de entrega, ciudad, departamento y notas del pedido. | Confirmar, cobrar, facturar, preparar y entregar tu pedido; enviarte el acuse de recibo y los avisos del pedido; atender garantías, retractos, reversiones y cambios. |
| Cuenta de cliente | Nombre, correo, contraseña (guardada cifrada), teléfono, direcciones, favoritos e historial de pedidos. | Crear y administrar tu cuenta y mostrarte tus pedidos. |
| Encargos personalizados y pedidos por mayor | Datos de contacto, empresa (si la indicas) y detalles de la solicitud. | Responder y cotizar tu solicitud. |
| Reseñas | Nombre que indiques, ciudad (si la indicas), calificación y comentario. | Publicar la reseña en el sitio, solo si la apruebas al enviarla y tras su revisión. |
| Peticiones, quejas, reclamos y solicitudes sobre tus datos | Datos de contacto, número de pedido (si aplica) y la descripción de la solicitud. | Registrar, tramitar y responder la solicitud, y conservar su trazabilidad. |
| Novedades por correo | Correo y, si lo indicas, tu nombre. | Enviarte novedades y ofertas, solo si lo autorizas. Puedes darte de baja cuando quieras. |
| Prueba de tus autorizaciones | Finalidad autorizada, versión del texto aceptado, fecha, formulario de origen y correo. | Demostrar cuándo y para qué diste tu autorización, y respetar tus bajas y revocaciones. |
| Seguridad del sitio | Dirección IP, navegador y páginas solicitadas (registros técnicos del servidor). | Operar el sitio, prevenir abusos y diagnosticar errores. |

No pedimos datos sensibles ni datos de niñas, niños o adolescentes. Te pedimos no incluirlos en notas, reseñas o solicitudes.

El sitio no usa analítica de terceros ni publicidad personalizada. Las estadísticas propias de visitas solo se activan si las aceptas; el detalle está en la Política de Cookies.

### 3. Con quién compartimos tus datos

No vendemos tus datos. Los compartimos únicamente con los proveedores que nos prestan los servicios necesarios para operar la tienda, y solo en la medida necesaria para cada servicio:

- HostingLabs (cPanel): Alojamiento del sitio y del servidor de la tienda.
- MongoDB Atlas: Base de datos de la tienda.
- Servicio de envío de correos transaccionales: Envío del acuse de recibo, avisos del pedido y respuestas.
- Servicio de alojamiento de imágenes: Publicación de las imágenes de los productos.
- Wompi: Procesamiento de pagos en línea. Los datos de tu tarjeta o cuenta los ingresas directamente en Wompi; DIZOR no los recibe ni los guarda.
- Inter Rapidísimo o Servientrega: Transporte y entrega del pedido (nombre, dirección y teléfono de entrega).

Algunos de estos proveedores pueden almacenar o procesar información fuera de Colombia. Puedes pedirnos información sobre el proveedor y el lugar en que se tratan tus datos por los canales del punto 5.

Si nos escribes por WhatsApp, esa conversación se rige además por las condiciones de ese servicio.

### 4. Tus derechos

De acuerdo con la Ley 1581 de 2012, puedes:

- Conocer, actualizar y rectificar tus datos personales.
- Solicitar prueba de la autorización que nos diste.
- Ser informado sobre el uso que damos a tus datos.
- Revocar tu autorización o pedir la supresión de tus datos, salvo cuando exista un deber legal o contractual de conservarlos (por ejemplo, la información de una compra que debemos guardar por obligaciones contables, tributarias o de garantía).
- Acceder gratuitamente a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio después de haber agotado el trámite ante nosotros.

Darte de baja de las novedades por correo es inmediato desde el enlace incluido en cada mensaje y no afecta tus compras.

### 5. Cómo ejercer tus derechos

1. Escríbenos a dizorsandona@gmail.com o usa el formulario de solicitudes (categoría "Solicitud sobre mis datos personales"), indicando tu nombre, el correo con el que te registraste o compraste y lo que solicitas.
2. Si es necesario, te pediremos información adicional para verificar tu identidad antes de entregar o modificar datos.
3. Responderemos las consultas en un máximo de diez (10) días hábiles, prorrogables hasta cinco (5) días hábiles más, y los reclamos en un máximo de quince (15) días hábiles, prorrogables hasta ocho (8) días hábiles más. Si necesitamos la prórroga, te informaremos el motivo.

Atiende estas solicitudes el equipo de atención al cliente de DIZOR, de lunes a viernes, en horario laboral. Los mensajes que recibamos fuera de ese horario se tramitan el siguiente día hábil.

### 6. Conservación y seguridad

Conservamos los datos mientras sean necesarios para la finalidad para la que se recogieron y para cumplir obligaciones legales o contractuales, como las contables, tributarias, de garantía y de atención de reclamos. Aplicamos medidas técnicas y organizativas para protegerlos, como conexiones cifradas, contraseñas cifradas y acceso restringido al panel de administración.

### 7. Cambios a esta política

Si cambiamos esta política, publicaremos la nueva versión en esta página con su número de versión. Si el cambio afecta las finalidades para las que nos diste tu autorización, te la pediremos de nuevo.

---

<!-- Ruta: /politica-de-cookies -->

## Política de Cookies

Qué cookies y almacenamiento del navegador usa este sitio y para qué.

Versión 3

### ¿Qué son?

Las cookies y mecanismos equivalentes (almacenamiento local y de sesión del navegador) guardan pequeñas piezas de información en tu dispositivo para recordar datos entre páginas o visitas, como el contenido de tu carrito.

### Necesarias para el funcionamiento

Se usan para prestarte el servicio que solicitas (carrito, sesión, compra). No requieren que aceptes nada en el aviso de cookies.

| Nombre | Tipo | Finalidad | Duración |
|---|---|---|---|
| accessToken | Cookie (servidor de la API, httpOnly) | Mantener tu sesión iniciada. | 15 minutos |
| refreshToken | Cookie (servidor de la API, httpOnly) | Renovar la sesión sin pedirte la contraseña. | 7 días |
| dizor_cart_v1, dizor_coupon_v1 | Almacenamiento local | Recordar tu carrito y el cupón aplicado. | Hasta que vacíes el carrito o borres los datos del navegador |
| dizor_pending_popup_coupon | Almacenamiento local | Aplicar en el carrito el cupón mostrado en una promoción. | Hasta que se aplica |
| dizor_favorites_v1 | Almacenamiento local | Guardar tus favoritos cuando navegas sin iniciar sesión. | Hasta que los quites o borres los datos del navegador |
| dizor_order_access | Almacenamiento de sesión | Mostrarte la confirmación del pedido que acabas de hacer. Contiene el número de pedido y un código de acceso temporal; no contiene tu nombre ni tu correo. | Hasta cerrar la pestaña (el código vence en el servidor a las 72 horas) |
| dizor_cookie_preferences | Almacenamiento local | Recordar tu decisión sobre las estadísticas de visitas. | Hasta que la cambies o borres los datos del navegador |

### Preferencias que tú eliges

| Nombre | Tipo | Finalidad | Duración |
|---|---|---|---|
| dizor_promo_popup_seen | Almacenamiento de sesión | Recordar que cerraste la ventana promocional para no volver a mostrártela en la misma visita. | Hasta cerrar la pestaña |

### Estadísticas propias

Solo se usan si las aceptas en el aviso de cookies o en el panel de preferencias. Si no las aceptas, el contador no registra tu visita. Si retiras el permiso, se eliminan de tu navegador.

| Nombre | Tipo | Finalidad | Duración |
|---|---|---|---|
| dizor_visit_day | Cookie (servidor de la API) | Contar tu visita una sola vez al día en el contador total del pie de página. Solo guarda la fecha. | 1 día |
| dizor_last_visit_day | Almacenamiento local | Lo mismo que la anterior, en el navegador. Solo guarda la fecha. | Hasta que retires el permiso o borres los datos del navegador |

### Cookies analíticas

Actualmente no usamos cookies analíticas. Si en el futuro las usamos, solo se activarán con tu permiso y esta página se actualizará antes.

### Cookies de marketing

No usamos cookies de publicidad ni de remarketing.

### Contenido de terceros

Las imágenes de productos se sirven desde Cloudinary, un servicio de alojamiento de imágenes; al cargarlas, tu navegador se conecta a sus servidores (como ocurre con cualquier imagen alojada fuera del sitio). Los enlaces a WhatsApp e Instagram solo te llevan a esos servicios si haces clic.

### Cómo gestionar tus preferencias

Puedes revisar tus preferencias en cualquier momento desde "Configurar cookies" en el pie de página. También puedes borrar las cookies y el almacenamiento desde la configuración de tu navegador; si lo haces, se vaciará tu carrito.

### Contacto

Si tienes preguntas sobre esta política o sobre el tratamiento de tus datos, escríbenos a dizorsandona@gmail.com. El responsable del tratamiento es COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS (DIZOR), NIT 901.027.825-5. Más información en la Política de Tratamiento de Datos Personales.

