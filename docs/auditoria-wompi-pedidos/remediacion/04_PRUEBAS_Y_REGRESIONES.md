# Pruebas y regresiones — resultados reales

Entorno: Node v24, MongoDB 8.3.2 en replica set efímero loopback, dependencias ya instaladas. No .env/Atlas, proveedor real, credenciales reales ni entrega de correo. Next se compila en copia temporal sin .env ni credenciales heredadas; build bloquea fetch/TCP, runtime/browser sólo loopback o respuesta local del proveedor ficticio.

## Línea base antes de modificar aplicación

| Conjunto | Resultado | Evidencia |
|---|---|---|
| Arnés Wompi original intacto | 50: 38 PASS, 11 FAIL, 1 NOT_APPLICABLE | baseline-auditoria-local.txt; baseline/docs/auditoria-wompi-pedidos/evidencias/resultados-auditoria-wompi.json |
| Suite histórica | 275 ejecutadas, 275 PASS, 0 FAIL | baseline-suite-local.txt |
| Nuevas regresiones iniciales | 11 ejecutadas, 0 PASS, 11 FAIL | nuevas-antes.txt |

Primer intento sandbox restringido: EACCES en conexión a 127.0.0.1. No se cuenta como ejecución funcional. Repetición con acceso local autorizado reproducible. El aviso de MongoMemoryServer sobre versión solicitada 7.0.24 no impide usar el binario instalado 8.3.2; se conserva en logs.

## Validación de cierre

| Conjunto (no sumar repeticiones) | Resultado | Evidencia |
|---|---|---|
| Regresiones nuevas de pagos R01–R27 | **27/27 PASS** | regresiones-cierre.txt; fuente regresiones.test.cjs |
| Limitadores reales L01–L02 | **2/2 PASS** | limites.txt; no adaptación de límites, sin Mongo ni proveedor |
| Regresión focalizada final de controladores/plantilla | **3/3 PASS**, casos históricos P22/P24/Q13; no son pruebas nuevas | controladores-cierre.txt |
| Suite histórica, aserciones intactas, fixtures contractuales explícitos | **275 ejecutadas: 273 PASS, 2 FAIL** | suite-cierre.txt (y suite-verificada.txt previo a los dos bordes finales) |
| Matriz original, aserciones intactas y GET simulado disponible | **50: 44 PASS, 5 FAIL, 1 NOT_APPLICABLE** | matriz-verificada.txt y JSON de matriz-verificada/docs/... |
| Recorrido histórico Next + Chrome | **20 comprobaciones PASS**, build PASS | navegador/next-navegador.json, build-fase7.json |
| Recorrido histórico + UI nueva | **26 comprobaciones PASS = 20 repetidas + 6 nuevas**, build PASS; sin errores de página/hidratación | navegador-remediacion/remediacion-ui.json, next-navegador.json, build-fase7.json |
| Sintaxis, lint comparado, diff y preservación | Ver estatico-cierre.json: cero diagnósticos nuevos en alcance y cero cambios históricos | estatico-cierre.txt/json |
| E01–E06 | **6 BLOCKED, no ejecutados** | 06_VERIFICACIONES_SANDBOX_PENDIENTES.md |

No hay un total único sumando Node, escenarios de auditoría y checks UI: cubren grupos distintos y parcialmente superpuestos. Hay **29 pruebas Node nuevas** (27 financieras + 2 de límites), además de 6 comprobaciones UI nuevas. Los 20 checks históricos UI se ejecutaron dos veces; no son 40 casos distintos. Aceptación de correo simulado no acredita entrega real.

## Dos FAIL históricos conservados, no ocultos

1. `backend/test/phase1.test.js`, P06: exige literalmente `paymentStatus === pagado` para importe/moneda discrepantes. Es el comportamiento que WP-05 ordena eliminar. Ahora pendiente + receipt/incident + preparación bloqueada; R06/R14 verifican la corrección. Cambiar el código para satisfacer esa aserción reintroduciría el defecto.
2. Mismo archivo, P23: exige cancelar con HTTP 200 un Wompi PENDING consultado. Contradice la prohibición explícita de cancelar definitivamente un intento que aún puede aprobarse. Ahora 409 con intervención administrativa; COD no cambia. R11/R15/R25 lo cubren.

No se editaron esas aserciones, no se marcaron skip y no se presenta la suite como totalmente verde. La revisión independiente debe decidir cómo versionar pruebas de políticas sustituidas sin destruir el histórico. Este requisito pendiente impide declarar cierre local incondicional.

