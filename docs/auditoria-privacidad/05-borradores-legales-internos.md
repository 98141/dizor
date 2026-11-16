# E. Borradores legales internos — DIZOR

> **BORRADOR INTERNO — NO PUBLICAR.**
> Ninguna sección de este documento está aprobada. Contiene marcas
> `[PENDIENTE …]` que solo pueden completarse con datos reales del propietario
> y revisión de un abogado. No sustituye asesoría jurídica ni certifica
> cumplimiento.

Etiquetas usadas:

- **[OBLIGACIÓN LEGAL VERIFICADA]**: regla leída en una fuente oficial en la fecha indicada (§11).
- **[RECOMENDACIÓN]**: buena práctica técnica o de diseño; no es una exigencia legal verificada.
- **[INTERPRETACIÓN PENDIENTE]**: requiere criterio de un abogado.

Para evitar documentos duplicados o contradictorios, cada tema tiene **un solo lugar** de destino:

| Tema | Destino previsto |
|---|---|
| Identificación del vendedor | Pie de página + Términos |
| Términos y condiciones | Página nueva `/terminos-y-condiciones` |
| Tratamiento de datos | `/politica-de-privacidad` (sustituir los PLACEHOLDER) |
| Cookies | `/politica-de-cookies` (ya actualizada en el código; falta E-2) |
| Envíos, garantía, retracto, reversión y cambios | Términos (sección propia). La página CMS "Política de cambios" debe **retirarse o reemplazarse**, no coexistir |
| Atención y derechos | `/pqr` + Política de privacidad |

---

## 1. Información del vendedor

[OBLIGACIÓN LEGAL VERIFICADA] Ley 1480/2011, art. 50 lit. a: identificación con nombre o razón social, NIT, dirección de notificación judicial, teléfono, correo electrónico y demás datos de contacto.

| Campo | Valor |
|---|---|
| Tipo de persona (natural o jurídica) | `[PENDIENTE E-1]` |
| Nombre o razón social | `[PENDIENTE E-1]` |
| NIT | `[PENDIENTE E-1]` |
| Dirección de notificación judicial | `[PENDIENTE E-1]` |
| Teléfono | `[PENDIENTE E-1/E-2]` (el WhatsApp comercial existe en `lib/whatsapp.js`; confirmar si es el canal oficial) |
| Correo electrónico | `[PENDIENTE E-2]` |

Nota: "DIZOR" es la marca comercial y **no** equivale a la identidad legal.

## 2. Términos y condiciones — esquema

[OBLIGACIÓN LEGAL VERIFICADA] Art. 50 lit. d: condiciones generales accesibles, imprimibles y descargables. Arts. 37 y 43: no pueden incluir cláusulas ineficaces; por ejemplo, las que limitan la responsabilidad legal (num. 1) o implican renuncia de derechos (num. 2).

Secciones previstas, sin contenido hasta tener los datos:

1. Identificación del vendedor → §1.
2. Proceso de compra: carrito → datos → envío → transportadora → pago → **resumen con precio unitario y total, posibilidad de corregir** → confirmación → **acuse de recibo**. Describe lo que hace el sistema tras las correcciones de H-19 y H-20.
3. Precios: en pesos colombianos con todos los impuestos incluidos [OBLIGACIÓN LEGAL VERIFICADA, art. 26]. Hoy el IVA está desactivado; ver H-25 antes de activarlo.
4. Medios de pago: `[PENDIENTE E-12]` confirmar cuáles quedan activos (producción ofrece Wompi, Nequi API, Nequi manual y contra entrega; el repositorio actual solo Wompi y contra entrega).
5. Envíos y plazos → §6.
6. Garantía, retracto, reversión del pago y cambios → §5.
7. PQR y atención → §9.
8. Datos personales → remisión a la Política de Privacidad.
9. Ley aplicable `[PENDIENTE abogado]`.

## 3. Política de tratamiento de datos personales — borrador estructurado

