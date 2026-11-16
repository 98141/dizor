# F. Plan de despliegue y reversión

> **Documentado, NO ejecutado.** Desplegar requiere una autorización posterior y específica del propietario.
> Este plan **no declara** que el sitio quede "listo para producción" ni "cumpliendo".

## 0. Bloqueos previos (todos deben resolverse o aceptarse expresamente)

| Bloqueo | Referencia | Condición para desbloquear |
|---|---|---|
| Versión real en producción desconocida | H-24, E-12 | Identificar el commit desplegado. Fusionar estos cambios **sobre esa versión**, o decidir conscientemente que se despliega `main` (que elimina Nequi del checkout; ver commit `52bbcc8`) |
| Textos de autorización en `draft` | H-03, E-1, E-5, abogado | Texto aprobado → `status: "approved"` y **nueva versión** en `legalTexts.js` |
| PLACEHOLDER en las políticas de privacidad y cookies | H-01, H-10, E-1, E-2 | Datos reales y revisión. No publicar marcadores |
| Sin términos ni retracto | H-17, H-18 | Fuera del alcance técnico; ver borradores |
| Pruebas E2E en navegador | `03-informe-pruebas.md` §5 | Ejecutarlas en staging |

Se puede publicar **por fases**: los cambios técnicos de privacidad (H-06, H-07, H-08, H-16, H-28) son útiles aunque los legales sigan bloqueados. Pero el bloque de formularios (H-03) arrastra los textos en `draft`. Si se decide desplegar sin textos aprobados, **las casillas mostrarán "Texto en revisión"**, lo cual exige una decisión explícita del propietario.

## 1. Dependencias y compatibilidad

Cambios de contrato de la API (incompatibles con el frontend actualmente publicado):

| Endpoint | Antes | Después |
|---|---|---|
| `POST /api/checkout/orders` | sin autorización | exige `privacyAuthorization: true`; devuelve `accessToken` |
| `GET /api/checkout/track` | consulta con correo en query | **410**; usar `POST /api/checkout/track` |
| `GET /api/special-requests/track` | ídem | **410**; usar `POST` |
| `POST /api/auth/register` | — | exige `privacyAuthorization: true` |
| `POST /api/special-requests` | — | exige `privacyAuthorization: true` |
| `POST /api/reviews` | — | exige `publicationAuthorization: true` |
| `POST /api/marketing/newsletter`, `/abandoned-cart` | — | exigen `marketingConsent: true` |
| Nuevos | — | `POST /api/checkout/orders/lookup`, `POST /api/marketing/unsubscribe`, `GET /api/legal/notices`, `/api/pqr/*`, `/api/admin/pqr/*` |

**Backend y frontend deben desplegarse juntos**, en una ventana corta:

- Backend primero → el checkout del frontend antiguo falla (400) hasta que llegue el nuevo frontend.
- Frontend primero → las llamadas nuevas fallan (404).

Si no es posible desplegar a la vez, preparar antes una versión puente del backend que acepte ambos contratos durante la ventana. Esa versión **no existe aún** y debería probarse aparte.

Esquema de datos: solo **campos y colecciones nuevos**, con valores por defecto (`Order.guestAccess`, `Order.legal`, `Order.buyerReceipt`, `NewsletterSubscriber.lastConsentRecord`, `AbandonedCart.consentRecord`, `ConsentRecord`, `MarketingSuppression`, `CustomerRequest`). **No hay migración** y no se modifica ni borra ningún documento existente. Los índices nuevos se crean automáticamente con Mongoose (`autoIndex`); verificar que esa opción esté habilitada en producción o crearlos manualmente.

## 2. Variables de entorno

| Variable | Dónde | Valor | Nota |
|---|---|---|---|
| `MARKETING_TOKEN_SECRET` | backend | secreto aleatorio ≥32 caracteres (E-15) | Sin él no se envían recordatorios comerciales (falla cerrada) |
| `PQR_PUBLIC_ENABLED` | backend | `false` hasta E-2 | `true` solo cuando haya un responsable que atienda |
| `NEXT_PUBLIC_PQR_ENABLED` | frontend (build) | igual que la anterior | Muestra el enlace del pie de página |
| `ORDER_DELIVERY_TIME_TEXT` | backend | plazo confirmado (E-10) o vacío | Vacío → el acuse indica que se confirmará después |
| `MARKETING_BLOCKED_DATES` | backend | festivos AAAA-MM-DD (E-16) | Opcional |
| `CONSENT_ACCEPT_DRAFT_FOR_TESTS` | — | **nunca** definirla en producción | El código la ignora si `NODE_ENV=production` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | frontend | sin definir mientras no se decida E-9 | — |
| `CLIENT_URL` | backend | URL pública del frontend | Se usa en los enlaces de baja |

