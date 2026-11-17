# C. Informe de pruebas

Fases 1 (implementación), 2 (validación final local) y 3 (datos reales, pagos y textos), todas el 2026-11-16. Node v24.15.0, npm 11.12.1, Windows 11.

Reproducibilidad y aislamiento: ver `evidencias/README.md`.

## 0. Fase 3 — pruebas sobre la copia final (2026-11-16)

Se repitieron todas las pruebas sobre el código final de la fase 3. Las secciones 1 a 7 describen las fases 1 y 2 y se conservan como historial.

### 0.1 Entorno (cambios respecto a las fases anteriores)

| Elemento | Fase 3 |
|---|---|
| Código probado | Árbol de trabajo actual: `10cdf28` + cambios sin confirmar del propietario (ProductCard, guía de tallas, newsletter compacta) + fase 3. La copia E2E se comparó con `diff -rq` contra `frontend/src`: **idéntica** |
| Textos | **Los textos definitivos**, sin prefijo de fixture (se prueba lo que se publicaría) |
| Variables | `CONSENT_ACCEPT_DRAFT_FOR_TESTS=false` (salvo la prueba que lo comprueba); `NEQUI_*` vacías; `MARKETING_CART_REMINDERS_ENABLED=false`; `SHIPPING_MODE=free_threshold` en BD (para probar que "envío incluido" prevalece); Wompi con valores **ficticios** solo para que el checkout lo ofrezca. Ningún `.env` |
| Red | Bloqueada fuera de `127.0.0.1`. **Intentos: 0 (navegador) / 0 (backend)** |
| Correo | Capturado en memoria. No se envió nada |

### 0.2 Resultados

| # | Prueba | Resultado |
|---|---|---|
| F3-1 | Integración `privacy.test.js` | **42/42 PASS** (33 anteriores actualizadas + 9 nuevas), con la comprobación final de logs sin tokens ni correos. Salida: `evidencias/pruebas/resultado-integracion-fase3.tap` |
| F3-2 | Simuladas `consent.sim.test.mjs` | **6/6 PASS** (`resultado-simuladas-fase3.tap`) |
| F3-3 | `next build` de la copia (limpia) | Correcto: 50 páginas estáticas, incluidas `/terminos-y-condiciones`, `/garantias-y-devoluciones` y `/pagina/envios` |
| F3-4 | E2E Chromium real | **22/22 PASS**, 0 peticiones externas (`evidencias/e2e/e2e-results.json`, 30 capturas en `capturas/fase3/`) |
| F3-5 | Lint | **LINT FAIL: 34 errores, todos preexistentes; 0 nuevos** respecto a `59a4717` (36). Detalle en `evidencias/lint/lint-compare.json` |
| F3-6 | Carga del backend (`require('./app')`) | Correcta |

### 0.3 Cobertura de los requisitos de la fase 3