[OBLIGACIÓN LEGAL VERIFICADA] Decreto 1377/2013, art. 13 (contenido mínimo): identificación del responsable; tratamiento y finalidades; derechos; área responsable; procedimiento; vigencia y periodo de vigencia de la base. Ley 1581/2012, art. 12 (deber de informar).

Numeración en el Decreto Único 1074/2015: según fuentes secundarias, el art. 5 del Dec. 1377 corresponde al 2.2.2.25.2.2 y las políticas al 2.2.2.25.3.1. `[PENDIENTE: confirmar en el texto oficial del DUR]`.

### 3.1 Responsable

`[PENDIENTE E-1]` (ver §1). Contacto para datos personales: `[PENDIENTE E-2]`.

### 3.2 Tratamientos y finalidades

Inventario comprobado en el código el 2026-11-16:

| Tratamiento | Datos | Finalidad | Base prevista |
|---|---|---|---|
| Pedido (invitado o registrado) | nombre, correo, teléfono, dirección, ciudad, departamento, CP, notas, teléfono Nequi | gestionar pedido, pago, envío, atención, garantía; acuse de recibo | Autorización `order_processing` (casilla obligatoria) `[INTERPRETACIÓN PENDIENTE: ¿basta conducta inequívoca?]` |
| Cuenta | nombre, correo, contraseña (hash), teléfono, direcciones, favoritos, último acceso | crear y administrar la cuenta | Autorización `account` |
| Solicitudes de personalización y por mayor | contacto, empresa, detalles | responder y cotizar | Autorización `special_request` |
| Reseñas | nombre visible, ciudad, comentario, calificación | publicarlas tras su aprobación | Autorización `review_publication` |
| PQR y solicitudes de titulares | contacto, n.º de pedido, descripción | tramitar y responder | Autorización `customer_request` |
| Newsletter | correo, nombre opcional | envío de novedades y ofertas | Autorización comercial opcional `marketing_newsletter` |
| Recordatorio de carrito | correo, productos del carrito | recordatorio comercial | Autorización comercial opcional `marketing_cart_reminder` |
| Evidencias de autorización | finalidad, versión del texto, fecha, origen, correo y referencia | demostrar la autorización (Dec. 1377, art. 8) | Obligación del responsable |
| Registro de auditoría del panel | correo e id del personal, IP, user-agent, ruta (redactada), acción | seguridad y trazabilidad interna | `[INTERPRETACIÓN PENDIENTE]` |
| Logs del servidor | IP, ruta (con query redactada), user-agent | operación y seguridad | `[INTERPRETACIÓN PENDIENTE]`; conservación 14 días (error: 30) en el servidor de la API; hosting `[PENDIENTE E-4]` |
| Contador de visitas | solo la fecha (cookie y almacenamiento local); total agregado en BD | estadística agregada | — |
| Analítica (Google Analytics) | **No activa** | — | Solo con aceptación, si se activa (E-9) |

### 3.3 Destinatarios y encargados

Ver la plantilla de §8. Nombres de servicios usados técnicamente: MongoDB Atlas, Resend, Cloudinary, Wompi, Nequi, transportadoras (Interrapidísimo, Envía, Coordinadora), WhatsApp (iniciado por el usuario) y el hosting `[PENDIENTE E-4]`.

Rol, región y contrato de cada uno: `[PENDIENTE E-3]`.

Transferencias internacionales: `[PENDIENTE E-3 + abogado]`. [OBLIGACIÓN LEGAL VERIFICADA] Ley 1581, art. 26; Decreto 1377, art. 25 (contrato de transmisión).

### 3.4 Derechos del titular

[OBLIGACIÓN LEGAL VERIFICADA] Ley 1581, art. 8: conocer, actualizar y rectificar; solicitar prueba de la autorización; ser informado del uso; presentar quejas ante la SIC; revocar la autorización o solicitar la supresión cuando proceda; acceder gratuitamente. Decreto 1377, art. 9: la revocación o supresión no procede cuando exista un deber legal o contractual de permanecer en la base.