## 3. Validaciones previas (en staging, con BD de pruebas)

1. Ejecutar `evidencias/pruebas/privacy.test.js` contra la versión que se vaya a desplegar: 24/24.
2. Ejecutar `consent.sim.test.mjs`: 6/6.
3. `npx eslint src`: sin errores nuevos respecto a la base. `npx next build` con la configuración real.
4. E2E en navegador: escenarios a–f de cookies (con GA de pruebas si se va a activar), compra completa con cada medio de pago en sandbox (Wompi y Nequi), registro, newsletter y baja, PQR, solicitudes especiales y reseñas.
5. Revisar que ninguna página destinada a publicarse contenga "PLACEHOLDER".
6. Respaldo de la BD de producción antes del despliegue (procedimiento del proveedor, E-3).

## 4. Manejo de enlaces antiguos

| Enlace antiguo | Comportamiento nuevo |
|---|---|
| `/pedido/confirmacion?order=…&email=…&name=…&total=…` | La página reescribe la URL a `?order=…`, ignora el correo y los importes y, sin token ni sesión, muestra un modo limitado que remite a seguimiento o a iniciar sesión. **No revela datos** |
| `/seguimiento?order=…&email=…` | Prellena solo el número de pedido y elimina el correo de la barra de direcciones |
| `/login?email=…` | El parámetro se ignora (la página de login no lo usaba) |
| `GET /api/*/track?…&email=…` (cachés, marcadores) | 410 sin procesar; el log registra la URL redactada |
| Retorno de Wompi `…?order=…&payment=wompi&id=…&env=…` | La confirmación funciona con el token de la sesión; los parámetros extra se retiran de la barra de direcciones (la página no los usa; el estado del pago llega por webhook) |

**Exposición histórica:** los correos que ya quedaron en historiales, logs del hosting (E-4) o registros de terceros **no se eliminan con este despliegue**. Cualquier depuración de logs históricos requiere una evaluación separada (conservación, obligaciones de seguridad) y **no debe hacerse automáticamente**.

## 5. Comprobaciones posteriores

1. `GET /api/legal/notices` responde con las versiones y los estados esperados.
2. Una compra de prueba controlada (si se autoriza) muestra el resumen con precios unitarios. La URL de confirmación contiene solo `order`. El comprador recibe el acuse con el estado del pago correcto.
3. `GET /api/checkout/track?...` → 410.
4. En los logs de acceso del día, ningún valor de `email=` sin redactar.
5. Pie de página: enlace a la SIC visible; enlace a PQR solo si está habilitado.
6. Exportación de la newsletter: solo suscriptores con evidencia, con `unsubscribeUrl`. Configurar en la herramienta externa (E-8) el uso de ese enlace y la importación de bajas.
7. Sin GA: no aparece banner y la red no muestra peticiones a Google. Con GA: escenarios a–f.

## 6. Reversión

| Situación | Acción |
|---|---|
| Fallo general tras desplegar | Volver a desplegar **juntos** la versión anterior del backend y del frontend. Los campos y colecciones nuevos se pueden quedar: el código antiguo los ignora (Mongoose no falla con campos extra) |
| Solo falla el acuse | Dejar `RESEND_API_KEY` como está e investigar; el pedido no se bloquea por un fallo del acuse (queda `buyerReceipt.lastError`) |
| Problemas con PQR | `PQR_PUBLIC_ENABLED=false` y `NEXT_PUBLIC_PQR_ENABLED=false` (y recompilar el frontend) |
| Problemas con recordatorios | Quitar `MARKETING_TOKEN_SECRET` (detiene todos los envíos comerciales) o desactivar `abandonedCart.enabled` en el panel |

**Datos tras una reversión:**

- **No borrar** `ConsentRecord`, `MarketingSuppression` ni `CustomerRequest`: son evidencias y solicitudes de titulares.
- Si se revierte, las bajas registradas deben **seguir respetándose** manualmente (exportar `MarketingSuppression` y aplicarlas en la herramienta de envío). Las PQR radicadas deben atenderse aunque el formulario se desactive.
- `CONSENT_VERSION` "2" → "1": la reversión del frontend restaura el comportamiento anterior de las claves locales. No afecta a GA mientras siga desactivado.