| Requisito | Prueba(s) | Resultado |
|---|---|---|
| Solo Wompi y contraentrega habilitados | F3-P1; E2E X-01 (opciones visibles en el paso de pago) | PASS |
| Nequi directo y transferencia manual rechazados por el backend, incluso con cliente antiguo/manipulado y con `NEQUI_ENV=mock` | F3-P2 (7 valores, 0 pedidos creados); E2E X-01 (`fetch` directo desde el navegador → 400) | PASS |
| Endpoints y webhook propios de Nequi deshabilitados | F3-P5 (410 en create, status y webhook, también con `mock`); E2E X-01 | PASS |
| Sin modo mock por omisión (variable ausente, vacía, inválida, `mock` en producción o desarrollo) | F3-P4 (7 combinaciones + activación sin credenciales) | PASS |
| Historial preservado | F3-P5: pedidos `nequi_api` y `nequi_manual` sin cambios de estado, método ni historial; no se eliminan | PASS |
| Contraentrega no aparece pagada | Prueba de checkout (estado `pendiente`), F3-W2 (un evento Wompi no la altera), E2E K-01 (BD, confirmación y acuse) | PASS |
| Wompi: checksum, entorno, moneda, monto, método; Nequi dentro de Wompi; reintentos; sin degradar pagados | F3-W1, F3-W2 | PASS |
| Importe coherente con envío incluido | Checkout (total 100.000 sin cargo), F3-S1 (carrito, cálculo y reversión con la variable), E2E K-01 (total 240.000 y "Incluido en el precio" en revisión, confirmación y acuse), M-02 (carrito) | PASS |
| Versiones legales coherentes | Textos (`published`, versiones "2"/"1"), pedido (`termsVersion`), `ConsentRecord` de `terms`; E2E R-01 (registro v2) | PASS |
| Sin placeholders ni marcas internas | Prueba de textos (casillas); E2E L-escritorio/L-móvil en las 5 páginas legales (PLACEHOLDER, "Texto en revisión", "pendiente de…", "NO PUBLICAR", "borrador") | PASS |
| Términos obligatorios y no premarcados | Prueba de checkout (sin, `false`, `"true"` → 400); E2E K-01 | PASS |
| Consentimientos separados y baja comercial efectiva | Pruebas de newsletter, baja, exportación y N-06; E2E M-01 | PASS |
| Evidencias en borrador no regularizadas | Prueba "evidencias: 'published' autoriza; las de borrador NO" | PASS |
| Recordatorios preparados pero desactivados | F3-M1 (config, 503, nada guardado, `feature_disabled`, 409 en el panel); E2E M-02 | PASS |
| PQR: radicado, constancia, aviso interno mínimo | Pruebas PQR, N-04, N-05, F3-Q1; E2E P-01…P-04 | PASS |
| Escritorio y móvil; sin desborde horizontal | E2E L-escritorio, L-móvil (5 páginas + pie + banner + panel) | PASS |
| Regresión de los cambios visuales del propietario | E2E: `/guia-de-tallas` y `/catalogo` responden 200 y se capturan en ambos tamaños (`R-*.png`); el resto de flujos navega por esas plantillas | PASS (revisión visual de capturas; sin comparación píxel a píxel) |
| Página "Envíos y entregas" | E2E: título exacto, ruta `/pagina/envios`, transportadoras, envío incluido, sin "gratis" ni plazos | PASS |
| `/pagina/cambios` | E2E: redirige a `/garantias-y-devoluciones` | PASS |

### 0.4 Incidencias durante la validación (no se ocultan)

| Ejecución | Resultado | Causa | Acción |
|---|---|---|---|
| Integración 1 | 41/42 | F3-Q1 superó el límite de 10 PQR/hora del endpoint (el límite funciona) | La prueba llama al servicio directamente |
| E2E 1 | Error de sintaxis | Restos del escenario M-02 anterior en el script | Corregido el script |
| E2E 2 | 20/22 | R-01 esperaba `draft`; A-01 no marcaba la nueva casilla de términos | Expectativas del script actualizadas |
| E2E 3 | 22/22 | — | Captura del pie mostró el correo en una línea aparte → corrección de CSS (`.site-footer__seller a { display: inline }`) |
| E2E 4 | 20/22 | Servidor anterior aún en el puerto 3100 sirviendo un build mezclado (desborde y CSS rechazado) | Se detuvo solo el proceso de la copia aislada; build limpio |
| E2E 5 | 22/22 | — | La extracción del texto para `08-…` detectó "personalización:su ficha": el compilador quitaba el espacio tras `</strong>` antes de `&quot;` |
| E2E 6 (final) | **22/22** | Build limpio con la corrección de espacios; copia idéntica a `frontend/src` | — |

Mensajes de consola en la ejecución final (99): 92 respuestas 401 de la comprobación de sesión anónima (preexistentes) y 7 provocados por las pruebas negativas (400, 404, 410, 503).

Nota: durante la validación se observó en la máquina un proceso `next` lanzado desde la carpeta `frontend/` del proyecto (no iniciado por esta tarea). No se tocó.

## 1. Entorno

