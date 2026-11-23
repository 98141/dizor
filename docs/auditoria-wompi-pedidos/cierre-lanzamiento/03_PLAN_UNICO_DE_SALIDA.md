# Plan único de salida · orden y responsables

**Objetivo:** llegar a un release verificable y luego a una decisión de despliegue controlado. No repetir correcciones ya aprobadas ni declarar resueltos controles que requieren hosting.

| Orden | Trabajo | Responsable | Termina cuando existe |
|---|---|---|---|
| 1, urgente e independiente | Contener Nequi antiguo: comprobar versión/configuración, NEQUI_ENV=disabled, retirar credenciales según plan, reiniciar solo API, comprobar métodos/código/logs | Administrador hosting autorizado por dueño | Evidencia real antes/después, responsable y revisión. No enviar POST de prueba al webhook productivo |
| 2 | Revisar y congelar el árbol candidato completo: checkout, municipios, pagos y arranque | Codex/desarrollador; dueño autoriza commit/push | SHA de commit, manifiesto coincidente y suites repetidas sobre ese SHA. No basta 23ce3a6 ni el fingerprint sin commit |
| 3 | Preparar base y HTTPS Sandbox aislados; configurar URL de eventos test; generar un pedido y Link con ese SHA | Operador hosting/dashboard + Codex | Datos solo de prueba y un pedido identificado con Link; no usar Atlas productivo |
| 4 | Completar pago, evento auténtico, firma, vínculo, persistencia, stock/aviso únicos; probar rechazo, reintento, PENDING y medios soportados | Codex con acceso/consentimientos autorizados; operador Wompi | Evidencia E01/E02/E04 completa. No hacer pasar firmas locales por eventos reales |
| 5 | Restaurar backup en entorno no productivo; inventariar índices/duplicados; planificar/probar migración; revisar TLS/proxy/CORS/variables y recepción de alertas | Administrador infraestructura | Restore verificable, inspección lista, migración aprobada y evidencias de destino; jamás construir índices a ciegas sobre producción |
| 6 | Cerrar políticas de 04: implementación validada o control operativo ensayado con aceptación expresa del riesgo | Dueño + responsables de ventas/finanzas/desarrollo | Registro de decisión, responsable, procedimiento y ensayo. No aceptar riesgos por silencio |
| 7 | Auditoría independiente del SHA y plan específico; preparar ventana y reversión | Claude + dueño/operador | Nuevo veredicto. Solo tras aprobación se programa el despliegue |

## Ventana de despliegue futura

1. Confirmar SHA, respaldos, migración probada, operador y contención Nequi vigente.
2. Aplicar únicamente los cambios de base aprobados para ese destino, después de inventario. Ejecutar inspección de solo lectura; resolver cada incompatibilidad explícitamente.
3. Desplegar API con **WOMPI_CHECKOUT_ENABLED=false** y llaves del ambiente correcto. El arranque debe rechazar una base incompleta; no eliminar la guarda para forzarlo.
4. Desplegar frontend construido con las URLs de ese destino. Comprobar liveness, sesión por rol, catálogo, contraentrega y panel; confirmar que Wompi no se ofrece para nuevas compras.
5. Configurar/verificar endpoint y secreto de eventos del ambiente correspondiente. Los pagos existentes deben seguir atendidos aunque la creación esté pausada.
6. Restringir el acceso para el ensayo mediante la ventana/control del hosting aprobado. Habilitar creación únicamente bajo ese control. Una futura prueba con dinero productivo necesita autorización específica, importe y procedimiento de devolución; **no está autorizada ni se ejecutó aquí**.
7. Conciliar y comprobar pedido, stock, aviso y finanzas. Abrir al público solo después de aceptación del responsable y GO correspondiente.

## Reversión

Suspender nuevas creaciones con el flag, **conservar llaves y receptor seguro** para eventos existentes. No volver a la lógica antigua de asociación o descarte de eventos. Mantener la API de pagos segura, o su receptor/conciliador aislado, mientras se revierte el resto de la aplicación. No restaurar un backup encima de pagos posteriores ni reescribir estados financieros a mano. Mantener Nequi contenido.

El plan previo sugería retirar llaves para frenar creación: con el interruptor nuevo ya no es necesario y se evita cortar la verificación de eventos pendientes. Los Links antiguos pueden seguir cobrando: deben mantenerse bajo vigilancia hasta quedar conciliados, incluso durante una pausa.

## Lo que necesitamos del propietario/operador

Autorización de congelar el commit; acceso autorizado al entorno HTTPS de pruebas y panel **Sandbox**; persona y ventana para V-01; evidencia del backup/restore y configuración del destino; decisiones operativas de 04. No enviar llaves a chats ni ejecutar scripts contra el MONGO_URI productivo desde esta sesión.
