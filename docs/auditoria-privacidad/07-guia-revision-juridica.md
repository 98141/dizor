# G. Guía de revisión jurídica — DIZOR

> **Documento interno.** Punto de entrada para el abogado que revisará los textos y decisiones de la tienda en línea de DIZOR.
> **Decisión del propietario (2026-11-20):** los textos se dan por vigentes sin revisión jurídica previa; si hay que cambiarlos, los ajusta él directamente. Esta guía queda solo como referencia por si más adelante se consulta a un abogado. No existe aprobación jurídica acreditada y este documento no certifica cumplimiento.
> Nada de lo descrito está desplegado. Fecha de preparación: 2026-11-16 (fase 3).

## 0. Cómo leer el expediente

| Orden | Documento | Para qué |
|---|---|---|
| 1 | **Este documento (07)** | Datos recibidos, preguntas que requieren decisión jurídica, decisiones tomadas sin aprobación, matriz de conservación, encargados y procedimiento PQR |
| 2 | `08-textos-legales-consolidados.md` | **Texto completo** que verá el cliente: casillas de autorización, términos, garantías, envíos, privacidad, cookies, pie de página y correos transaccionales. Es el objeto de la revisión |
| 3 | `05-borradores-legales-internos.md` | Análisis jurídico de soporte (reglas verificadas, interpretaciones pendientes y fuentes) |
| 4 | `01-matriz-remediacion.md` | Estado de los 28 hallazgos de la auditoría y de los riesgos encontrados después |
| 5 | `06-plan-despliegue-reversion.md` | Bloqueos de publicación y plan técnico (no ejecutado) |
| — | `informe-auditoria-2026-11-16.md` | Auditoría original, conservada sin cambios |

Convenciones: **[VERIFICADO]** regla leída en fuente oficial (§9); **[A CONFIRMAR]** requiere criterio jurídico; **[DECISIÓN DEL NEGOCIO]** dato aportado por el propietario.

## 1. Datos incorporados y su procedencia

Todos los datos de esta tabla los aportó el propietario por escrito en la instrucción del 2026-11-16. No se usó el PDF del RUT ni se guardó en el repositorio.

| Dato | Valor incorporado | Dónde se usa | Observaciones |
|---|---|---|---|
| Marca | DIZOR | Todo el sitio | Marca comercial, no identidad legal |
| Vendedor y facturador | COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS | Pie de página, términos, política de datos, casillas de autorización, acuse, constancia PQR | Se presenta además como **Responsable del tratamiento** → pregunta J-1 |
| NIT | 901.027.825-5 | Ídem | — |
| Dirección | CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia | Pie de página ("Domicilio registrado"), términos, política de datos | Es la dirección **registrada en el RUT**. No se presenta como bodega, punto de recogida ni dirección de devoluciones → J-2 |
| Correo de contacto | dizorsandona@gmail.com | Pie, políticas, términos, garantías, envíos, PQR, acuse | Buzón **no probado** en esta tarea (no se enviaron correos reales) |
| Atención | Roger Parra: correo, WhatsApp, PQR y solicitudes de datos, lunes a viernes en horario laboral | Textos públicos: "lunes a viernes, en horario laboral". El nombre de la persona **no** se publica | No se inventó horario (8:00–18:00) ni tiempo de respuesta. Sin credenciales de administración creadas |
| WhatsApp | 573159162520 (ya configurado en `frontend/src/lib/whatsapp.js`) | Sitio completo | No se comparó con el teléfono del RUT ni se sustituyó → §2 |
| Cobertura | Solo Colombia, nacional | Términos, envíos | El checkout ya solo admite departamentos de Colombia y COP |
| Transportadoras | Inter Rapidísimo o Servientrega | Checkout, envíos, etiquetas | "Envía" y "Coordinadora" quedan solo para pedidos históricos |
| Precios | Finales, con impuestos aplicables y **envío incluido**; sin promoción de "envío gratis" | Carrito, checkout, confirmación, acuse, términos, envíos | El servidor ya no suma envío (`SHIPPING_INCLUDED_IN_PRICE`, por defecto activo) |
| Personalización | Pines, colores de cinta, colores y tejidos de bolsos y sombreros; por producto | Términos, garantías | El campo `allowsCustomization` ya existía por producto → J-5 |
| Proveedores | Continúan HostingLabs/cPanel y MongoDB Atlas. Regiones, contratos y servicios de correo, imágenes y archivos **no confirmados** | Política de datos (§3) y §6 de este documento | → J-6 |
| Conservación | Hoy no se elimina nada | §5 de este documento | Situación operativa a evaluar, **no** autorización para conservar indefinidamente |
| Reseñas y testimonios | Permitidos con autorización; sin fotos de clientes sin autorización | Casilla de reseñas; política de datos | El formulario de reseñas no admite fotos |
| Abogado | En contratación; sin aprobación | — | — |
| Medios de pago | Solo Wompi y contraentrega. Desactivar Nequi directo (integración propia) y transferencia manual | Checkout, backend, términos | Desactivación efectiva en el servidor (ver 02 §6.1). Nequi **dentro de Wompi** sigue permitido |
| Plazos de entrega | Disponibles: 4 a 6 días hábiles; por encargo: ~15 días hábiles; transporte variable | **No publicados** | Ambiguos (preparación vs. entrega total; inicio del cómputo) → J-8 y bloqueo de publicación |
| Cambios voluntarios | El cliente paga el transporte solo en cambios de talla elegidos con producto correcto; el negocio paga en producto equivocado o daño de transporte | Garantías §2 y §5; envíos | Sin plazo inventado → J-9 |