| Elemento | Configuración |
|---|---|
| Código probado | Árbol de trabajo en el momento de la última sincronización de la copia E2E: commits `1f3ff14` (fase 1) y `10cdf28` (16:58, confirmado **por el propietario**; incluye los cambios de código de la fase 2 y su rediseño de confirmación, seguimiento y cuenta). Esta tarea no hizo ningún commit. Ediciones posteriores del propietario **no cubiertas** por el E2E: `ProductCard.jsx` y `product-card.css` (estilos de tarjeta de producto, sin relación con la privacidad) |
| Base de datos | `mongodb-memory-server` en `127.0.0.1`, efímera. Se usó el binario ya descargado en la fase 1; no hubo descargas nuevas |
| Variables | Fijadas en los arneses. **No se cargó ningún `.env`.** Resend, Wompi, Nequi y Cloudinary vacíos. `MARKETING_TOKEN_SECRET` exclusivo de pruebas y aleatorio en cada ejecución. `PQR_PUBLIC_ENABLED=true` y `CONSENT_ACCEPT_DRAFT_FOR_TESTS=true` solo en pruebas |
| Textos legales | Los mismos borradores, prefijados con `[FIXTURE DE PRUEBA]` en el arnés E2E. **Pasar estas pruebas no aprueba ningún texto** |
| Red | Backend: `fetch` bloqueado para hosts no locales. Navegador: toda petición fuera de `127.0.0.1` se aborta y se registra. **Intentos: 0 / 0** |
| Correo | Todas las funciones de envío sustituidas por capturas en memoria. **No se validó Resend** |
| Pagos | Contra entrega. **No se validaron Wompi ni Nequi** |
| Navegador | Chromium headless de Playwright 1.61.1, ya presente en la caché local de npx (`%LOCALAPPDATA%\npm-cache\_npx`) y en `ms-playwright`. **No se descargó ni instaló nada** |
| Frontend E2E | Copia de `frontend/` en una carpeta temporal, sin `.env`. `next build` con `NEXT_PUBLIC_API_URL=http://127.0.0.1:5100/api` y `NEXT_PUBLIC_PQR_ENABLED=true`; `next start` en `127.0.0.1:3100`. El `.next` del proyecto no se usó |

## 2. Comandos ejecutados y resultados

| # | Comando | Resultado |
|---|---|---|
| C-1 | `node -e "require('./src/app.js')"` | Carga correcta (fase 1 y tras los cambios de la fase 2) |
| C-2 | `node --test privacy.test.js` | **31/31 PASS** (24 de la fase 1 + 7 negativas nuevas), incluida la comprobación final de que los logs no contienen tokens ni correos |
| C-3 | `node --import ./register-hooks.mjs --test consent.sim.test.mjs` | **6/6 PASS** (adaptadores simulados; actualizado a la versión de consentimiento "3") |
| C-4 | ESLint aislado y comparado (§6) | **LINT FAIL**: 34 errores. **0 nuevos** respecto a la base `59a4717` (36). No se desactivó ninguna regla |
| C-5 | `next build` de la copia aislada | Correcto: 47 rutas |
| C-6 | `node e2e.js` (Chromium real) | **21/21 PASS**; 0 peticiones externas; 58 mensajes de consola explicados (§5) |
| C-7 | Lecturas GET públicas de producción (H-24) | Ver `02-informe-implementacion.md` §5 |

Historial de ejecuciones de C-6 (no se ocultan los fallos):

| Ejecución | Resultado | Causa | Acción |
|---|---|---|---|
| 1 | 13/21 | Selectores del script: botón de búsqueda del encabezado, interruptor cubierto por su estilo, carga diferida de la newsletter; 3 escenarios dependían del registro fallido; textos del rediseño del propietario | Se corrigió **el script**, no la aplicación |
| 2 | 21/21 | — | Además se detectó visualmente el defecto V-02 (banner en móvil) |
| 3 | 18/21 | El propietario editó la página de confirmación durante la sesión (16:56) y quitó el texto "Pedido registrado" | La prueba ahora espera el número de pedido y el estado "Pendiente", no un texto de diseño |
| 4 | **21/21** | Código actual, incluida la corrección de V-02 y la comprobación de altura del banner | — |

