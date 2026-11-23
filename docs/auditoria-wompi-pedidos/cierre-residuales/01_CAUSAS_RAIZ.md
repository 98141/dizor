# Causas raíz · cierre residual local

Fecha: 2026-11-23 (America/Bogota). Árbol inicial: main, HEAD 23ce3a6c8d9d36253f8c0e7b1499ce63ce8f95e6. Sin commits posteriores. El commit mezcla checkout y pagos: 243 archivos, 108504 inserciones y 861 eliminaciones. Alcance completo en `evidencias/git-show.txt`. Cambios ajenos iniciales en `evidencias/git-status.txt`; hashes de 4216 archivos y copias de los ocho archivos previstos antes de editar en `evidencias/`.

Se revisaron los informes y pruebas de auditoría original, remediación, auditoría Claude, remediación-2 y auditoría Claude-2, incluidos `01_INFORME_FINAL_INDEPENDIENTE.md`, `05_HALLAZGOS_NUEVOS.md` y `07_VEREDICTO_FINAL_LOCAL.md` de la segunda auditoría. No se interpreta su aprobación local como integración externa aprobada.

## NR-01

`reconcileWompi` resuelve incidencias de consulta dentro de `mutateOrder`, pero recalcula la bandera solo para APPROVED. Un DECLINED anterior del mismo enlace conserva correctamente el pago principal; al cerrar el último fallo de consulta deja una bandera obsoleta. D13 antes: pago válido, ninguna incidencia activa, preparar=409. Z01 reproduce lo mismo sin depender del proveedor favorable. La corrección debe recalcular al cerrar fallos; conservar bloqueos históricos sin incidencias cuando no hubo cierres y las incidencias financieras auténticas.

## NR-02

El cierre administrativo trata toda verificación como sustitución aunque ambos `_id` sean iguales (D17b); la fase 2 asigna siempre `processedAt` (D18), perdiendo la primera fecha. D18 puede fallar por la etiqueta aun cuando ambas fechas coinciden por su resolución de representación; Z02 compara milisegundos y ejecuta concurrencia. No son dobles cobros: stock y aviso permanecen únicos. Los mensajes de consultas repetidas deben describir una reconsulta y conservar el historial anterior.

## NR-03

La bandeja filtra únicamente `processedAt:null` y no hay decisión de archivo. El reproceso rechaza correctamente un estado incompatible o un importe diferente, por lo que una conciliación auténtica crea otro recibo y el contradictorio permanece pendiente. D04b y D19b lo demuestran; Z03-amount y Z03-state prueban además la acción de archivo necesaria.

Los campos actuales mezclan procesamiento financiero y estado de recuperación. Usar `processingState=processed` y una fecha inventada para un mero archivo afirmaría un procesamiento financiero inexistente. Se necesita metadata administrativa opcional en PaymentEvent, preservando los campos existentes; AuditLog conserva las decisiones. No hace falta nueva colección, dependencia ni migración.

## Aserciones originales que fallan antes

| Prueba | Aserción | Antes |
|---|---|---|
| D04b | recibo contradictorio fuera de bandeja después de conciliar + reprocesar | 1 != 0 |
| D13 | preparar pedido pagado sin incidencias activas | 409 != 200 |
| D17b | associationError distinto de superseded_by_provider_state para misma identidad | igualdad indebida |
| D18 | fecha inicial y associationError preservados | etiqueta alterada |
| D19b | recibo de importe contradictorio fuera de bandeja tras conciliar + reprocesar | 1 != 0 |

`evidencias/antes-D.txt`: 23 PASS / 5 FAIL. `antes-NR.txt`: nueve pruebas, nueve FAIL. Ninguna aserción original se modifica. D04b/D19b no llaman a archivo ni aportan motivo; su flujo no debe retirar automáticamente evidencia. La verificación completa debe ejecutar el archivo explícito y comprobar la supervisión financiera, como Z03.