## 2. Discrepancias y puntos registrados sin corregir

| # | Hallazgo | Tratamiento |
|---|---|---|
| X-1 | No se contrastó el WhatsApp operativo con el teléfono del RUT (el RUT no se incorporó al expediente) | Se mantiene el número operativo, como indicó el propietario. Si difieren, decidir cuál se publica como "teléfono" del vendedor (art. 50 lit. a Ley 1480) |
| X-2 | El pie de página conserva el crédito "© 2026 Diseño y desarrollo. Armando Mora. Todos los derechos reservados." | Es diseño del propietario y no se modificó. Puede leerse como titularidad de derechos del desarrollador sobre el sitio → J-13 |
| X-3 | El formulario `/personalizar` propone por defecto "Bordado, Cinta personalizada, Color especial, Otro" | Las opciones reales se configuran por producto (`customizationOptions`). Revisar que coincidan con lo que el negocio ofrece (pines, cintas, colores, tejidos) |
| X-4 | La BD de producción conserva las páginas CMS "Envíos y entregas" (con "envío gratis" y transportadoras antiguas) y "Política de cambios" (reclamos en 5 días) | No se tocó el CMS real. La ruta `/pagina/envios` pasa a ser una página estática con el mismo título y diseño, y `/pagina/cambios` redirige a `/garantias-y-devoluciones`; el pie ya no enlaza las páginas CMS antiguas. Tras desplegar, el operador puede despublicarlas en el CMS (sin borrarlas) |
| X-5 | `backend/src/scripts/seedDemoOrder.js` crea un pedido de demostración `nequi_manual` | Script de desarrollo; no se ejecuta en producción. Sin cambios |
| X-6 | Registros de autorización obtenidos en la fase 1 con la marca "Texto en revisión" (`textStatus: "draft"`) | **No se regularizan.** Siguen sin contar como autorización comercial; si se necesitan, se pide una autorización nueva con el texto vigente |

## 3. Preguntas que requieren decisión jurídica

