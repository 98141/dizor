# F. Plan de despliegue y reversión

> **Documentado, NO ejecutado.** Desplegar, cambiar variables en producción o ejecutar la contención de V-01 requiere una autorización posterior y específica del propietario.
> Este plan no declara que el sitio quede "listo para producción" ni que cumpla la normativa.

Actualizado en la fase 3 (2026-11-16): datos reales, medios de pago, envío incluido, textos publicables y contención de V-01.

## 0. Bloqueos concretos que hoy impiden publicar

| # | Bloqueo | Referencia | Condición para desbloquear |
|---|---|---|---|
| 1 | **V-01 sigue abierto en producción**: la versión desplegada usa `NEQUI_ENV \|\| "mock"` y su webhook no verifica firmas en ese modo | V-01, E-18, E-22 | Contención de §7.1 ejecutada por el operador y verificada por lectura; conciliación de §7.2. **Corregido solo en local** |
| 2 | Versión desplegada no identificada; frontend y backend probablemente de versiones distintas | H-24, E-12 | Evidencia del operador (`02-…` §5.2) y decisión A/B de §1 |
| 3 | Textos legales sin revisión jurídica | `07-…` §3; textos en `08-…` | Revisión del abogado. Si cambia el texto: subir versión |
| 4 | **Plazo de entrega ambiguo**: no se publica ningún plazo | H-19, H-21, E-10, 07 J-8 | Definir alcance (preparación/entrega total) e inicio (Wompi vs. contraentrega); completar `config/deliveryTerms.js` (`status: "defined"`, texto, versión) |
| 5 | Contraentrega ofrecida en todo el país sin saber si la transportadora la presta en cada destino | E-19 | Confirmar cobertura o limitar la opción por destino |
| 6 | Pruebas no ejecutadas: Wompi sandbox real, correo real, Firefox/Safari, buzón dizorsandona@gmail.com | `03-…` §7 | Staging autorizado |
| 7 | Lint con 34 errores preexistentes (0 nuevos) | `03-…` §6 | Aceptar el riesgo o corregirlos aparte |

Ya **no** bloquean (fase 3): los PLACEHOLDER de las políticas (sustituidos), la ausencia de términos (creados), la "Política de cambios" (sustituida y redirigida) y la identificación del vendedor (incorporada).

## 1. Qué se desplegaría realmente

`main` (`10cdf28`) más los cambios locales sin confirmar (del propietario y de esta remediación) **no** son "producción + remediación":

- **Backend:** producción es coherente con `237b4bd`…`68e986b`. `main` añade favoritos, muestras, cambios de catálogo, la retirada de Nequi del checkout (`52bbcc8`) y toda la remediación.
- **Frontend:** producción es coherente con `245d22a`…`cbddfe3`. `main` añade guía de tallas, favoritos, rediseños de inicio, catálogo, confirmación, seguimiento y cuenta, y los cambios locales del propietario (ProductCard, guía de tallas, newsletter compacta).

Opciones (E-12): **A.** publicar todo, probando también los cambios del propietario; **B.** trasladar la remediación a una rama desde la versión desplegada. La **contención de V-01 (§7.1) no depende de ninguna de las dos**: es solo configuración y debe hacerse antes.

## 2. Transición de la API (compatibilidad)

### 2.1 Contratos que cambian

