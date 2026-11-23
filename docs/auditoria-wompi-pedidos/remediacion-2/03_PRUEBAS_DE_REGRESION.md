# Pruebas de regresión — resultados reales

MongoDB 8.3.2 en replica set temporal loopback, Node v24, Wompi simulado, sin .env, Atlas, credenciales reales ni correo. Los nuevos casos usan fixture-claude.cjs: cada prueba determina explícitamente la respuesta del GET, sin sincronizarla automáticamente con el webhook.

## Antes de modificar aplicación

| Conjunto | Ejecutadas | PASS | FAIL | Evidencia |
|---|---:|---:|---:|---|
| C07/C08/C08c/C12 originales de Claude | 4 | 0 | 4 | baseline-casos-claude.txt |
| Nuevas N01–N15, con variantes | 18 | 6 | 12 | nuevas-antes.txt |

## Después de las correcciones

| Conjunto | Ejecutadas | PASS | FAIL | Evidencia |
|---|---:|---:|---:|---|
| Adversariales de Claude, originales íntegros | 35 | 35 | 0 | claude-despues.txt |
| Regresiones de primera remediación R01–R27 | 27 | 27 | 0 | codex-27.txt |
| Limitadores reales L01–L02 | 2 | 2 | 0 | limites-2.txt |
| Históricas originales, con adaptación contractual previamente auditada | 275 | 273 | 2 | historica-275.txt |
| P06-v2/P23-v2 independientes | 2 | 2 | 0 | versiones-v2.txt |
| Nuevas específicas NV-01/NV-02/NV-03 | 18 | 18 | 0 | nuevas-despues.txt |
| Matriz original en modo contrato | 50 | 44 | 5 | matriz-contrato.txt; además 1 NOT_APPLICABLE |
| E01–E06 reales | 0 | — | — | 6 BLOCKED, no ejecutados |

No sumar repeticiones ni confundir grupos solapados con una cifra única de seguridad. Las 18 pruebas específicas son nuevas; las dos v2 son versiones independientes adicionales. Las 35 de Claude permanecen sin cambios, incluida C34 que comprueba un fallo seguro con vínculo ausente y NO acredita E01.

Los dos FAIL históricos siguen siendo P06 (exige pagado con importe/moneda incorrectos) y P23 (exige cancelar PENDING con 200). No se editaron, omitieron ni marcaron skip. Las v2 no sustituyen formalmente el histórico. Se enumeran los archivos de pruebas que existían en la línea base para no incorporar por accidente nuevos tests concurrentes de otra intervención.

La matriz conserva sus cinco FAIL: P13 no aporta ID; P20/P22b no ejecutan resolución antes de preparar; P28 no archiva vigilancia; X07 no configura vigencia. Claude C09/C16/C17/C33 demuestran los cuatro flujos correctos; X07 continúa pendiente. No se manipula la matriz para volverla verde.

## Cobertura específica

- **NV-01:** APPROVED firmado frente a GET PENDING y DECLINED, 4 duplicados concurrentes, failed/observación/alerta durable/503, GET actualizado, un único stock/aviso. Fallo real de Mongo por failCommand código 2 durante persistencia; rollback no confirma recepción. Progresiones PENDING a tres finales; APPROVED a VOIDED y antiguo APPROVED tras anulación.
- **NV-02:** formato inválido/vacío/objeto, 404, otro pedido, respuesta con otro ID, 500/429/403, timeout y desconexión simulados. Éxito con ID distinto, cierre de dos incidencias del mismo pedido y ninguna de otro, condición financiera independiente conservada, 4 conciliaciones concurrentes y una auditoría. Fallo de AuditLog revierte cierre sin borrar el cobro auténtico. Vendedor/cliente 403.
- **NV-03:** PENDING original→APPROVED consultado, moneda alterada y provider_binding_mismatch conservado, comparación explícita de campos originales, 5 reprocesos concurrentes, GET con otro ID o estado rezagado y asociación ausente. Fallo Mongo durante inventario y durante cierre original; reintentos sin doble aplicación ni doble aviso.

Los timeouts/conexiones se inyectan en el transporte ficticio; no se probó disponibilidad de Wompi real. El fallo de cierre original y AuditLog se inyecta en los métodos de persistencia; el fallo de aplicación y outbox usa failCommand de Mongo temporal. Especificación/fuente en regresiones.test.cjs.

## Comprobaciones estáticas y conservación

Sintaxis y lint focalizado comparados contra las tres fuentes previas: cero diagnósticos nuevos. El patch de esta intervención valida con git apply --reverse --check (sólo lectura) y git diff --check no detecta errores. No se hizo build de frontend ni recorrido UI nuevo: no se modificó frontend en este alcance; las rutas financieras fueron ejercidas por HTTP real.

Baseline SHA256 de 3954 archivos. Detectó tres cambios propios de fuente y cuatro modificaciones concurrentes ajenas; también se inventarían dos archivos nuevos concurrentes. Los informes, pruebas originales y evidencias anteriores permanecen intactos. La comparación global NO se presenta como «cero cambios»: ver detalle de concurrencia y hashes en 04/evidencias. El primer verificador devuelve alerta por esos cambios inesperados, no por un fallo de sintaxis o de las pruebas.

En una comprobación posterior se detectaron tres JSON históricos sobrescritos concurrentemente (mtime 16:55:52–53 UTC, después de terminar nuestra suite). Se guardaron sus nuevas salidas en salidas-concurrentes-preservadas/ y se restituyeron los originales sólo tras reconstruir bytes cuyo SHA256 coincidía exactamente con la línea base. restauracion-evidencias.json conserva hashes antes/después y destino del respaldo; preservacion-final.json comprueba los originales restaurados. No se eliminó la salida concurrente ni se restauró código de checkout.

Comandos y manifest de archivos históricos en 06. No se usaron producción, Atlas, Wompi real, commits, pushes ni despliegues.