| # | Pregunta | Contexto y opción aplicada provisionalmente | Dónde impacta (08) |
|---|---|---|---|
| J-1 | ¿La sociedad es quien decide las finalidades del tratamiento (Responsable, Ley 1581 art. 3 lit. e)? | Se presenta como Responsable por ser vendedora y facturadora. No se atribuyó la responsabilidad al desarrollador ni a quien atiende los mensajes. Confirmar con el propietario y el abogado | Política de datos §1; casillas |
| J-2 | ¿La dirección del RUT sirve como **dirección de notificación judicial** (Ley 1480 art. 50 lit. a)? | Se publica como "Domicilio registrado", sin calificarla de notificación judicial ni de dirección de devoluciones | Pie; términos §1 |
| J-3 | ¿Las autorizaciones registradas con los textos "published" (definitivos, sin marcas, revisión jurídica pendiente) valen para enviar la newsletter? | Se aplicó que **sí** (el titular vio exactamente ese texto, separado, opcional y con baja). Si el abogado opina lo contrario, basta con cambiar `isUsableTextStatus` en `consentService.js`. Alcance de la Ley 2300/2023 (horarios y canales) en 05 §10 | Casillas `marketing_*` |
| J-4 | Término de la garantía legal cuando el productor no anuncia uno | El texto dice "durante el término de garantía legal, que se cuenta desde la entrega", sin fijar duración. Confirmar con Ley 1480 art. 8 y Decreto 735/2013 (no consultado) | Garantías §1 |
| J-5 | Alcance de la excepción de retracto para personalizados (art. 47 num. 3) | Se distinguen tres casos: variante de catálogo, producto que admite personalización comprado tal cual, y encargo personalizado por cotización. Solo el último se excluye. Elegir talla, color, pin o cinta **del catálogo** no excluye el retracto | Términos §3; garantías §3 |
| J-6 | Transmisiones/transferencias internacionales y redacción sobre encargados | El texto dice que "algunos proveedores pueden almacenar o procesar información fuera de Colombia" y ofrece informar cuál y dónde. No afirma contratos ni garantías que no constan. Ley 1581 art. 26; Decreto 1377 art. 25 | Política de datos §3 |
| J-7 | ¿El contador de visitas propio debe ser opcional? | Se mantiene opcional y solo con aceptación (opción conservadora). 05 §4 | Política de cookies |
| J-8 | Redacción del plazo de entrega y su inicio | **Bloqueado.** Falta definir si 4–6 / ~15 días hábiles son preparación, despacho o entrega total; no se suman (15+6); el inicio no puede ser "pago confirmado" para contraentrega. El software ya permite mostrarlo antes de confirmar y guardar la versión aceptada (`config/deliveryTerms.js`, `Order.legal.deliveryTerms*`). Sin plazo pactado aplica el máximo legal de 30 días calendario (art. 50 lit. h, Ley 2439/2024) [VERIFICADO] | Checkout, acuse, envíos |
| J-9 | Plazo para solicitar un cambio voluntario de talla | No se fijó (instrucción del negocio). Se presenta como opción adicional que no limita garantía, retracto ni reversión | Garantías §5 |
| J-10 | Reversión del pago con contraentrega | El texto indica que la reversión aplica a pagos electrónicos (Wompi) y remite a las demás figuras para contraentrega. 05 §5.3 | Garantías §4 |
| J-11 | Plazos de conservación por tipo de dato | Ver la matriz de §5 | Política de datos §6 |
| J-12 | ¿Debe inscribirse la base en el RNBD? | Depende de activos > 100.000 UVT (Decreto 090/2018) [VERIFICADO]; activos no aportados | — |
| J-13 | Crédito del desarrollador en el pie ("Todos los derechos reservados") | X-2 | Pie |
| J-14 | Mecanismo de aceptación de términos y vigencia | Casilla obligatoria no premarcada; se guarda la versión aceptada en el pedido y en `ConsentRecord`. La fecha "Vigente desde" solo aparece si se define `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE` al publicar; no se usó la fecha de edición local | Todas las páginas |
| J-15 | Redacción de las soluciones de garantía (reparación; cambio o devolución "cuando corresponda según la ley") | Ley 1480 art. 11 (no transcrito en este expediente) | Garantías §1 |
| J-16 | Comunicación a compradores con pedidos Nequi históricos pendientes | La conciliación es operativa (06 §7); su comunicación al cliente, si procede, debe revisarse | — |
| J-17 | Procedimiento y plazos de respuesta de PQR de consumo | Para datos personales se publican los plazos de la Ley 1581 (arts. 14 y 15) [VERIFICADO]. Para PQR de consumo no se publicó un plazo: confirmar el aplicable | Procedimiento §7 |

## 4. Decisiones tomadas sin aprobación jurídica (recomendadas)

Son reversibles y están documentadas para que el abogado las confirme o cambie.

