# 04 · Infraestructura, configuración y V-01

**No accedí a ningún entorno real.** No hay evidencia del entorno de producción en el repositorio. Todas las filas siguientes son documentales o locales.

## 1. V-01: webhook Nequi antiguo en producción

| Aspecto | Estado |
|---|---|
| Versión desplegada | **No identificada con certeza.** Según `docs/auditoria-privacidad/06-plan-despliegue-reversion.md` §1, el backend de producción coincide con `237b4bd…68e986b` y el frontend con `245d22a…cbddfe3`. La última rama ligada a un despliegue (`origin/develop`, `ea6e71b`, 2026-07-14) está **53 commits por detrás** de `main` |
| Vulnerabilidad | La versión desplegada usa `NEQUI_ENV \|\| "mock"`, y en ese modo su webhook no verifica la firma |
| Contención | **Plan preparado** (`preproduccion/04`, `06-plan…` §7.1): `NEQUI_ENV=disabled`, retirar las credenciales de Nequi y reiniciar solo la API. **No ejecutado.** No hay release, captura de configuración, reinicio ni logs |
| Local | Corregido: el webhook responde 410 (C32) y `paymentMethods.js` ya no ofrece Nequi. **No protege lo desplegado** |
| Estado | **ABIERTO.** Bloquea producción |

Es independiente del lanzamiento: **la contención debe ejecutarse ya**, aunque no se despliegue nada nuevo. Mientras siga abierta, un tercero podría marcar como pagados pedidos Nequi en la versión actual.

## 2. Checklist de infraestructura

| Control | Evidencia | Tipo | Estado |
|---|---|---|---|
| URL del webhook de producción y HTTPS | Ninguna | — | BLOCKED |
| Llaves por ambiente (`prv_prod_`, `prod_events_`) | El arranque falla si no coinciden con `WOMPI_ENV` (R16, `server.js:28-35`) | LO | Control de código OK; secretos reales sin verificar |
| Variables obligatorias | Inventariadas abajo | DO | Sin verificar en el destino |
| MongoDB en replica set | Las transacciones son obligatorias (`inTransaction`). Probado solo en un replica set efímero | LO | BLOCKED en el destino |
| Índices únicos | Definidos en los modelos (lista abajo). `autoIndex` de Mongoose está activo: al arrancar, intenta crearlos sobre datos de producción **no inventariados**. Si hay duplicados u opciones distintas (por ejemplo, el índice histórico de `idempotencyKey`), la creación falla y **la garantía de idempotencia o unicidad queda ausente en silencio** | LO + DO | BLOCKED: hace falta inventario previo y plan de migración (`CHECKLIST_DESPLIEGUE_PENDIENTE.md`) |
| Respaldo y restauración probada | Ninguna | — | BLOCKED |
| Permisos y acceso administrativo | Roles probados en local (C11, D15, F20, G02) | LO | Personas y MFA sin verificar |
| Logs | `logger` redacta las URL; los 5xx se registran | LO | Retención y acceso sin verificar |
| Alertas reales | Outbox y bandeja probados en local; `TRANSACTIONAL_NOTIFICATIONS_ENABLED` apagado; entrega por Resend nunca probada | LO | BLOCKED |
| `trust proxy` y CORS | `trust proxy=1` en producción (documentado); `CLIENT_URL` sin verificar | DO | BLOCKED |
| Conciliación diaria | Herramientas en el panel (bandeja, conciliar por ID, archivar y concluir). **Procedimiento y responsable no designados** | LO | BLOCKED |

## 3. Variables de entorno que exige el código del backend

**Obligatorias para pagos y seguridad:**
- `NODE_ENV=production`, `WOMPI_ENV=production`.
- `WOMPI_PRIVATE_KEY` (`prv_prod_…`) y `WOMPI_EVENTS_SECRET` (`prod_events_…`).
- `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
- `CLIENT_URL`.

**Notificaciones:** `TRANSACTIONAL_NOTIFICATIONS_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`.

**Deben quedar sin definir o desactivadas en producción:**
- `NEQUI_ENV`: `disabled`.
- `NEQUI_DIRECT_ENABLED` y `NEQUI_MANUAL_ENABLED`.
- Las credenciales `NEQUI_*`.
- `CONSENT_ACCEPT_DRAFT_FOR_TESTS`: acepta textos legales en borrador.
- `FORCE_DEMO_ORDER`: script de demostración.

**Frontend:** `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SITE_URL`, fijadas en el build.

## 4. Conclusión

**No existe ninguna evidencia del entorno real.** Producción no puede autorizarse sin tres cosas:
1. La contención de V-01.
2. El inventario de índices y variables.
3. Un respaldo restaurado y la entrega real de alertas.