## 3. Integración del backend (C-2)

### 3.1 Fase 1 (sin cambios de resultado)

P-01 a P-24 siguen en PASS: textos legales, autorización en checkout, token y acuse único, confirmación protegida, token vencido, fallo del proveedor de correo, seguimiento POST/410, redacción de URL, registro, sincronización del carrito sin alta comercial, newsletter, exportación, baja, recordatorios con franja y supresión, borrador no válido para marketing, inmutabilidad de `ConsentRecord`, solicitudes especiales, reseñas y PQR (canal deshabilitado, radicado, seguimiento y administración). El detalle está en la versión anterior de esta tabla, recogida en la matriz.

### 3.2 Fase 2: pruebas negativas de seguridad

| ID | Garantía comprobada | Resultado |
|---|---|---|
| N-01 | Conocer el número **o el id** de un pedido no da acceso: otro usuario autenticado sin token → 404 en `lookup` y 404 en `GET /orders/:id`; anónimo → 401. El dueño autenticado sí accede sin token | PASS |
| N-02 | Cambiar de método no evita la autorización: `GET`/`PUT` de `lookup` → 401/404; `GET /api/pqr/track` → 404; `GET /checkout/track` → 410 con instrucción de recargar | PASS |
| N-03 | El 400 por falta de autorización indica "recarga la página" (clientes con la versión anterior abierta) | PASS |
| N-04 | PQR idempotente: reintento con la misma clave → mismo radicado, `duplicate:true`, código nuevo y el anterior invalidado; misma clave con otro correo → 409 | PASS |
| N-05 | Dos PQR **concurrentes** con la misma clave → un solo radicado | PASS |
| N-06 | Rotación del secreto de baja: sin `MARKETING_TOKEN_SECRET_PREVIOUS` el enlace antiguo deja de validar; con él, valida; los enlaces nuevos usan el secreto vigente; un secreto de menos de 32 caracteres no firma | PASS |
| N-07 | `POST /api/visits/forget` borra la cookie `dizor_visit_day` (Expires 1970) | PASS |
| Logs | Al final de la ejecución, ningún correo, token de acceso, código PQR ni token de baja usado en las pruebas aparece en los logs capturados (winston y consola; >20 líneas inspeccionadas) | PASS |

Sin cambios respecto a la fase 1, siguen cubiertos: alcance y vencimiento del token de pedido (P-05 rotación, P-06 pedido ajeno, P-07 vencido), baja comprobada al enviar la cola (P-16) y no duplicación de pedidos y acuses (P-05, P-08).

## 4. E2E con navegador real (C-6)

Resultados completos en `evidencias/e2e/e2e-results.json`; capturas en `evidencias/e2e/capturas/`.