| # | Decisión | Motivo | Cómo revertir |
|---|---|---|---|
| D-1 | Textos públicos marcados `published` con `legalReview: "pending"` (interno) y sin marcas públicas | Instrucción del propietario: textos profesionales sin "borrador" ni "Texto en revisión" | Editar `backend/src/config/legalTexts.js` y **subir versión** si cambia el texto |
| D-2 | Evidencias `published` válidas para la newsletter; las `draft` de la fase 1 no | Ver J-3 / X-6 | `consentService.isUsableTextStatus` |
| D-3 | Envío incluido en el precio aplicado por código (`SHIPPING_INCLUDED_IN_PRICE`, por defecto activo), aunque la BD conserve otro modo | Evita depender de un cambio manual en el CMS de producción | `SHIPPING_INCLUDED_IN_PRICE=false` |
| D-4 | Transportadoras ofrecidas: solo Inter Rapidísimo y Servientrega (código), sin URL de rastreo inventada para Servientrega | Dato confirmado; no se conoce la URL oficial de rastreo | `settingsService.CONFIRMED_CARRIERS` |
| D-5 | Plazo de entrega no publicado | Ambigüedad (J-8) | `config/deliveryTerms.js` → `status: "defined"` + texto + versión |
| D-6 | Recordatorios de carrito preparados pero **desactivados** (`MARKETING_CART_REMINDERS_ENABLED`) | Instrucción: sin campañas nuevas | Variable en `true` + interruptor del panel + `MARKETING_TOKEN_SECRET` |
| D-7 | Página "Envíos y entregas" estática y redirección de "cambios" | No modificar el CMS real; evitar textos contradictorios | Eliminar la página estática y la redirección |
| D-8 | Reversión, retracto, garantía y cambios en una sola página con secciones separadas | Accesibilidad para el cliente; 05 §5 exige separarlas | — |
| D-9 | Aviso en términos: "No te pediremos transferencias a cuentas personales ni comprobantes por WhatsApp" | Coherente con la desactivación de la transferencia manual; reduce riesgo de suplantación | Quitar el párrafo si el negocio reactiva ese medio |
| D-10 | No se publica el nombre de Roger Parra | Minimización; los canales bastan | Añadirlo si el abogado lo considera necesario |

## 5. Matriz de conservación (interna, sin plazos inventados)

Situación actual informada por el propietario: **no se elimina nada**. Esto se registra como situación operativa a evaluar, no como autorización para conservar indefinidamente. Decreto 1377/2013 art. 11 [VERIFICADO]: solo durante el tiempo razonable y necesario para la finalidad, salvo obligación legal o contractual. No se purgó ni anonimizó nada.

| Categoría | Dónde está | Datos | Finalidad | Obligación de conservar candidata | Situación actual | Decisión pendiente |
|---|---|---|---|---|---|---|
| Pedidos | MongoDB Atlas (`orders`) | Comprador, dirección, artículos, importes, historial, versiones aceptadas | Ejecutar el contrato, garantía, reclamos | Libros y papeles del comerciante (Código de Comercio art. 60, mod. Ley 962/2005 art. 28) — **[A CONFIRMAR]**, no leído en esta fase | Se conserva sin límite | Plazo y forma (¿anonimizar datos de contacto tras la garantía?) |
| Facturas | Fuera del sitio (facturación electrónica de la sociedad) | — | Obligaciones tributarias | Normativa tributaria y de facturación — **[A CONFIRMAR]** | No gestionado por el sitio | Confirmar con el contador |
| Cuentas de cliente | `users` | Nombre, correo, hash de contraseña, teléfono, direcciones, favoritos | Administrar la cuenta | Ninguna específica identificada | Sin eliminación ni inactividad | ¿Borrar o anonimizar cuentas inactivas? ¿Tras cuánto? |
| Newsletter | `newslettersubscribers`, `marketingsuppressions` | Correo, nombre opcional, estado | Envío comercial | La lista de supresión debe conservarse para **respetar** la baja | Bajas conservadas | Plazo de los suscriptores sin actividad; la supresión no debe borrarse mientras se envíen campañas |
| Recordatorios de carrito | `abandonedcarts` | Correo y productos | Recordatorio comercial (desactivado) | Ninguna | Registros antiguos de producción **sin evidencia** de autorización (H-05) | ¿Eliminar los carritos heredados sin autorización? Requiere autorización expresa del propietario |
| Autorizaciones | `consentrecords` (append-only) | Finalidad, versión, fecha, origen, correo | Prueba de la autorización (Decreto 1377 art. 8 [VERIFICADO]) | Mientras dure el tratamiento y el plazo de reclamaciones — **[A CONFIRMAR]** | Inmutable | Plazo tras la revocación |
| PQR | `customerrequests` | Contacto, pedido, descripción, historial | Tramitar y probar la respuesta | Trazabilidad (Ley 1480 art. 50 lit. g, Ley 2439) — **[A CONFIRMAR]** el plazo | Sin eliminación | Plazo de conservación |
| Solicitudes especiales | `specialrequests` | Contacto, detalles | Cotizar | Si se convierte en pedido, como pedido | Sin eliminación | Plazo para solicitudes no concretadas |
| Reseñas | `reviews` | Nombre visible, ciudad, comentario | Publicación con autorización | Ninguna | Publicadas hasta su retiro | Retiro a solicitud del titular (revocación) |
| Logs de la aplicación | Servidor de la API (winston) | IP, ruta redactada, user-agent | Seguridad y diagnóstico | Ninguna específica | Rotación 14 días (errores 30) según configuración del código | Confirmar que la configuración desplegada es la misma |
| Logs del hosting | HostingLabs/cPanel (LiteSpeed) | IP, URL (históricamente con correos en la query, H-06) | Operación | — | **Desconocida** (E-4) | Pedir al proveedor; evaluar la exposición histórica |
| Registro de auditoría del panel | `auditlogs` | Correo e id del personal, IP, acción | Seguridad interna | — | Sin eliminación | Plazo |
| Respaldos | MongoDB Atlas (configuración no confirmada) | Copia de toda la BD | Recuperación | — | **Desconocida** | Confirmar política de respaldos y su retención; las supresiones deben reflejarse al expirar los respaldos |

