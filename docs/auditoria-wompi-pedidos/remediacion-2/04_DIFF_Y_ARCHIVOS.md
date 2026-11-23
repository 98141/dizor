# Diff y archivos de esta intervención

## Alcance exacto

| Archivo | Funciones / zona actual | Cambio |
|---|---|---|
| backend/src/services/wompiPaymentService.js | canAdvanceTransactionStatus (11), deferProviderDiscrepancy (15), rama de estados (130), metadatos/retorno (171/179) | Precedencia explícita; fallo durable antes de 503; no completar sustitución sin procesamiento; retornar recibo completado; conservar provider_binding_mismatch |
| backend/src/services/wompiService.js | queryError (4), getTransaction (139) | Distinguir formato/404 de errores HTTP, timeout, conexión y respuesta inválida; consulta y autenticación sin cambios |
| backend/src/controllers/orderAdminController.js | reconcileWompi (195), auditoría (224), reprocessPaymentEvent (242) | No crear incidencia por 404; cerrar fallos operativos de consulta del pedido con actor/historial/AuditLog atómicos; cerrar original sólo tras recibo confiable completado |
| backend/test/phase1-v2.test.js | P06-v2/P23-v2 | Dos pruebas independientes, sin modificar/saltar originales ni afirmar aceptación comercial |

No cambia esquema, índice, dependencia, firma, modalidad, inventario/cupón, contraentrega, frontend ni resolución universal. La lógica de stock y cupones dentro del servicio se conserva.

## Patch reproducible

`evidencias/remediacion-2.diff` es incremental respecto al código local auditado por Claude, **no** respecto a HEAD desnudo: contiene exactamente los tres archivos funcionales y el test v2. `git apply --stat` informa **4 archivos, 112 inserciones y 22 eliminaciones**. Las tres fuentes previas completas están en antes/. `archivos-codigo.json` contiene hashes finales. La correspondencia inversa se comprobó mediante `git apply --reverse --check` sin ejecutar cambios.

`diff-previo.patch` registra el diff tracked al iniciar; `git-status-antes.txt` y `git-status-despues.txt` distinguen el árbol compartido del patch propio. La primera remediación ya estaba sin commit sobre 9289c7b y no se revierte ni se mezcla silenciosamente.

Los archivos adicionales nuevos de esta carpeta son los seis informes requeridos, pruebas-sustituidas.md, preservar.cjs, regresiones.test.cjs, verificar.cjs, tres snapshots antes/ y evidencias. El inventario final con hashes se conserva en evidencias/inventario-remediacion-2.json.

## Cambios concurrentes detectados, conservados y excluidos del patch

La huella inicial de 3954 archivos detectó estas cuatro diferencias fuera de los tres archivos propios:

- backend/src/controllers/checkoutController.js — cambios en selección de transportadora/configuración/huella del checkout, independientes de NV-01–03.
- frontend/src/app/(shop)/checkout/page.js.
- frontend/src/components/auth/AuthFormField.jsx.
- frontend/src/styles/pages/checkout.css.

También aparecieron, sin pertenecer a la línea base ni a esta intervención:

- backend/test/checkout.test.js.
- frontend/src/lib/checkoutValidation.js.

No los editó, eliminó ni restauró esta intervención. No se infiere autor ni aprobación; son trabajo concurrente del espacio compartido. `verificacion-final.json` conserva la detección inicial con unexpected y el verificador emitió alerta por ella. No se presenta una conservación global de fuente de «cero cambios». `preservacion-cierre.json` separa cambios propios, concurrentes, nuevos concurrentes y documentos/pruebas históricos sin alteraciones.

La suite histórica se lanzó enumerando los nueve archivos previos y conservó 275 casos; la nueva prueba concurrente de checkout no se incorpora a ese denominador. Para reproducirlo usar historicas-archivos.json, no el glob actual sin filtrar. No se hicieron correcciones de checkout ni pruebas cosméticas en este encargo.

## Verificación estática

Siete archivos de código/scripting comprobados sintácticamente; lint focalizado contra las fuentes antes/ sin diagnósticos nuevos. git diff --check y comprobación inversa del patch sin errores. No se declara limpio el lint global ni certificado el trabajo concurrente.

Los originales bajo docs/ y backend/test que existían al iniciar no se reescribieron: toda escritura histórica intentada se desvió con preservar.cjs. La huella antes/después respalda esta distinción. No se tocó .env, producción, Atlas, dependencias, commits, pushes ni despliegues desde esta intervención.

## Contención de salidas históricas concurrentes

Después del primer verificador, otra comprobación detectó cambios en tres JSON históricos: docs/auditoria-admin/fase2-evidencias/cierre-independiente-resultados.json, fase4-evidencias/rendimiento.json y fase7-evidencias/rendimiento-local.json. Sus mtimes eran 16:55:52–53 UTC; nuestra suite histórica ya había terminado y sus tres resultados propios estaban desviados en evidencias/historica-275/docs/.

Se preservaron íntegros los bytes detectados en evidencias/salidas-concurrentes-preservadas/. Se reconstruyó cada original desde HEAD, seleccionando exclusivamente la representación LF/CRLF cuyo hash coincidía exactamente con baseline-sha256.json. Antes de escribir se volvió a comprobar que el archivo no hubiese cambiado concurrentemente. Se restauró sólo ese original comprobado, sin git checkout/reset, eliminaciones ni modificaciones de código ajeno. La restauración coincide byte a byte con baseline; restauracion-evidencias.json registra todos los hashes y respaldos.

preservacion-cierre.json conserva la detección previa (incluidos estos tres JSON); preservacion-final.json registra el estado posterior. No se sustituyó una evidencia histórica por el resultado nuevo ni se ocultó la concurrencia.

La ejecución concurrente volvió a escribir los tres archivos mientras se preparaba el cierre. Se repitió la misma contención con respaldos nuevos bajo segunda-deteccion/ y registro restauracion-evidencias-2.json, sin sobrescribir el primer respaldo. La comprobación final de 3954 archivos muestra únicamente los tres cambios de fuente propios y los cuatro de fuente concurrentes: cero diferencias en documentos históricos y pruebas originales.