| Endpoint | Cliente anterior envía o espera | Nuevo comportamiento | Efecto sobre el cliente anterior |
|---|---|---|---|
| `POST /api/checkout/orders` | Sin `privacyAuthorization` ni `termsAccepted`; puede enviar `nequi_api`/`nequi_manual`; transportadoras antiguas | Exige `privacyAuthorization: true` y `termsAccepted: true`; solo `wompi`/`contra_entrega`; transportadora vacía, `interrapidisimo` o `servientrega` | **400** con instrucción de recargar. No se crea pedido. El carrito se conserva |
| `GET /api/checkout/config` | Lista de métodos y transportadoras | Solo métodos habilitados; `shippingIncluded: true`; `deliveryTerms: null` | El frontend antiguo seguiría mostrando "Gratis" en el envío (importe correcto: 0) |
| `POST /api/payments/nequi/{create,webhook}`, `GET …/status/:id` | Integración propia de Nequi | **410** sin leer ni modificar pedidos | Pantalla antigua de espera de Nequi muestra error; pedidos antiguos → conciliación §7.2 |
| `POST /api/webhooks/wompi` | Evento oficial | Valida además moneda COP, entorno, método `wompi` del pedido; no degrada pedidos pagados; acepta reintentos hasta 26 h y checksum en el cuerpo | Sin cambio de contrato con Wompi |
| `POST /api/marketing/abandoned-cart` | Formulario de recordatorio | **503** (función desactivada) | El frontend nuevo no muestra el formulario |
| `GET /api/checkout/track`, `GET /api/special-requests/track` | Correo en la query | **410** | Sin cambios respecto a la fase 2 |
| Nuevos de fases 1–2 | — | — | Un frontend nuevo contra un backend antiguo recibiría 404: **API primero** |

### 2.2 Secuencia propuesta (dos apps Node en cPanel/Passenger)

0. **Antes de todo, y con independencia del despliegue:** contención de V-01 (§7.1).
1. **Preparación sin impacto:** respaldo de la BD; variables nuevas (§3) con PQR y recordatorios desactivados; índices nuevos (`ConsentRecord`, `MarketingSuppression`, `CustomerRequest` con `idempotencyKeyHash`).
2. **Ventana corta:** desplegar y reiniciar la **API** → inmediatamente el **frontend** (build con `NEXT_PUBLIC_*`) → purgar caché de LiteSpeed/ISR.
3. **Después:** E-23 (modo de envío en el panel), E-24 (despublicar CMS antiguos, sin borrar).

### 2.3 Clientes con la versión anterior abierta

- Navegación interna: Next fuerza la carga de la versión nueva.
- Checkout a medias: 400 controlado ("recarga la página"); no se pierden ni duplican pedidos.
- Decisión de cookies previa: el banner reaparece una vez (`CONSENT_VERSION` "3").

### 2.4 Pasarelas y notificaciones

| Elemento | Situación tras desplegar |
|---|---|
| Wompi: enlaces creados antes | Siguen funcionando; el estado llega por el webhook |
| Webhook Wompi | Validaciones adicionales (02 §6.2). Nequi procesado **dentro** de Wompi se acepta |
| Nequi propio | 410 en sus tres endpoints; sin tareas automáticas ni rutas alternativas que modifiquen pedidos (no hay programador en el repositorio) |
| Correos ya enviados | Sus enlaces siguen funcionando |

## 3. Variables de entorno

| Variable | App | Valor | Nota |
|---|---|---|---|
| `NEQUI_DIRECT_ENABLED`, `NEQUI_MANUAL_ENABLED` | API | **Sin definir** (desactivado) | Solo `"true"` activa; nunca activar sin credenciales y verificación oficial |
| `NEQUI_ENV` | API | Sin definir o `disabled` | En el código nuevo, ausente/ inválido → `disabled`; `mock` solo con `NODE_ENV=test` |
| `NEQUI_CLIENT_ID/SECRET/API_KEY/WEBHOOK_SECRET` | API | Retirar | Integración desactivada |
| `WOMPI_ENV` | API | `production` | Debe coincidir con `event.environment` ("prod") |
| `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET` | API | Valores reales (ya existentes) | No se tocaron |
| `SHIPPING_INCLUDED_IN_PRICE` | API | Sin definir (= incluido) | `false` solo para revertir |
| `MARKETING_CART_REMINDERS_ENABLED` | API | Sin definir (= desactivado) | — |
| `ADMIN_NOTIFY_EMAIL` | API | Buzón de atención (E-2) | Aviso interno de PQR y pedidos |
| `MARKETING_TOKEN_SECRET` (+`_PREVIOUS`) | API | ≥32 caracteres (E-15) | Guía en `04-…` |
| `PQR_PUBLIC_ENABLED` / `NEXT_PUBLIC_PQR_ENABLED` | API / frontend | `false` hasta activar (07 §7) | Ambas a la vez; la segunda requiere recompilar |
| `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE` | frontend | AAAA-MM-DD de entrada en vigor (E-7) o sin definir | Sin ella no se muestra fecha de vigencia |
| `ORDER_DELIVERY_TIME_TEXT` | API | **Ya no se usa** | El plazo sale de `config/deliveryTerms.js` |
| `CONSENT_ACCEPT_DRAFT_FOR_TESTS` | — | **Nunca** en producción | Ignorada si `NODE_ENV=production` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | frontend | Sin definir | GA apagado |

