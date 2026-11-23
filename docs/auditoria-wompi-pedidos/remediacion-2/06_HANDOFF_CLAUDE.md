# Handoff — segunda remediación

## Veredicto

**REMEDIACIÓN LOCAL COMPLETA, PENDIENTE DE AUDITORÍA INDEPENDIENTE**, exclusivamente para NV-01, NV-02, NV-03 y versionado adicional de P06/P23. **No es GO productivo.** NV-04/E01–E06, V-01 y aceptación comercial siguen abiertos; NV-05–NV-07 no se implementaron.

## Repositorio y estado

Raíz real: `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\Dizor\dizor`. Rama main, HEAD `9289c7b1451d3b800ca8412d788a9a13c45cc514`. Primera remediación ya presente como 22 modificaciones y tres archivos nuevos; carpeta de auditoría sin seguimiento. Al comenzar sus 25 hashes coincidían con el manifiesto anterior. No había implementación posterior de las tres causas.

Esta intervención modifica únicamente:

1. backend/src/services/wompiPaymentService.js.
2. backend/src/services/wompiService.js.
3. backend/src/controllers/orderAdminController.js.

Añade backend/test/phase1-v2.test.js y docs/auditoria-wompi-pedidos/remediacion-2/. Lista exacta, funciones, patch de 112 inserciones/22 eliminaciones y concurrencia: 04. Fuentes previas: antes/. Hashes finales: evidencias/archivos-codigo.json.

Hay cuatro modificaciones y dos archivos nuevos concurrentes de checkout ajenos a este alcance, detectados por SHA y conservados, no incluidos en remediacion-2.diff. No se atribuyen ni certifican. Consultar 04/preservacion-cierre.json; no aplicar una reversión global ni restaurar esos archivos para obtener un árbol limpio.

También se detectaron posteriormente tres JSON de auditoría histórica sobrescritos por actividad concurrente. Se conservaron sus nuevas salidas completas en salidas-concurrentes-preservadas/ y se restauraron únicamente los originales reconstruidos y verificados byte a byte contra el baseline. Ver restauracion-evidencias.json y preservacion-final.json. Ningún código concurrente se revirtió.

Hubo una segunda escritura concurrente: se guardó separadamente en segunda-deteccion/ con restauracion-evidencias-2.json. Al cierre, los 3954 archivos de baseline se verificaron de nuevo: sólo cambian tres fuentes propias y cuatro concurrentes, con cero documentos históricos o pruebas originales alterados. Se conservan tanto la detección inicial como ambos respaldos; no es una garantía sobre escrituras futuras de otros procesos del espacio compartido.

## Defectos resueltos y decisiones

- **NV-01:** C07 antes FAIL y después PASS. APPROVED frente a GET PENDING o DECLINED queda failed, observable y alertado, con 503 después de commit. Sólo progresiones explícitas pueden sustituir estado firmado; VOIDED no se rehabilita. El contraste privado de vínculo/moneda/importe permanece.
- **NV-02:** C12 antes FAIL y después PASS. Formato/404 producen 409 sin incidencia permanente. Otros fallos siguen trazados; una conciliación auténtica completada resuelve sólo los fallos de consulta del mismo pedido, con resolution/historial/AuditLog atómicos, independientemente de las pistas anteriores.
- **NV-03:** C08/C08c antes FAIL y después PASS. El servicio devuelve el recibo completado; el controlador revalida ID/ambiente/pedido/processedAt antes de cerrar la observación original. Mantiene campos originales y provider_binding_mismatch, con motivo de sustitución en metadata existente. Un intento o fallo no cierra el recibo.
- **P06/P23:** originales intactos y siguen FAIL; dos v2 nuevas aprobadas. La aceptación escrita del dueño sigue PENDIENTE y no hay sustitución formal de los originales. Ver pruebas-sustituidas.md.

## Resultados reales, sin sumar conjuntos solapados

| Conjunto | Resultado |
|---|---|
| Antes: C07/C08/C08c/C12 originales | 4 FAIL / 0 PASS |
| Antes: 18 específicas nuevas | 6 PASS / 12 FAIL |
| Después: 35 adversariales originales Claude | **35/35 PASS** |
| Después: R01–R27 originales Codex | **27/27 PASS** |
| Limitadores originales | **2/2 PASS** |
| Históricas originales | **273 PASS / 2 FAIL de 275**, P06/P23 |
| P06-v2/P23-v2 | **2/2 PASS** |
| Específicas NV nuevas | **18/18 PASS** |
| Matriz original en modo contrato | **44 PASS / 5 FAIL / 1 N/A** |
| E01–E06 | **6 BLOCKED**, cero ejecutadas |