## 6. Encargados y proveedores (registro)

| Proveedor | Servicio | Datos | Estado de uso | Rol | Región | Contrato |
|---|---|---|---|---|---|---|
| HostingLabs (cPanel) | Alojamiento de la web y la API | Logs, tráfico | **Confirmado** por el propietario | [A CONFIRMAR] encargado | No confirmada | No aportado |
| MongoDB Atlas | Base de datos | Toda la BD | **Confirmado** | [A CONFIRMAR] encargado | No confirmada | No aportado |
| Resend | Correos transaccionales | Correo, nombre, pedido | Usado por el código; **no confirmado** por el propietario | [A CONFIRMAR] | No confirmada | No aportado |
| Cloudinary | Imágenes de productos | IP del visitante al cargar imágenes | Usado por el código; **no confirmado** | [A CONFIRMAR] | No confirmada | No aportado |
| Wompi | Pagos en línea | N.º de pedido, importe; datos que el cliente ingresa en Wompi | Activo | [A CONFIRMAR] (¿responsable independiente?) | — | — |
| Inter Rapidísimo, Servientrega | Transporte | Nombre, dirección, teléfono | **Confirmado** | [A CONFIRMAR] | Colombia | No aportado |
| WhatsApp (Meta) | Conversaciones iniciadas por el cliente | Lo que el cliente escriba | Activo | [A CONFIRMAR] | — | — |
| Nequi (integración propia) | — | — | **Desactivado** (2026-11-16) | — | — | — |

En la política pública se nombran HostingLabs, MongoDB Atlas, Wompi y las transportadoras; el correo y las imágenes se describen por función ("servicio de envío de correos", "servicio de alojamiento de imágenes") porque el propietario no confirmó esos proveedores.

## 7. Procedimiento operativo de PQR y solicitudes de titulares

**Estado: preparado, no activado.** `PQR_PUBLIC_ENABLED` y `NEXT_PUBLIC_PQR_ENABLED` siguen en `false`. No se crearon credenciales para Roger Parra ni se afirmó que el buzón esté probado.

