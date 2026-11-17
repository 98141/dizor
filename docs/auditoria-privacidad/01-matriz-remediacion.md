# A. Matriz de remediación — DIZOR

| Campo | Valor |
|---|---|
| Fechas | Fase 1 (implementación), fase 2 (validación local) y fase 3 (datos reales, pagos, textos y expediente jurídico): 2026-11-16 |
| Documento de entrada | `informe-auditoria-2026-11-16.md` (se conserva sin cambios) |
| Base de código | `main` @ `10cdf28` (el propietario confirmó las fases 1–2 en `1f3ff14` y `10cdf28`) + cambios locales sin confirmar del propietario + fase 3. Esta tarea no hizo commits |
| Alcance | Solo la copia local. Producción, su BD, CMS, correos, pagos y tareas programadas **no** se modificaron |
| Expediente jurídico | Entrada: `07-guia-revision-juridica.md`; textos completos: `08-textos-legales-consolidados.md` |

## Estados (definiciones)

| Estado | Significado |
|---|---|
| **Implementado y probado** | Con prueba ejecutada en el entorno aislado (integración P-/N-/F3-, E2E en navegador real o simulada S-) |
| **Implementado, pendiente de prueba** | El código existe y compila, pero la prueba que lo cierra no se pudo ejecutar |
| **Texto listo, revisión jurídica pendiente** | Texto definitivo con datos reales, publicable técnicamente, sin aprobación de abogado |
| **Pendiente de datos** | Falta información del propietario (`04-…`) |
| **Pendiente jurídico** | Requiere decisión de un abogado (`07-…` §3) |
| **Pendiente de verificar contra producción** | Depende de lo que corre en producción |
| **Pendiente de despliegue** | Aplica a **todo** lo implementado: nada está publicado |

**Ningún hallazgo está cerrado en producción.**

## Matriz de los 28 hallazgos originales

| ID | Hallazgo | Corrección (local) | Evidencia | Estado | Bloquea el cierre |
|---|---|---|---|---|---|
| H-01 | Responsable no identificado; política con PLACEHOLDER | Política reescrita con la sociedad, NIT, domicilio y canales | E2E L-* (sin marcas) | **Texto listo, revisión jurídica pendiente** (J-1, J-2) | Revisión jurídica |
| H-02 | Política sin los tratamientos reales | Tabla de tratamientos comprobada en el código; proveedores confirmados nombrados | 08 §5 | **Texto listo, revisión jurídica pendiente** (J-6). Contratos/regiones: **Pendiente de datos** (E-3) | E-3 y revisión |
| H-03 | Formularios sin aviso ni autorización registrada | `ConsentRecord` append-only; textos definitivos v2 sin marca de revisión; `true` estricto | P-02…P-22; F3 textos; E2E R-01, K-01, M-01, P-01 | **Implementado y probado**. Textos: **revisión jurídica pendiente** | Revisión |
| H-04 | Newsletter sin evidencia ni baja | Evidencia, baja sin sesión, supresión, exportación filtrada; evidencias `published` válidas, `draft` no | P-13…P-15, N-06; E2E M-01 | **Implementado y probado**. **Pendiente de datos** (E-8, E-15) + jurídico (J-3, Ley 2300) | — |
| H-05 | Recordatorios: alta automática y sin baja | Opt-in, baja, franja; **función desactivada** por decisión del negocio | P-12, P-16, P-17, F3-M1; E2E M-02 | **Implementado y probado** (desactivado) | Reactivación: decisión + E-8, E-15, E-16 |
| H-06 | Correo y nombre en URLs y GET | Token de acceso, POST, 410, logs redactados | P-04…P-10, N-01, N-02; E2E K-01…K-04, A-01, A-02 | **Implementado y probado**. Exposición histórica: **Pendiente de datos** (E-4) | — |
| H-07 | Claves de consentimiento desincronizadas | Registro versionado "3" | S-01; E2E C-02, C-03 | **Implementado y probado** | — |
| H-08 | Retirar no detiene GA | Borrado de `_ga*`, recarga, exclusiones | S-02, S-04, S-05; E2E C-04 | GA: **Implementado, pendiente de prueba** (GA apagado por decisión) | — |
| H-09 | Banner y política anuncian GA inactivo | Inventario de tecnologías opcionales; banner móvil | E2E C-01, C-04, C-06, L-móvil | **Implementado y probado** | — |
| H-10 | Inventario de cookies | Tabla real; contacto definitivo | E2E C-01…C-05, L-* | **Texto listo, revisión jurídica pendiente** (J-7) | Revisión |
| H-11 | Sin canal de derechos ni supresión | Canal PQR `datos_personales`; procedimiento con plazos de la Ley 1581 publicados; procedimiento operativo (07 §7) | P-21…P-24, N-04, N-05, F3-Q1; E2E P-01…P-04 | Canal: **Implementado y probado**, **sin activar** (E-2: buzón y acceso de Roger). Supresión: **Pendiente de datos** (E-6) | Activación |
| H-12 | Sin conservación ni purga | Matriz de conservación interna (07 §5); nada se purga | — | **Pendiente de datos** (E-6) + **jurídico** (J-11) | — |
| H-13 | Encargados y transferencias | Registro de encargados (07 §6); texto prudente sobre tratamiento fuera de Colombia | — | **Pendiente de datos** (E-3) + **jurídico** (J-6) | — |
| H-14 | Reseñas: aviso y reseñas de marca | Autorización v2 (sin fotos sin autorización aparte); etiqueta "Publicada por la tienda" | P-20 | **Implementado y probado**. Respaldo: **Pendiente de datos** (E-11) | — |
| H-15 | Sin identificación del vendedor | Pie, términos, política, acuse y constancia PQR con razón social, NIT, domicilio registrado, correo y horario | E2E L-*, K-01 (acuse) | **Implementado y probado**. Notificación judicial y teléfono: **jurídico** (J-2) y E-21 | Revisión |
| H-16 | Sin enlace a la SIC | Enlace en el pie | E2E L-* | **Implementado y probado** | — |
| H-17 | Sin términos y condiciones | `/terminos-y-condiciones` (imprimible) + casilla obligatoria versionada | F3 checkout; E2E K-01, L-* | **Implementado y probado**; texto: **revisión jurídica pendiente** (J-14) | Revisión |
| H-18 | Retracto, garantía, reversión y cambios | `/garantias-y-devoluciones` con cuatro figuras separadas; `/pagina/cambios` redirige | E2E L-* | **Texto listo, revisión jurídica pendiente** (J-4, J-5, J-9, J-10, J-15) | Revisión; E-20 |
| H-19 | Checkout sin resumen ni términos | Resumen, corrección, impresión, términos, envío incluido | P-04, F3; E2E K-01 | **Implementado y probado**. Plazo de entrega: **bloqueado** (E-10) | E-10 |
| H-20 | Sin acuse; confirmación engañosa | Acuse con vendedor, envío incluido y estado real | P-04, P-05; E2E K-01 | **Implementado y probado**. Tiempo de entrega: **Pendiente de datos** (E-10) | E-10 |
| H-21 | Plazo de entrega no informado | Soporte para mostrar y guardar el plazo aceptado (`config/deliveryTerms.js`); **no se publica** el plazo ambiguo | F3-P1 (`deliveryTerms: null`); E2E L-* (sin plazos en Envíos) | **Pendiente de datos** (E-10) + **jurídico** (J-8) | **Bloqueo de publicación** |
| H-22 | Sin PQR con radicado | Formulario, radicado, constancia, seguimiento, panel, idempotencia, aviso interno | P-21…P-24, N-04, N-05, F3-Q1; E2E P-01…P-04 | **Implementado y probado**, **sin activar** (E-2) | Activación |
| H-23 | Afirmaciones sin respaldo | Sin cambios (CMS) | — | **Pendiente de datos** (E-11) | — |
| H-24 | Producción ≠ repositorio | Evidencia acotada (`02-…` §5.2) | GET públicos (fase 2) | **Pendiente de verificar contra producción** (E-12) | Despliegue |
| H-25 | IVA sumado (latente) | Sin cambios; precios finales con impuestos | — | No aplicable actualmente | Revisar antes de activar IVA |
| H-26 | Aplicabilidad del RNBD | Regla verificada; forma jurídica recibida (SAS) | — | **Pendiente de datos** (E-13) + **jurídico** (J-12) | — |
| H-27 | Menores y datos sensibles | Indicación en política y PQR | — | No aplicable | — |
| H-28 | Controles menores | Limitadores; URLs redactadas | P-10, P-19 | **Implementado y probado**. Conservación de `AuditLog`: E-6 | — |