Logs correspondientes: 03 y evidencias/. El resumen Node, no el estado del wrapper que imprime el log, determina si una suite tuvo fallos. Los cuatro casos de Claude se ejecutaron sin cambiar una sola aserción; los dos FAIL históricos tampoco se editaron ni se saltaron. La matriz mantiene los cinco FAIL ya explicados por Claude y la primera remediación.

## Reproducción (PowerShell)

Desde la raíz real. Reutiliza mongodb-memory-server de una instalación existente, sin instalar dependencias. En esta máquina MMS_DIR fue `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\RicardoMelo\ecommerce-mern\backend` en lectura. La red externa está bloqueada por los fixtures y no se lee .env.

```powershell
$env:MMS_DIR = '<carpeta existente con node_modules/mongodb-memory-server>'
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
$env:REMEDIATION2_RUN = 'claude-revision-nueva'
$preload = './docs/auditoria-wompi-pedidos/remediacion-2/preservar.cjs'

node --require $preload --test docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/adversarial.test.cjs
node --require $preload --test docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs
node --require $preload --test docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs
node --require $preload --test docs/auditoria-wompi-pedidos/remediacion-2/regresiones.test.cjs
node --require $preload --test backend/test/phase1-v2.test.js
node --require $preload docs/auditoria-wompi-pedidos/remediacion/auditoria-contrato.cjs

# Enumeración exacta de los nueve archivos históricos, sin v2 ni checkout concurrente.
$historicFiles = Get-Content docs/auditoria-wompi-pedidos/remediacion-2/evidencias/historicas-archivos.json -Raw | ConvertFrom-Json | ForEach-Object { Join-Path (Get-Location).Path $_ }
Push-Location backend
node --require ../docs/auditoria-wompi-pedidos/remediacion-2/preservar.cjs --require ../docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs --test --test-concurrency=1 $historicFiles
Pop-Location

git diff --check
git apply --reverse --check docs/auditoria-wompi-pedidos/remediacion-2/evidencias/remediacion-2.diff
```

El último comando sólo verifica correspondencia; NO ejecutarlo sin --check. No ejecutar git reset/checkout/clean ni aplicar el patch sobre cambios ya presentes. Para reproducir aplicación usar copia desechable de la primera remediación auditada, no HEAD desnudo.

Para nuevas ejecuciones usar nombres/destinos nuevos y no sobrescribir los logs entregados. preservar.cjs desvía escrituras históricas de docs/ a remediacion-2/evidencias/<REMEDIATION2_RUN>/. verificar.cjs compara hashes y lint; su primera salida alerta por trabajo concurrente detectado (04), no ocultarlo ni restaurarlo. Para otra auditoría copiar el runner a destino nuevo antes de regenerar sus evidencias.

## Qué cuestionar y límites prácticos

1. Intercalar GET rezagado, duplicados y actualización del proveedor: failed/observación/aviso deben sobrevivir al commit antes de 503. Si Mongo falla, nunca devolver 200 ni completar processedAt. Probar también rechazo terminal contradictorio y VOIDED.
2. Ejecutar C22–C26 y R22: ningún APPROVED viejo puede rehabilitar una transacción anulada.
3. Distinguir 404 real de 401/403/429/5xx, timeout, conexión y respuesta con otro ID. La consulta privada y la asociación siguen siendo obligatorias; ninguna pista administrativa confirma por sí misma dinero.
4. Simular fallo de AuditLog después de registrar pago: las incidencias de consulta deben seguir abiertas hasta recuperación. Cierre operativo y auditoría son atómicos entre sí; la fase financiera previa es independiente y durable.
5. Reprocesar una observación con distinta clave por estado/moneda, duplicarla y fallar la escritura de cierre original: datos originales y manipulación siguen auditables y el reintento no repite stock/avisos. Una incidencia financiera independiente no se resuelve al atender el inbox.
6. Mantener NV-04 BLOCKED hasta evento y GET reales de Sandbox redactados. No quitar contraste ni migrar modalidad por preferencia. Procedimiento E01 en 05.
7. Revisar procedencia de los seis archivos concurrentes de checkout fuera de este patch antes de integrar el árbol completo.

No hay afirmación de Wompi real, disponibilidad, firma externa, entrega de correo, contención productiva Nequi, Atlas, migraciones ni despliegues. No se hicieron commits o pushes. Las pruebas originales y auditorías anteriores permanecen sin cambios según huella; pendientes externos y de negocio no se dan por cerrados con mocks.