### 3.5 Procedimiento

- Canal: formulario `/pqr`, categoría "Solicitud sobre mis datos personales" (implementado, **desactivado**), o el correo `[PENDIENTE E-2]`.
- [OBLIGACIÓN LEGAL VERIFICADA] Consultas: respuesta en máximo 10 días hábiles, prorrogables hasta 5 días hábiles más informando el motivo (Ley 1581, art. 14).
- [OBLIGACIÓN LEGAL VERIFICADA] Reclamos: máximo 15 días hábiles desde el día siguiente a la recepción, prorrogables hasta 8 días hábiles más; leyenda "reclamo en trámite" dentro de los 2 días hábiles siguientes a la recepción del reclamo completo (Ley 1581, art. 15).
- Área o persona responsable: `[PENDIENTE E-2]`.
- [RECOMENDACIÓN] No prometer "eliminación inmediata de todos los datos": los pedidos pueden estar sujetos a conservación legal `[PENDIENTE E-6 + abogado]`.

### 3.6 Conservación

`[PENDIENTE E-6]` por tipo de dato. [OBLIGACIÓN LEGAL VERIFICADA] Decreto 1377, art. 11: solo durante el tiempo razonable y necesario para la finalidad, salvo una obligación legal o contractual.

### 3.7 Vigencia

`[PENDIENTE E-7]`. Al cambiar el texto, subir la versión correspondiente en `backend/src/config/legalTexts.js`.

### 3.8 Menores y datos sensibles

No se recogen intencionalmente (H-27). [OBLIGACIÓN LEGAL VERIFICADA] Ley 1581, arts. 5 y 7.

## 4. Cookies

Ya implementada en `frontend/src/app/(shop)/politica-de-cookies/page.js` con el inventario real. Falta el contacto `[PENDIENTE E-2]`.

[INTERPRETACIÓN PENDIENTE] La normativa colombiana revisada no contiene una regla específica sobre cookies. La exigencia de aceptación previa para la analítica se apoya en los principios de la Ley 1581 (arts. 4 y 9) y requiere criterio de un abogado. La Circular Externa SIC 005 de 2020 remite a guías de 2019 sobre comercio electrónico y marketing; **no se leyeron** y no se les atribuye alcance general sobre cookies.

## 5. Garantía, retracto, reversión del pago y cambios voluntarios

Son **cuatro figuras distintas** y deben presentarse por separado.

### 5.1 Garantía legal

- [OBLIGACIÓN LEGAL VERIFICADA] Ley 1480, art. 7: el productor o proveedor responde por la calidad, idoneidad, seguridad y el buen estado y funcionamiento del producto. Aplica también a productos en promoción o con descuento.
- [OBLIGACIÓN LEGAL VERIFICADA] Art. 8: término legal o el fijado por la autoridad; a falta de este, el anunciado por el productor o proveedor; corre desde la entrega.
- [INTERPRETACIÓN PENDIENTE] El término aplicable cuando no se anuncia ninguno: el resumen consultado indica un año para productos nuevos, pero **debe confirmarse** con el texto completo y con el Decreto 735/2013 (no consultado).
- [INTERPRETACIÓN PENDIENTE] La cláusula actual "contáctanos dentro de los 5 días hábiles … si recibes un artículo dañado" no puede reducir el término de garantía (art. 43, num. 1 y 2).
- Término que ofrecerá DIZOR y procedimiento: `[PENDIENTE E-10 + abogado]`.

### 5.2 Derecho de retracto

