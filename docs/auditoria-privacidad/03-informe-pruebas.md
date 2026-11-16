# C. Informe de pruebas

Fecha: 2026-11-16. Node v24.15.0, npm 11.12.1, Windows 11.

## 1. Entorno

| Elemento | Configuración |
|---|---|
| Base de datos | `mongodb-memory-server@10` (instalado fuera del repo), host `127.0.0.1`, efímera |
| Variables | Fijadas en la prueba; **no se cargó ningún `.env`**. Resend, Wompi, Nequi y Cloudinary vacíos. `MARKETING_TOKEN_SECRET` y JWT aleatorios por ejecución. `PQR_PUBLIC_ENABLED=true` y `CONSENT_ACCEPT_DRAFT_FOR_TESTS=true` **solo en la prueba** |
| Red | `fetch` bloqueado para hosts no locales. **Intentos registrados: 0** |
| Correo | Transportes sustituidos por espías en memoria; los demás correos quedan en modo desarrollo (sin clave, sin envío) |
| Pagos | No se ejercieron Wompi ni Nequi; se usó contra entrega |
| Datos | Sintéticos, dominio `example.test` |

## 2. Comandos ejecutados y resultados

| # | Comando | Resultado |
|---|---|---|
| C-1 | `node -e "require('./src/app.js')"` (backend) | Carga correcta |
| C-2 | `node --test privacy.test.js` (backend + BD en memoria) | **24/24 PASS**, 0 fallos, ~8,9 s |
| C-3 | `node --import ./register-hooks.mjs --test consent.sim.test.mjs` | **6/6 PASS** (adaptadores simulados) |
| C-4 | `npx eslint src` (frontend) | 35 errores y 13 avisos, **todos preexistentes**: los archivos tocados tienen el mismo número de errores que su versión en HEAD (comprobado con `git show HEAD:… \| eslint --stdin`). Los 2 errores nuevos que introduje se corrigieron |
| C-5 | `NEXT_PUBLIC_API_URL=http://127.0.0.1:9/api npx next build` | **Build correcto**: 47 rutas, incluidas `/baja`, `/pqr`, `/pqr/seguimiento` y `/admin/pqr` |
| C-6 | Escaneo de `.next/static` | 0 patrones `?email=` o `&email=`; 0 llamadas `get("/checkout/track")` o `get("/special-requests/track")`; `dizor_guest_email` solo aparece en el código de limpieza |
| C-7 | `curl https://www.sic.gov.co/` | 302 → `https://sedeelectronica.sic.gov.co/` 200, título "SIC \| Sede Electronica" |

El backend no tiene pruebas propias (`npm test` solo imprime "no test specified"). No hay suite E2E en el proyecto.

## 3. Casos de integración del backend (C-2)

| ID | Escenario | Esperado | Observado |
|---|---|---|---|
| P-01 | `GET /api/legal/notices` | Versiones del servidor; términos `missing` | PASS |
| P-02 | Checkout sin autorización | 400; no se crea el pedido | PASS |
| P-03 | Checkout con `privacyAuthorization: "true"` (cadena) | 400 | PASS |
| P-04 | Checkout con autorización y `textVersion` inventado por el cliente | 201; token; respuesta sin correo; `Order.legal` con la versión del servidor; `ConsentRecord` sin IP; acuse con las líneas, el precio unitario, el total, la forma y el estado del pago y el tiempo de entrega, sin enlace de baja | PASS |
| P-05 | Reintento con la misma clave de idempotencia | Mismo pedido; sin segundo acuse; token anterior inválido | PASS |
| P-06 | Confirmación con token válido / inválido / pedido ajeno | 200 sin dirección / 404 / 404 | PASS |
| P-07 | Token vencido | 404 | PASS |
| P-08 | Fallo del proveedor de correo y reintento concurrente | Reclamación liberada y error guardado; después, exactamente 1 envío | PASS |
| P-09 | Seguimiento POST correcto / correo erróneo / GET antiguo | 200 / 404 / 410 | PASS |
| P-10 | Redacción de URL para logs | `email` y `orderNumber` redactados; `page` conservado. En el log real de la prueba: `GET /api/checkout/track?orderNumber=[redactado]&email=[redactado] 410` | PASS |
| P-11 | Registro sin / con autorización | 400 sin crear el usuario / 201 con evidencia | PASS |
| P-12 | Usuario registrado sincroniza el carrito | 0 `AbandonedCart` | PASS |
| P-13 | Newsletter sin / con autorización | 400 / 201 con `lastConsentRecord` | PASS |
| P-14 | Exportación CSV (admin) | Incluye al suscriptor con evidencia y `unsubscribeUrl`; excluye al heredado sin borrarlo | PASS |
| P-15 | Baja por token (2 veces) y token manipulado | 200 / 200 idempotente; 1 supresión; 1 revocación; manipulado → 400; desaparece de la exportación | PASS |
| P-16 | Recordatorio: sin autorización; domingo; sin secreto; martes 10:00; carrito heredado; baja y nuevo ciclo | 400; `outside_contact_window`; `unsubscribe_not_configured`; 1 enviado; el heredado no recibe; después de la baja, 0 enviados | PASS |
| P-17 | Evidencia con texto en borrador fuera del modo de prueba | No autoriza envíos | PASS |
| P-18 | `ConsentRecord` updateOne / deleteMany | Rechazados | PASS |
| P-19 | Solicitud especial sin / con autorización; seguimiento POST; GET | 400 / 201 con evidencia / 200 / 410 | PASS |
| P-20 | Reseña sin autorización de publicación | 400 | PASS |
| P-21 | PQR con el canal deshabilitado | 503; nada se guarda | PASS |
| P-22 | PQR sin autorización; tipo de otra categoría; válida; de datos personales | 400; 400; 201 con radicado `PQR-AAAAMMDD-XXXXXXXX` persistido y código guardado como hash; 201 con categoría `datos_personales` | PASS |
| P-23 | Seguimiento PQR: código correcto / incorrecto / radicado ajeno con mi código | 200 sin datos de contacto / 404 / 404 | PASS |
| P-24 | Admin PQR: cliente → 403; admin lista y actualiza; nota interna oculta en el seguimiento público | 403 / 200, historial de 2 entradas / nota pública visible, interna no | PASS |

