# 07 · Checklist de producción — Wompi y pedidos

Auditoría independiente · 2026-11-23. Ninguna casilla está marcada: esta lista no autoriza el despliegue. Columna **Dónde**: **R** = demostrable en el repositorio/arnés aislado; **E** = requiere validación externa (panel Wompi, infraestructura, Sandbox).

## 1. Bloqueantes previos (no cerrar sin evidencia)

| ☐ | Tarea | Dónde | Referencia |
|---|---|---|---|
| ☐ | Corregir WP-01 a WP-04 y repetir el arnés con X01, P13, P20, P22b, P04b en PASS | R | 06 |
| ☐ | Ejecutar E01–E05 en Sandbox real (llaves `pub_test_`, `prv_test_`, `test_events_`) con URL pública HTTPS | E | 05 |
| ☐ | Contención de V-01 en producción (Nequi `mock` sin firma) según `docs/auditoria-privacidad/06-plan-despliegue-reversion.md` §7.1 | E | 08 §4 |

## 2. Configuración Wompi

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | `WOMPI_ENV=production`, `NODE_ENV=production` (el arranque falla si no coinciden: `server.js:28-31`) | R+E |
| ☐ | `WOMPI_PRIVATE_KEY` con prefijo `prv_prod_` y `WOMPI_EVENTS_SECRET` con prefijo `prod_events_` (no lo valida el código: WP-13) | E |
| ☐ | Confirmar que el secreto de eventos NO es la llave privada ni el secreto de integridad | E |
| ☐ | URL de eventos en el panel de Wompi (producción) = `https://<api>/api/webhooks/wompi`, accesible desde Internet con TLS válido | E |
| ☐ | `CLIENT_URL` productivo (construye `redirect_url` y CORS) | E |
| ☐ | Transacción real de prueba de bajo monto con tarjeta propia: evento recibido, `payment_link_id` presente, pedido `pagado`, stock −1 | E |
| ☐ | Decidir vigencia de enlaces (`expires_at`) y mecanismo de cierre al cancelar (WP-07, E05) | R+E |

## 3. Secretos

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | Secretos solo en el gestor del hosting; nunca en el repositorio ni en el frontend (búsqueda actual sin hallazgos) | R+E |
| ☐ | Rotación documentada y responsable asignado | E |
| ☐ | Logs productivos sin cabeceras `Authorization` ni cuerpos de webhook | E |

## 4. Backend y base de datos

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | MongoDB destino es replica set o mongos (transacciones obligatorias: `transactionService.js`) | E |
| ☐ | Índices: `PaymentEvent.key` único, `Order.orderNumber` único, `Order.idempotencyKey` parcial único, `Notification.eventKey` | R (suite A0) + E (destino) |
| ☐ | Backup y restauración verificados antes de recibir dinero | E |
| ☐ | `trust proxy` correcto detrás del proxy real; webhook fuera del limitador global (WP-14) | R+E |

## 5. Inventario

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | Política aprobada para la última unidad en Wompi (sin reserva hoy: WP-08) | E (decisión) |
| ☐ | Stock histórico entero y no negativo antes de abrir ventas (requisito de `inventoryService.js:25`) | E |
| ☐ | Procedimiento para `approved_without_stock`: reponer + conciliar (P35) o devolver | E |

## 6. Alertas y conciliación

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | Alertas para eventos no asociados, aplicación fallida, monto discrepante, anulación y pendientes antiguos (WP-10) | R |
| ☐ | `TRANSACTIONAL_NOTIFICATIONS_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL` definidos y probados con buzón real | E |
| ☐ | Conciliación posible sin webhook (WP-02) y procedimiento diario de cruce panel Wompi ↔ pedidos | R+E |
| ☐ | Resolución auditada de incidencias (WP-03) | R |

## 7. Pruebas

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | Suite existente 275/275 en verde sobre la versión a desplegar | R |
| ☐ | Arnés `auditoria-wompi.cjs` sin FAIL | R |
| ☐ | E2E en Sandbox: aprobado (4242…), rechazado (4111…), Nequi 3991111111/3992222222, PSE banco aprobador/rechazador, reintento | E |
| ☐ | Smoke productivo con compra real controlada y devolución manual documentada | E |

## 8. Recuperación y administración

| ☐ | Tarea | Dónde |
|---|---|---|
| ☐ | Procedimiento escrito de devolución manual (no existe API de reembolso en la app: P40) | E |
| ☐ | Responsable de la bandeja “Requieren revisión” y tiempos de atención | E |
| ☐ | Plan de reversión que no cambie estados de pago a mano | E |
| ☐ | Verificar que el personal no anule cobros desde el panel de Wompi mientras exista WP-04 | E |