- [OBLIGACIÓN LEGAL VERIFICADA] Ley 1480, art. 47: aplica, entre otras, a ventas a distancia y no tradicionales. El plazo es de 5 días hábiles desde la entrega del bien. El consumidor devuelve el producto por los mismos medios y en las mismas condiciones en que lo recibió, y asume los costos de transporte de la devolución.
- [OBLIGACIÓN LEGAL VERIFICADA] Devolución del dinero: máximo 15 días calendario (art. 47, modificado por la Ley 2439/2024, art. 3), al medio de pago o según lo acordado, con opciones informadas. La Ley 2439, art. 5, permite el medio de pago que prefiera el consumidor.
- [OBLIGACIÓN LEGAL VERIFICADA] Sentencia C-192 de 2026 (Corte Constitucional, 24-06-2026): declaró exequible la expresión "En los casos de comercio electrónico" del art. 3 de la Ley 2439, en el entendido de que el término de 15 días calendario aplica de manera uniforme a **todas** las modalidades del art. 47.
- Excepciones del art. 47: entre ellas, num. 3, bienes confeccionados conforme a las especificaciones del consumidor o claramente personalizados.
  - [INTERPRETACIÓN PENDIENTE] **"Artesanal" no equivale a "personalizado".** Un sombrero de catálogo hecho a mano no queda excluido por ese solo hecho.
  - Qué productos de DIZOR son realmente personalizados: `[PENDIENTE E-10 + abogado]`. Hoy, las piezas pedidas desde `/personalizar` son el candidato natural.
  - No se propone ninguna excepción general para sombreros o artesanías.
- [OBLIGACIÓN LEGAL VERIFICADA] Art. 50 lit. c: informar el derecho de retracto y el procedimiento para ejercerlo.

### 5.3 Reversión del pago

- [OBLIGACIÓN LEGAL VERIFICADA] Ley 1480, art. 51: aplica a compras por medios electrónicos pagadas con tarjeta u otro instrumento electrónico, cuando hay fraude, operación no solicitada, producto no recibido, producto que no corresponde a lo solicitado o producto defectuoso.
- Requisitos: reclamar al proveedor dentro de 5 días hábiles desde que se tuvo noticia; devolver el producto cuando aplique; notificar al emisor del instrumento.
- Reglamentado por el Decreto 587/2016 `[no consultado]`.
- No aplica a contra entrega en efectivo `[INTERPRETACIÓN PENDIENTE]`.

### 5.4 Cambios comerciales voluntarios

Política comercial opcional del negocio (talla, color, etc.) `[PENDIENTE E-10]`. Debe presentarse como **adicional** y nunca sustituir las figuras de §5.1 a §5.3.

## 6. Envíos y plazos

- [OBLIGACIÓN LEGAL VERIFICADA] Art. 50 lit. c: informar el tiempo de entrega.
- [OBLIGACIÓN LEGAL VERIFICADA] Art. 50 lit. h (Ley 2439/2024, art. 4): entregar en el plazo aceptado por el consumidor; si no se pactó, máximo 30 días calendario desde el pedido. Ante retraso o falta de disponibilidad, el consumidor puede terminar el contrato y recibir la devolución total en máximo 15 días calendario.
- Plazos reales por zona y tipo de producto (fabricación de personalizados): `[PENDIENTE E-10]`. Al tenerlos, definir `ORDER_DELIVERY_TIME_TEXT` y mostrarlos en el checkout.

## 7. Registro Nacional de Bases de Datos (RNBD)

- [OBLIGACIÓN LEGAL VERIFICADA] Decreto 090/2018 (18-01-2018, D.O. 50.480), art. 1, que modifica el art. 2.2.2.26.1.2 del DUR 1074/2015. Deben inscribir sus bases:
  - a) sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT;
  - b) personas jurídicas de naturaleza pública.
- Aplicabilidad a DIZOR: `[PENDIENTE E-1 (forma jurídica) y E-13 (activos)]`.
- **No estar obligado a inscribirse no exime de las demás obligaciones de la Ley 1581.**

## 8. Registro de encargados y proveedores (plantilla)