| Paso | Qué ocurre | Responsable |
|---|---|---|
| 1. Recepción digital | Formulario `/pqr` (cuando se active): disponible las 24 horas; persiste la solicitud **antes** de mostrar el radicado `PQR-AAAAMMDD-XXXXXXXX`, con fecha y hora y código de consulta. También se reciben solicitudes por **correo** (dizorsandona@gmail.com) y **WhatsApp** | Sistema / Roger Parra |
| 2. Aviso interno | El sistema envía un aviso a `ADMIN_NOTIFY_EMAIL` con radicado, categoría, tipo y fecha (sin datos de contacto ni descripción). El detalle se consulta en `/admin/pqr` con sesión | Sistema |
| 3. Atención humana | Lunes a viernes, en horario laboral. Lo recibido fuera de ese horario se atiende desde el siguiente día hábil. La recepción digital no equivale a atención inmediata | Roger Parra |
| 4. Correo o WhatsApp | Responder acusando recibo con fecha y hora de recepción e invitar a radicar en `/pqr` para obtener seguimiento, o registrar la solicitud internamente con la fecha de recepción real. **[Recomendación]** Mientras el panel no permita crear PQR manuales, llevar un registro interno con fecha/hora de recepción, canal y respuesta | Roger Parra |
| 5. Clasificación | Categoría `consumo` (petición, queja, reclamo) o `datos_personales` (consulta, rectificación, supresión, revocación, prueba de autorización). Las de datos siguen los plazos de la Ley 1581 (consultas 10 + 5 días hábiles; reclamos 15 + 8; leyenda "reclamo en trámite" en 2 días hábiles) [VERIFICADO] | Roger Parra |
| 6. Seguimiento | Cambiar el estado en `/admin/pqr` (`recibida` → `en_tramite` → `respondida`/`cerrada`) con **nota pública** (la ve el cliente con su código) y nota interna | Roger Parra |
| 7. Escalamiento | Garantías, retractos y reversiones con impacto económico; solicitudes de supresión con posible deber de conservación (§5) | Propietario + abogado |

Para activar: (a) el propietario autoriza el acceso de Roger Parra al panel con el rol que decida; (b) se prueba el buzón con un mensaje controlado; (c) se define `ADMIN_NOTIFY_EMAIL`; (d) se activan las dos variables y se recompila el frontend.

## 8. Marketing (configuración conservadora)

| Elemento | Estado |
|---|---|
| Mensajes transaccionales (acuse, despacho, constancia PQR, recuperación de contraseña) | Activos; sin contenido comercial ni enlace de baja |
| Newsletter voluntaria | Activa con casilla opcional no premarcada, evidencia versionada y baja sin sesión |
| Campañas nuevas | Ninguna |
| Recordatorios de carrito | **Preparados y desactivados**: no se ofrece el formulario, el API responde 503, el envío devuelve `feature_disabled` y el botón del panel queda deshabilitado |
| WhatsApp/SMS comerciales | No existen |
| Google Analytics | **Apagado** (no se definió `NEXT_PUBLIC_GA_MEASUREMENT_ID`); no se activó para pruebas |
| Estadísticas propias (contador) | Opcionales, solo con aceptación |

## 9. Fuentes

| Fuente | Uso | Estado |
|---|---|---|
| Ley 1480/2011 (Régimen Legal de Bogotá, https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=44306) | arts. 7, 8, 26, 43, 47, 50, 51 | Leída en la auditoría |
| Ley 2439/2024 (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=171718) | arts. 3, 4, 5 (devolución en 15 días calendario; art. 50 lit. b/g/h; 30 días por defecto) | Leída en la auditoría |
| Sentencia C-192/26 (https://www.corteconstitucional.gov.co/relatoria/2026/c-192-26.htm) | Plazo de 15 días para todas las modalidades del art. 47 | Parte resolutiva leída |
| Ley 1581/2012 (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981) | arts. 3–26 | Leída |
| Decreto 1377/2013 (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646) | arts. 5–26 | Leído; numeración en el DUR 1074/2015 sin verificar |
| Decreto 090/2018 (Normograma JEP) | RNBD | Leído |
| Ley 2300/2023 | Horarios y canales de mensajes comerciales | Texto íntegro no leído; alcance discutido (05 §10) |
| Documentación oficial de eventos de Wompi (https://docs.wompi.co/docs/colombia/eventos/) | Checksum, campos del evento, entorno, reintentos | Leída en la fase 3 |
| Código de Comercio art. 60; normativa tributaria | Conservación | **No leídos**: referencias candidatas para J-11 |
| Decretos 735/2013 y 587/2016 | Garantía y reversión | No consultados |
| Circular SIC 005/2020 y guías 2019 | — | No leídas |
