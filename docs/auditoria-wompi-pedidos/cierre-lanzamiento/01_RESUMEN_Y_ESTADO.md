# Qué está pasando y qué falta para terminar

2026-11-23, America/Bogota. **No se reabrió la remediación de pagos. El NO-GO es de lanzamiento completo.**

Las auditorías anteriores aprobaron cómo el código valida, asocia y aplica un pago. La última añadió requisitos de versión, arranque e infraestructura. Un resultado LOCAL APROBADO no significa que ya se haya comprobado el servidor publicado. BLOCKED describía verificaciones sin acceso; NO-GO es la decisión de no abrir ventas con los controles pendientes. Esas etiquetas no cambian los resultados de las pruebas.

El 502 era un pendiente conocido que había quedado sin diagnóstico. Se investigó en esta intervención. La creación automática de índices y la falta de un interruptor independiente sí son hallazgos adicionales de preparación operativa. No se ocultaron fallos originales ni se cambian sus aserciones para aprobar.

## Resultado de esta intervención

| Problema | Acción y evidencia | Estado real |
|---|---|---|
| FF-02: checkout real devolvió 502 | Se reprodujo rechazo HTTP 403 usando retorno 127.0.0.1; con localhost, creación 201. Luego un **pedido nuevo del checkout actual** creó su Link Sandbox 201; replay 200 mismo pedido/link y un solo POST externo | **Creación real ahora demostrada**; sin nuevo pago ni webhook. El resultado del intento antiguo no se inventa |
| FF-04: índices fallan silenciosamente | En producción se desactivan autoIndex/autoCreate; se leen los índices únicos y la topología; no se escucha HTTP hasta validar. Falta/discordancia provoca exit=1, sin migrar datos | **Corregido y probado en local**. Inventario real sigue pendiente |
| FF-05: habilitar una prueba abre Wompi a todos | Nuevo WOMPI_CHECKOUT_ENABLED; en producción requiere true explícito. Suspende nuevas creaciones sin retirar llaves para webhooks/consultas existentes | **Implementado y probado en local**. Operador debe probar configuración en destino |
| FF-01: no hay commit de release | Árbol candidato identificado por manifiesto de 482 fuentes/recursos y SHA; lista de 37 archivos de aplicación/pruebas pendientes de versionar, más documentación | **Preparado; no cerrado**. No se hizo commit ni push sin autorización |
| V-01 Nequi publicado | El código nuevo ya está protegido; se conserva intervención exacta de contención sobre versión antigua | **Pendiente en hosting**. No se accedió a producción |
| E01/E02 webhook auténtico | Se conserva evidencia real anterior de GET/retorno; no se fabrican notificaciones | **Pendiente**: receptor HTTPS Sandbox y panel de eventos |
| E06 infraestructura | Herramienta de inspección de solo lectura y plan de índices preparados | **Pendiente**: servidor/base de destino, respaldo restaurado, TLS, variables y avisos |
| Políticas comerciales | Objetivos previos registrados; se separa implementación de aceptación de riesgos residuales | **Pendiente de cierre operativo**, sin reservas improvisadas |

No se modifican asociación, validación de firma, importes, estados financieros, stock, cupones, contraentrega ni el checkout paralelo. Esta fase cambia cuatro fuentes existentes de arranque/operación y añade dos herramientas de verificación. Los cambios previos se conservan.

## Próximo paso concreto

Congelar el árbol probado en un commit autorizado. Después, sobre ese SHA, ejecutar el plan único 03: contención V-01, réplica de pruebas con HTTPS y webhook real, inventario/restauración/avisos del destino y decisiones operativas. **No hace falta rehacer el motor de pagos. Tampoco se puede sustituir el acceso al servidor por otra ronda de mocks.**

Veredicto actual: **NO-GO de apertura pública de Wompi**, con los defectos locales de preparación corregidos y evidenciados. Este documento no autoriza despliegues ni cobros productivos.