## 4. Casos con adaptadores simulados del frontend (C-3)

> **No es una prueba en navegador.** `window`, `localStorage`, `document.cookie` y `gtag` son simulaciones. Valida la lógica de los módulos, no el comportamiento real de Chrome, Firefox o Safari ni las peticiones reales a Google.

| ID | Escenario | Observado |
|---|---|---|
| S-01 | Registro v1 con analítica aceptada + clave antigua "granted" | Analítica denegada, banner pendiente, clave antigua eliminada — PASS |
| S-02 | Sin consentimiento | 0 llamadas a gtag — PASS |
| S-03 | Aceptar | Registro v2; evento con `page_location` sin el parámetro `email` de la URL — PASS |
| S-04 | Ruta `/pedido/confirmacion` | 0 eventos; `page_location` nulo — PASS |
| S-05 | Rechazar tras aceptar | Borra `_ga` y `_ga_*` (también en el dominio padre) y las marcas de compra; conserva el carrito y otras cookies; 1 recarga — PASS |
| S-06 | Retirada completa | Preferencias nulas; analítica denegada — PASS |

## 5. Pruebas NO EJECUTADAS

| Prueba | Motivo | Cómo ejecutarla |
|---|---|---|
| Consentimiento en navegador: primera visita, aceptar, rechazar, elección parcial, retirada, recarga, navegación interna; red (Network) y almacenamiento (Application) | Sin herramienta de navegador en la sesión; GA inactivo (sin ID) | Entorno local con BD aislada e **ID de GA4 de pruebas**; DevTools; los seis escenarios a–f del informe |
| Validación de la CSP con GA4 real (endpoints regionales) | GA desactivado por decisión pendiente (E-9) | Igual que la anterior, revisando la consola por violaciones de CSP |
| Recorrido completo del checkout en la interfaz (resumen, impresión, casilla, confirmación con cada estado de pago) | Sin navegador | Navegador con el backend apuntando a la BD aislada |
| Flujo Wompi (redirección y webhook) y Nequi (API/manual) | No se tocaron; requieren el sandbox de la pasarela | Sandbox de Wompi/Nequi en un entorno de pruebas autorizado |
| Visibilidad del enlace a la SIC y de la etiqueta de reseñas de marca | Sin navegador | Inspección visual |
| Regresión de login, cuenta y carrito en la interfaz | Sin navegador. El backend de registro, login y sincronización de carrito sí se ejercitó en P-11, P-12 y P-14 | Navegador |
| Navegación de las páginas legales sin errores en tiempo de ejecución | Solo build (prerenderizado correcto de `/politica-de-cookies`, `/politica-de-privacidad`, `/pqr`, `/baja`) | Navegador |
| Límite 429 del seguimiento de solicitudes | Se reutilizó el limitador existente y no se forzó para no alterar el resto de la secuencia | Prueba dedicada con 16 peticiones |
| Envío real de correos (Resend) | Prohibido: sin comunicaciones reales | Entorno de pruebas con buzón capturado |
| Ausencia de PLACEHOLDER en páginas "para publicar" | **Falla por diseño**: privacidad y cookies conservan PLACEHOLDER porque faltan E-1 y E-2. Ninguna página con PLACEHOLDER debe publicarse como definitiva | Repetir tras completar E-1 y E-2 |

No se declaran porcentajes de cumplimiento.