## 4. Validaciones previas (staging con BD de pruebas)

1. `evidencias/pruebas/privacy.test.js` → **42/42**.
2. `consent.sim.test.mjs` → **6/6**.
3. `evidencias/e2e/e2e.js` → **22/22**, 0 peticiones externas.
4. Lint con `evidencias/lint/compare.py`: 0 errores nuevos.
5. Wompi en **sandbox** real (incluido un pago con Nequi dentro de Wompi y un reintento de evento), correo en buzón de pruebas.
6. Ninguna página contiene PLACEHOLDER, "Texto en revisión", "borrador" ni "NO PUBLICAR" (lo comprueba L-escritorio/L-móvil).

## 5. Comprobaciones posteriores (solo lectura)

1. `GET /api/checkout/config` → métodos `wompi` y `contra_entrega`; `shippingIncluded: true`; `deliveryTerms: null` (hasta E-10).
2. `GET /api/legal/notices` → versiones "2"/"1", estado `published`.
3. Páginas legales y pie con la identificación del vendedor; `/pagina/cambios` redirige.
4. Logs: llamadas a `/api/payments/nequi/*` responden 410. **No** se envían peticiones de prueba al webhook de producción.

## 6. Reversión compatible con los datos nuevos

| Situación | Acción | Compatibilidad |
|---|---|---|
| Fallo general | Versión anterior: **primero la API, luego el frontend** | Campos nuevos (`Order.legal.terms*`, `deliveryTerms*`, `shippingIncluded`, colecciones nuevas) se conservan; el código antiguo los ignora |
| Revertir solo el envío incluido | `SHIPPING_INCLUDED_IN_PRICE=false` | Los pedidos ya creados conservan su `shippingIncluded` |
| Problemas con PQR | Desactivar las dos variables | Las PQR radicadas deben atenderse igual |

Advertencias:

- **Revertir el backend reintroduce V-01** si la configuración de §7.1 no está aplicada. La contención por variables debe mantenerse aunque se revierta el código.
- La versión anterior reintroduce el alta automática en recordatorios y el correo en URLs: desactivar recordatorios y respetar `MarketingSuppression`.
- **No borrar** `ConsentRecord`, `MarketingSuppression`, `CustomerRequest` ni pedidos históricos.

## 7. V-01: contención en producción y conciliación (NO ejecutadas)

### 7.1 Contención mínima sobre la versión desplegada (solo configuración)

No requiere desplegar código ni arrastrar los cambios de los últimos meses. Se comprobó en Git que **todo el rango desplegado** (`237b4bd`…`68e986b`) tiene la misma lógica de Nequi: `getNequiEnv = () => process.env.NEQUI_ENV || "mock"`, `isNequiConfigured()` devuelve `true` en `mock` o con las tres credenciales, y `verifyWebhookSignature` devuelve `true` en `mock` y, fuera de `mock`, exige `NEQUI_WEBHOOK_SECRET`.

