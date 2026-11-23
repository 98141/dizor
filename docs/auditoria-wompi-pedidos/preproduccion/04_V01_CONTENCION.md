# V-01 · intervención preparada, NO ejecutada

**Estado: BLOCKED / ABIERTO. Responsable propuesto: administrador del cPanel de la API DIZOR, por designar por el propietario.** La aprobación de las pruebas Sandbox no autorizó cambios del hosting productivo.

Base: `docs/auditoria-privacidad/06-plan-despliegue-reversion.md` §7 y `remediacion/06_VERIFICACIONES_SANDBOX_PENDIENTES.md`. El rango antiguo documentado, 237b4bd…68e986b, podía aceptar el webhook en modo mock sin firma. No se comprobó qué versión está publicada hoy.

## Intervención concreta para aprobar por separado

| Paso | Acción | Evidencia / condición |
|---|---|---|
| 1. Verificación inicial | Identificar app API, release y archivo desplegado nequiPaymentService.js; comprobar lógica mock y validación de firma; inventariar solo presencia de variables | SHA/release, extracto de código sin secretos, fecha Bogotá/UTC |
| 2. Respaldo | Operador guarda configuración previa en gestor seguro, acceso restringido; registra snapshot/backup aplicable y prueba de recuperación | Referencia al respaldo, nunca valores en chat/docs; no se hace backup desde esta sesión |
| 3. Cambio exacto, versión antigua | En cPanel → Setup Node.js App → API: fijar **NEQUI_ENV=disabled**; retirar **NEQUI_WEBHOOK_SECRET, NEQUI_CLIENT_ID, NEQUI_CLIENT_SECRET, NEQUI_API_KEY**; reiniciar únicamente la API | Requiere autorización explícita de ventana y alcance; conservar llaves fuera del servidor con el dueño |
| 4. Versión nueva, si ya está publicada | Confirmar que Nequi directo/manual están deshabilitados y rutas devuelven 410 por la guarda vigente; mantener credenciales retiradas | No asumir que el código local es el publicado |
| 5. Comprobaciones posteriores | GET público checkout/config sin nequi_api; inspección de código/config/logs: en versión antigua, firma rechazada sin secreto (401); nueva, 410 | **No enviar eventos de prueba al webhook productivo**, ni compras o cobros para medirlo |
| 6. Cierre | Revisión independiente de release, configuración redactada, reinicio y logs; firma del ejecutor/responsable | Solo entonces cambiar V-01 a cerrado |

## Impacto y riesgo residual

La contención antigua retira Nequi API del checkout e impide aprobar por ese webhook. No deshabilita Wompi ni contraentrega. En la versión antigua la transferencia manual puede seguir ofrecida: personal debe suspender instrucciones nuevas por ese canal y gestionar casos históricos por el procedimiento autorizado. No se confunde Nequi dentro de Wompi con Nequi directo.

La conciliación histórica requiere un proceso posterior de lectura y contraste con extractos, realizado por personal autorizado. No se cambian estados de pedidos ni se alteran registros reales desde esta fase.

## Reversión segura

Mantener NEQUI_ENV=disabled y llaves retiradas aunque se revierta aplicación. **Restaurar mock o credenciales vulnerables no es una recuperación segura.** Si falla otro servicio, diagnosticar sin reactivar el webhook; suspender el canal vulnerable mediante el procedimiento del hosting aprobado. Restaurar una configuración insegura exigiría una decisión nueva explícita y reabriría V-01.

El operador debe aportar: persona, ventana, host, release, respaldo, inventario redactado antes/después, reinicio, GET de métodos, logs 401/410 ya existentes o verificación de la guarda, impacto y revisión independiente. Ninguna de esas evidencias productivas se obtuvo aquí; **no se declara contenida producción**.