## Once fallos originales reexaminados

| ID de la auditoría Wompi | Resultado del arnés conservado | Evidencia complementaria / conclusión |
|---|---|---|
| P04b | PASS | VOIDED bloquea preparación y sale de criterio financiero; R07/08/22/27 |
| P13 | FAIL | El escenario no remite ID al nuevo endpoint y nadie puede inventarlo. Vía administrativa por ID probada R04/REM-UI01. Retorno automático E03 sigue BLOCKED |
| P20 | FAIL | No llama a la resolución y pide preparar con incidencia activa. No se debe permitir. Además su campo existeEndpointResolverIncidencia está hardcodeado false. Resolución real + auditoría + preparar: R13/REM-UI02; anulación adicional R24 |
| P21b | PASS | Monto erróneo no se confirma pagado; R06 |
| P22b | FAIL | No ejecuta resolución antes de preparar. Guarda maxUses se conserva; aceptación explícita del descuento probado R10. Política general WP-15 BLOCKED |
| P23 | PASS | No aplica al pedido encontrado arbitrariamente por referencia. R05/R20/R23 amplían integridad de vínculo |
| P28 | FAIL | Ya no hay botón Wompi falso, pero escenario no archiva vigilancia ni verifica cierre de Link externo. Archivo operativo probado R15; cierre Link E05 BLOCKED |
| X01 | PASS | Receipt no asociado durable; aviso único y reproceso R01–03/REM-UI03 |
| X02 | PASS | No permite autocancelar Link que aún podría cobrar |
| X06 | PASS | Rutas reales de resolución; además comportamiento/roles/AuditLog R09–15 |
| X07 | FAIL | TTL requiere decisión comercial y validación E05. Sin vencimiento inventado |

Los cinco FAIL anteriores no se renombran PASS ni se borran. Tres omiten pasos nuevos de resolución, uno omite el ID de recuperación, uno sigue bloqueado por política de vigencia. Sus limitaciones no demuestran ausencia de defectos futuros: Claude debe cuestionarlas y repetir el flujo correcto.

## Regresiones intermedias detectadas y corregidas

- R13 ampliada detectó reapertura al consultar un cobro adicional ya documentado como devuelto: se conserva la resolución y la consulta repetida no reabre ese mismo hecho.
- R20 demostró cambio de Link fuera del checksum. Se añade consulta autenticada y observación mínima del proveedor. R20/R23 pasan sin ampliar artificialmente propiedades de firma.
- R18 inicial no envejecía el fixture porque createdAt es inmutable en Mongoose. Se corrigió únicamente la preparación sintética mediante collection.updateOne, conservando su aserción. No fue un fallo del producto.
- Q13 histórica detectó que la nueva plantilla administrativa no tenía párrafos/escape compatibles. Se corrigió la plantilla y la suite posterior conserva sólo las dos incompatibilidades explícitas anteriores.
- R26/R27 se añadieron antes del ajuste final y ambas fallaron (`bordes-antes.txt`): PENDING borraba retención histórica y VOIDED de ID aplicado sin Link podía quedar sin bloquear. Ambas pasan después; consulta PENDING también preserva retención.
- Primer lint lanzado desde cwd raíz no resolvía next/babel. Se conserva estatico.txt/json con error de herramienta; se ejecutó desde frontend y se comparó con HEAD sin supresiones. No se declara limpio todo el repositorio.

## Cobertura y límites

Cobertura local: cliente registrado e invitado, COD completo, Wompi aprobado/rechazado/pendiente/anulado, última unidad, fallos de inbox/outbox/auditoría/inventario, reinicio del módulo con receipt persistido, consulta privada, contradicción de vínculo/moneda, duplicados y concurrencia, roles/IDOR heredados, resolución, cancelación, reintento de clave de checkout, notificaciones simuladas y preparación/despacho. El caso de reinicio simula recarga del servicio manteniendo Mongo vivo; no acredita recuperación ante caída del host/replica set real.

La captura móvil de confirmación tras aprobación se inspeccionó visualmente: estado aprobado, total pagado y acciones legibles a 390 px. La copia pendiente y posterior actualización se comprobaron antes de capturar. No es certificación de accesibilidad ni verificación de proveedor.

Todos los comandos reproducibles están en 07. No se sobreescribieron informes/arnés/asserts históricos: manifiesto original de 3374 archivos y verificación de SHA256 en evidencia estática.
