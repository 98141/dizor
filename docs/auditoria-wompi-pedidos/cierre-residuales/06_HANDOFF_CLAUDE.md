# Handoff para validación independiente

**CIERRE LOCAL COMPLETO — PENDIENTE DE VALIDACIÓN INDEPENDIENTE.** Alcance: NR-01, NR-02 y NR-03. Las tres fallas tienen reproducción inicial y evidencia posterior de corrección. No es GO de producción ni validación externa de Wompi.

## Árbol y archivos

Repositorio real: `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\Dizor\dizor`. Rama main; HEAD al iniciar 23ce3a6c8d9d36253f8c0e7b1499ce63ce8f95e6; sin commits posteriores. El commit mezcla checkout/pagos (243 archivos). El cierre no hace commits. Ver estado inicial/final, copias originales, SHA y diff en evidencias. Ocho fuentes existentes cambian y un servicio se añade; checkout y pruebas originales se conservan. No restaurar el árbol global para “limpiarlo”.

## Revisar las correcciones

1. NR-01: cierre transaccional de fallos de consulta recalcula revisión también con DECLINED; conserva el pago principal y cualquier incidencia legítima. Revisar D13, Z01, N08, R26 y D16.
2. NR-02: misma identidad no se autosustituye; processedAt conserva primera fecha bajo concurrencia, también al sustituir una observación por otra. Historial distingue reconsulta. Revisar D17b/D18/Z02, C08c, N11/N12, D20/D23 y casos de moneda.
3. NR-03: archivo administrativo motivado con prueba privada procesada de la misma transacción. Metadata separada de procesamiento financiero; evidencia original intacta, AuditLog atómico, permisos y concurrencia. Seguimiento financiero permanece abierto y contado. Archivo no cambia Order, stock, cupones o despacho. Reapertura motivada permite investigar y reprocesar evidencia nueva. Revisar Z03–Z11, incluyendo rollback Mongo y superadmin, y el flujo real de navegador.

El recibo probatorio puede tener source=webhook si fue contrastado por GET privado y su observación coincide íntegramente; el origen original no se reetiqueta para fingir source=provider_query. El original sin pedido solo se archiva si existe prueba inequívoca de esa misma transacción; un cobro realmente sin asociación confiable no desaparece de la bandeja principal.

## Resultados que no deben confundirse

| Conjunto | Resultado final |
|---|---|
| C original | 35/35 PASS |
| D original intacto | **26 PASS / 2 FAIL** (D04b, D19b) |
| D con acción explícita de archivo, variante separada y mismas aserciones | **28/28 PASS** |
| R / limitadores / N / v2 | 27/27 · 2/2 · 18/18 · 2/2 |
| Residuales nuevas | 12/12 PASS; núcleo inicial 0/9 → 9/9 |
| Históricas | **273/275; P06 y P23 siguen FAIL** |
| Matriz | **44 PASS / 5 FAIL / 1 N/A**, incluido **X07 FAIL** |
| Panel/build aislados | PASS; archivo escritorio, reapertura móvil, sin red externa ni errores de página |
| ESLint | Sin errores nuevos; uno previo en efecto de carga de alertas |

**Validación pendiente explícita:** los originales D04b/D19b no llaman a la operación nueva y no aportan motivo. Por eso todavía esperan una salida de bandeja que este flujo no debe producir automáticamente. No afirmar que el original pasa 28/28. La variante añade exclusivamente el archivo en ambos escenarios y conserva las aserciones; su SHA y acción insertada son revisables. Confirmar independientemente que esta distinción satisface el contrato de archivo motivado y que el seguimiento financiero nunca desaparece. Si se exige exclusivamente 28/28 del flujo original sin archivo, ese criterio no está satisfecho; requeriría cambiar el flujo de prueba, no ocultar evidencia desde reproceso.

La supervisión financiera de archivos es conservadora y permanece activa: este cambio no añade cierre de riesgos económicos, reembolsos ni automatiza su aceptación. Reabrir devuelve el evento a la bandeja principal; las decisiones anteriores permanecen auditadas. El dinero se procesa solo por los mecanismos autenticados existentes.

## Límites y pendientes anteriores

E01–E06 y NV-04/contrato real siguen pendientes de evidencia externa; no se llamó a Wompi real ni Atlas. Se mantienen los pendientes comerciales P06/P23, el vencimiento X07 y los residuales anteriores NV-05/NV-06/NV-07. No se abordaron por estar fuera de este cierre. La comparación de cada ID de la matriz no detectó cambios de veredicto. El trabajo paralelo de checkout requiere su propia revisión.

La receta completa y las limitaciones de fixtures están en 04_EVIDENCIAS; los resultados y diferencias están en 03_REGRESIONES; no sumar suites solapadas como si fueran pruebas independientes adicionales. Mantener la validación local separada de la integración externa y de cualquier aprobación de producción.