| ID | Escenario | Verificación (red y almacenamiento, no solo la interfaz) |
|---|---|---|
| C-01 | Primera visita | Banner visible; 0 `POST /visits/register`; sin cookie `dizor_visit_day`; sin `dizor_last_visit_day`; sin `dizor_cookie_preferences`; el texto menciona el contador y no menciona GA |
| C-02 | Aceptar | Ocurre `POST /visits/register`; aparecen la cookie y la clave; registro `{statistics:true, analytics:false, version:"3"}`; el banner desaparece |
| C-03 | Recarga y navegación interna | Decisión recordada; 0 conteos extra |
| C-04 | Retirada (pie de página → "Configurar cookies" → "Rechazar todo") | El panel refleja lo guardado; analítica no seleccionable; `POST /visits/forget`; cookie y clave **eliminadas**; tras recargar **no** se registran visitas (se detiene el tratamiento, no solo se borran cookies) |
| C-05 | Rechazar en la primera visita | Nada opcional; catálogo y carrito funcionan; el carrito se conserva |
| C-06 | Elección parcial ("Configurar" → solo estadísticas) | Nada premarcado; marketing no seleccionable; tras guardar, solo se activa el conteo |
| R-01 | Registro | Botón deshabilitado sin casilla; casilla no premarcada; tras registrarse y sincronizar el carrito: 0 `AbandonedCart`, 0 suscripciones, 1 `ConsentRecord(account, draft)` |
| K-01 | Checkout invitado | Resumen con producto, cantidad, precio unitario ($120.000) y subtotal ($240.000); "Confirmar" deshabilitado sin autorización; URL final solo con `order`; estado "Pendiente", sin afirmar pago; 0 peticiones con el correo o el nombre en la URL; 1 acuse al comprador con "Pago pendiente"; `sessionStorage` sin `dizor_guest_email` y con `dizor_order_access` |
| K-02 | Misma compra abierta en otra pestaña (sin token) | Modo limitado; no muestra productos ni correo |
| K-03 | Enlace antiguo `?order=…&email=…&name=…&total=…` | La URL queda solo con `order`; los datos se muestran por el token de la pestaña |
| K-04 | `/seguimiento?order=…&email=…` | El correo se elimina de la barra de direcciones y **no** se precarga; la consulta sale por `POST` sin el correo en la URL |
| A-01 | Comprador autenticado | Ve su pedido aun después de borrar el token de la pestaña |
| A-02 | Otro usuario autenticado | Modo limitado; no ve datos del pedido ajeno |
| M-01 | Newsletter (home) | Botón deshabilitado sin casilla; casilla no premarcada; evidencia guardada; `/baja?t=…` sin sesión → la URL se limpia → "Confirmar baja" → supresión registrada |
| M-02 | Recordatorio de carrito | Opt-in con casilla; envío en franja (martes 10:00) → 1 correo con enlace de baja; baja desde ese enlace; nuevo ciclo → 0 envíos; domingo → `outside_contact_window` |
| P-01 | PQR | Botón deshabilitado sin autorización; radicado `PQR-AAAAMMDD-XXXXXXXX` mostrado solo tras persistir; constancia capturada |
| P-02 | Seguimiento PQR | Código incorrecto → "Solicitud no encontrada"; código correcto → historial, sin el correo |
| P-03 | Administración PQR | El admin cambia el estado; la nota pública se ve en el seguimiento y la interna no |
| P-04 | Cliente en `/admin/pqr` | No ve ninguna PQR |
| L-escritorio / L-movil (390×844) | Pie de página y páginas legales | Botones del banner visibles; **banner ≤35 % de la altura en móvil** (V-02); enlace SIC `https://www.sic.gov.co/` en nueva pestaña; enlace PQR; `/politica-de-privacidad`, `/politica-de-cookies`, `/pqr`, `/pqr/seguimiento`, `/baja` y `/seguimiento` responden 200; la política de cookies muestra la sección "Estadísticas propias (opcionales)"; el panel cabe en pantalla |

## 5. Mensajes de consola del navegador (58)

| Cantidad | Mensaje | Origen | Evaluación |
|---|---|---|---|
| 28 + 28 (en la API) | 401 en `GET /api/auth/me` y `POST /api/auth/refresh-token` | Comprobación de sesión de visitantes anónimos (`AuthContext`) | Preexistente; no relacionado con la remediación |
| 1 | 404 en `POST /api/checkout/orders/lookup` | A-02 (usuario ajeno) | Esperado (caso negativo) |
| 1 | 404 en `POST /api/pqr/track` | P-02 (código incorrecto) | Esperado (caso negativo) |
| 7 (solo en el servidor) | 404 en `GET /api/content/pages/sobre-dizor` | Página del CMS inexistente en la BD de pruebas | Del dato de prueba, no del código |

## 6. Lint: comparación reproducible (C-4)

Método:

1. `git archive 59a4717` (anterior a la remediación) del frontend y copia del árbol actual, ambas fuera del proyecto.
2. Mismo `eslint.config.mjs` (idéntico salvo los saltos de línea CRLF/LF) y el mismo `node_modules` (enlazado). Dependencias sin cambios desde `59a4717`.
3. Comparación por (archivo, regla, mensaje) con `evidencias/lint/compare.py`.