| Paso | Acción del operador autorizado | Tipo |
|---|---|---|
| 1 | En cPanel → Setup Node.js App → app de la **API** → variables: anotar si existen `NEQUI_ENV`, `NEQUI_CLIENT_ID`, `NEQUI_CLIENT_SECRET`, `NEQUI_API_KEY`, `NEQUI_WEBHOOK_SECRET` (sin copiar sus valores a chats ni documentos) | Lectura |
| 2 | En el administrador de archivos, abrir `src/services/nequiPaymentService.js` desplegado y confirmar que la línea 5 es `process.env.NEQUI_ENV \|\| "mock"` y que `verifyWebhookSignature` empieza con `if (getNequiEnv() === "mock") return true;` | Lectura |
| 3 | Fijar `NEQUI_ENV=disabled` y **retirar** `NEQUI_WEBHOOK_SECRET`, `NEQUI_CLIENT_ID`, `NEQUI_CLIENT_SECRET` y `NEQUI_API_KEY` (si existían credenciales reales, que el propietario las conserve fuera del servidor). Reiniciar la app de la API | Cambio |
| 4 | Verificar por lectura: `GET /api/checkout/config` ya no incluye `nequi_api`; revisar en los logs que las llamadas a `/api/payments/nequi/webhook` responden 401. **No enviar peticiones de prueba al webhook** | Lectura |

Efecto esperado en el código desplegado (deducido de su lectura; no probado contra producción):

- Webhook: `getNequiEnv()` = "disabled" ≠ "mock" y sin secreto → `verifyWebhookSignature` = `false` → **401**, sin tocar pedidos.
- Checkout: `isNequiConfigured()` = `false` → no se ofrece `nequi_api` y su creación responde 503 sin crear pedido.
- `POST /create` → 503. `GET /status/:id` → la consulta a Nequi falla (URL base nula), el error se captura y se devuelve el estado guardado **sin modificar** el pedido.

Riesgo residual: **la transferencia manual (`nequi_manual`) sigue ofrecida** por la versión desplegada (está fija en el código). No aprueba pagos automáticamente, pero contradice la decisión del negocio. Hasta desplegar el código nuevo: el personal no debe confirmar transferencias nuevas y debe responder con el canal de pago vigente.

Reversión de la contención: restaurar las variables anteriores (no recomendado mientras exista V-01).

### 7.2 Conciliación de pedidos históricos (operador autorizado, solo lectura)

No se elimina, reclasifica ni marca como pagado ningún pedido. Consulta de lectura (mongosh o Atlas Data Explorer):

```js
db.orders.find(
  { paymentMethod: { $in: ["nequi_api", "nequi_manual"] } },
  { orderNumber: 1, paymentMethod: 1, paymentStatus: 1, orderStatus: 1, total: 1, createdAt: 1,
    "nequi.status": 1, "nequi.reference": 1, statusHistory: 1 }
).sort({ createdAt: -1 })
```

| Caso | Señal | Qué hacer |
|---|---|---|
| `nequi_api` con `paymentStatus: "pagado"` y nota "Pago Nequi confirmado vía webhook" | Si producción estaba en `mock`, la integración **no pudo cobrar** (no envía la notificación al cliente): el "pago" se registró sin cobro real | Contrastar con el extracto de la cuenta Nequi del comercio. Si no hay ingreso: no despachar (o gestionar el cobro) y decidir con el abogado cómo comunicarlo (07 J-16) |
| `nequi_api` pendiente (`pago_pendiente`) | No hubo aprobación | Contactar al cliente y ofrecer Wompi o contraentrega; no marcar pagado sin evidencia |
| `nequi_manual` pagado | Confirmado manualmente por el personal | Verificar contra el extracto; documentar la evidencia |
| `nequi_manual` pendiente | Esperando comprobante | El cliente ve en la confirmación que debe escribir (no transferir por su cuenta) |

Cualquier cambio de estado posterior lo hace una persona autorizada desde el panel, con nota en el historial.