| Proveedor | Servicio | Datos | Rol (encargado / responsable) | Región | Contrato o DPA | Fecha |
|---|---|---|---|---|---|---|
| MongoDB Atlas | Base de datos | Toda la BD | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | |
| Resend | Correo | Correo, nombre, pedido | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | |
| Cloudinary | Imágenes | IP del visitante al cargar imágenes | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | `[PENDIENTE E-3]` | |
| Hosting web y API | Alojamiento | Logs (IP, URL) | `[PENDIENTE E-4]` | `[PENDIENTE E-4]` | `[PENDIENTE E-4]` | |
| Wompi | Pagos | N.º de pedido, importe; datos que el cliente ingresa en Wompi | `[PENDIENTE E-3 + abogado]` | | | |
| Nequi | Pagos | Teléfono, importe | `[PENDIENTE E-3 + abogado]` | | | |
| Transportadoras | Envíos | Nombre, dirección, teléfono | `[PENDIENTE + abogado]` | | | |

## 9. Canales de atención

- [OBLIGACIÓN LEGAL VERIFICADA] Art. 50 lit. g (Ley 2439/2024, art. 4): canales de fácil acceso en el mismo medio; número de registro o radicado con fecha y hora; trazabilidad.
- Implementado y **desactivado**: `/pqr`, `/pqr/seguimiento`, `/admin/pqr`. Activación: `[PENDIENTE E-2]`.
- [RECOMENDACIÓN] Antes de activarlo, el propietario debe definir quién revisa `/admin/pqr`, con qué frecuencia y los plazos internos. El software no fija esos plazos.

## 10. Comunicaciones comerciales (Ley 2300 de 2023)

[INTERPRETACIÓN PENDIENTE] El art. 5 extiende reglas de horarios y canales a los mensajes publicitarios (SMS, apps, web, correo, llamadas) de productores y proveedores. Su alcance es discutido:

- La Superintendencia Financiera (Boletín Jurídico 107) lo interpreta de forma amplia.
- Otras lecturas lo restringen a la relación con entidades vigiladas.
- La Corte Constitucional declaró exequible la ley (C-278 de 2024).

Mientras tanto, el código aplica de forma conservadora la franja lunes a viernes 7:00–19:00 y sábados 8:00–15:00, sin domingos ni festivos, más la baja en cada correo. **Requiere decisión de un abogado.**

## 11. Fuentes consultadas (2026-11-16)

| Fuente | Uso | Estado |
|---|---|---|
| Ley 1480/2011 — Régimen Legal de Bogotá, https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=44306 | arts. 7, 8, 26, 43, 47, 50, 51 | Leída en la auditoría |
| Ley 2439/2024 — https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=171718 | arts. 3, 4, 5 | Leída en la auditoría |
| Sentencia C-192/26 — https://www.corteconstitucional.gov.co/relatoria/2026/c-192-26.htm | parte resolutiva | **Leída en esta fase** |
| Ley 1581/2012 — https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981 | arts. 3–26 | Leída en la auditoría |
| Decreto 1377/2013 — https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646 | arts. 5–26 | Leído; numeración DUR 1074 sin confirmar en el texto oficial |
| Decreto 090/2018 — Normograma JEP, https://jurinfo.jep.gov.co/Normograma/Compilacion/docs/decreto_0090_2018.htm | art. 1 (RNBD) | **Leído en esta fase** |
| Ley 2300/2023 — Boletín Jurídico 107 SFC (https://www.superfinanciera.gov.co/10114938) y normogramas oficiales vía búsqueda | arts. 3 y 5 | Texto íntegro **no leído**; alcance en discusión |
| Decreto 1074/2015 (sección 2.2.2.25) | numeración | **No verificado** (no se pudo cargar la sección) |
| Circular SIC 005/2020 y guías 2019 | — | **No leídas** |
| Decreto 735/2013 y Decreto 587/2016 | garantía y reversión | **No consultados** |

No se aplicó legislación extranjera; depende de E-14.