**Todos los elementos "Implementado…" y "Texto listo…" están además en estado "Pendiente de despliegue".**

## Defectos y riesgos encontrados en las validaciones

| ID | Descripción | Estado |
|---|---|---|
| **V-01** | Nequi en `mock` por defecto: webhook sin firma podía marcar pagado un pedido `nequi_api` | **Local: corregido y probado** (integración desactivada, sin mock por omisión, 410; F3-P2, F3-P4, F3-P5, E2E X-01). **Producción: abierto** — contención por configuración documentada en `06-…` §7.1 (no ejecutada) y conciliación en §7.2 (E-18, E-22) |
| V-02 | Banner de cookies ocupaba media pantalla en móvil | Corregido y probado |
| V-03 | Controles de cookies condicionados solo a GA | Corregido y probado. Calificación del contador: J-7 |
| V-04 | PQR duplicables por reintento | Corregido y probado |
| V-05 | Rotación del secreto rompía enlaces de baja | Corregido y probado |
| V-06 | 400/410 sin orientación | Corregido y probado |
| **V-07** (fase 3) | Webhook Wompi: sin validación de moneda, entorno ni método del pedido; un evento rechazado posterior podía cancelar un pedido pagado; ventana de 5 min rechazaba los reintentos oficiales | Corregido y probado (F3-W1, F3-W2). Sin prueba con Wompi real |
| **V-08** (fase 3) | La API aceptaba `nequi_manual` aunque el checkout ya no lo ofreciera | Corregido y probado (F3-P2) |
| **V-09** (fase 3) | Espacio perdido tras `</strong>` antes de `&quot;` en páginas nuevas | Corregido (E2E final) |

## Decisiones del negocio aplicadas (fase 3)

| Decisión | Implementación | Prueba |
|---|---|---|
| Solo Wompi y contraentrega | `services/paymentMethods.js`; Nequi propio inactivo con código conservado | F3-P1, F3-P2, F3-P5; E2E X-01 |
| Envío incluido en el precio, sin "envío gratis" | `isShippingIncluded`; textos "Incluido en el precio" | F3-S1; E2E K-01, M-02 |
| Transportadoras Inter Rapidísimo / Servientrega | `CONFIRMED_CARRIERS` + validación | F3-P3; E2E X-01 |
| Recordatorios preparados pero desactivados; GA apagado | `MARKETING_CART_REMINDERS_ENABLED` | F3-M1; E2E M-02 |
| Plazos ambiguos bloqueados | `deliveryTerms` en `pending_definition` | F3-P1; E2E L-* |

## Bloqueos que impiden publicar

Lista final en `06-plan-despliegue-reversion.md` §0.