| | Errores | Avisos |
|---|---|---|
| Base `59a4717` | 36 | — |
| Árbol actual | **34** | 13 (no comparados por regla) |
| Nuevos respecto a la base | **0** | |
| Desaparecidos | 2 (`confirmacion/page.js` set-state-in-effect, rediseño del propietario; `ProductForm.jsx` refs, cambio del propietario) | |

**Corrección de la fase 1:** el informe anterior hablaba de 35 errores, medidos con otro estado de los archivos del propietario. La medida reproducible actual es 36 en la base, 34 ahora y 0 nuevos.

Clasificación de los 34 (todos preexistentes, presentes en la base con la misma regla y el mismo archivo):

| Regla | N.º | Dónde | ¿Afecta a un flujo modificado? |
|---|---|---|---|
| `react-hooks/set-state-in-effect` | 29 | Paneles admin (18), contextos `AuthContext` y `CartContext`, `AuthErrorAlert`, carrito, cuenta, y en archivos tocados por la remediación: `checkout/page.js` (2: precarga del comprador y recálculo), `pedido-mayor`, `personalizar` y `ProductReviews` (precarga desde el usuario), `AdminShell` (1) | Es un aviso de rendimiento (renders encadenados) en líneas que la remediación no escribió. Los flujos afectados (checkout, solicitudes, reseñas, admin PQR) pasaron E2E. **Sin impacto funcional observado** |
| `react-hooks/static-components` | 2 | `AdminShell.jsx` (componentes de navegación definidos durante el render) | Podría reiniciar el estado de esos subcomponentes en cada render. En E2E P-03 el formulario de la página PQR conservó su estado, porque los componentes recreados son los de navegación y no el contenido. Riesgo bajo; preexistente |
| `react-hooks/preserve-manual-memoization` | 2 | `TaxonomyManager.jsx` | No relacionado |
| `react-hooks/purity` | 1 | `admin/alertas/page.js` | No relacionado |

**Estado: LINT FAIL** (34 errores preexistentes). No se corrigieron porque están fuera del alcance de los hallazgos y no son atribuibles a esta remediación; tampoco se desactivó ninguna regla.

## 7. Pruebas NO EJECUTADAS

| Prueba | Motivo concreto | Cómo ejecutarla |
|---|---|---|
| Google Analytics real: carga de gtag, peticiones `collect`, CSP regional, Enhanced Measurement | **GA debe seguir apagado** (instrucción expresa y E-9) | Con un ID de **pruebas** autorizado, en staging |
| Wompi real (redirección, webhook firmado por Wompi, reintentos reales) | No se contactan pasarelas reales. En la fase 3 el webhook se probó con eventos firmados localmente según la documentación oficial (F3-W1, F3-W2). Nequi propio: desactivado | Sandbox oficial de Wompi en un entorno autorizado |
| Envío real de correo (Resend) y entregabilidad del enlace de baja y `List-Unsubscribe` | Prohibido enviar comunicaciones reales | Buzón de pruebas del proveedor |
| Firefox y Safari (WebKit) | Solo estaba disponible Chromium en la caché; no se descargó nada | Instalar los navegadores de Playwright con autorización |
| Límite 429 del seguimiento | No se forzó (se reinicia el limitador entre escenarios) | Prueba dedicada con 16 peticiones |
| Pruebas contra producción | Prohibidas (salvo GET públicos de lectura) | — |
| Ausencia de PLACEHOLDER en las páginas a publicar | **Ejecutada en la fase 3: PASS** (§0.3). La revisión jurídica de los textos sigue pendiente | — |
| Buzón dizorsandona@gmail.com y aviso a `ADMIN_NOTIFY_EMAIL` reales | No se envían correos reales | Mensaje controlado autorizado antes de activar PQR |
| Contención de V-01 en producción | Prohibido ejecutarla o atacar el endpoint | El operador la aplica y verifica por lectura (`06-…` §7.1) |
| Cobertura de contraentrega por destino | Depende de las transportadoras (E-19) | — |

No se declaran porcentajes de cumplimiento.
