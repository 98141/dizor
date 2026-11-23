# Regresiones ejecutadas

Resultados medidos en este árbol, con MongoDB 8.3.2 efímero en replica set y Wompi simulado. No son cifras copiadas. Los conjuntos se solapan y no se suman.

| Conjunto | Antes | Después | Evidencia |
|---|---|---|---|
| Claude C original | 35 PASS / 0 FAIL | 35 PASS / 0 FAIL | antes-C.txt / final-C.txt |
| Claude D original, sin editar | 23 PASS / 5 FAIL | 26 PASS / 2 FAIL | antes-D.txt / final-ajuste-D.txt |
| Claude D, variante con archivo explícito | no ejecutada como línea base | 28 PASS / 0 FAIL | final-DA.txt |
| Codex R | 27 PASS | 27 PASS | antes-R.txt / final-R.txt |
| Limitadores | 2 PASS | 2 PASS | antes-L.txt / final-L.txt |
| Segunda remediación N | 18 PASS | 18 PASS | antes-N.txt / final-N.txt |
| P06-v2 / P23-v2 | 2 PASS | 2 PASS | antes-V.txt / final-V.txt |
| Históricas, nueve archivos originales | 273 PASS / 2 FAIL | 273 PASS / 2 FAIL | antes-H.txt / final-H.txt |
| Matriz original con adaptador de contrato previo | 44 PASS / 5 FAIL / 1 N/A | 44 PASS / 5 FAIL / 1 N/A | antes-M.txt / final-M.txt |
| Residuales Z01–Z08 (9 pruebas) | 0 PASS / 9 FAIL | 9 PASS / 0 FAIL | antes-NR.txt / despues-inicial-NR.txt |
| Residuales ampliadas (12 pruebas) | las nueve anteriores, más tres nuevas | 12 PASS / 0 FAIL | final-cierre-NR.txt |

Todos los logs están en `evidencias/`. `resultados-comparados.json` extrae los resúmenes reales; un exit=1 histórico o D original no se presenta como éxito total. `ejecutar.cjs` imprime los resultados de cada proceso sin ocultar fallos.

## Los cinco FAIL originales de Claude

| Prueba | Antes | Después original | Después con archivo explícito |
|---|---|---|---|
| D13 · bandera obsoleta | FAIL | PASS | PASS |
| D17b · autosustitución | FAIL | PASS | PASS |
| D18 · primera fecha/etiqueta | FAIL | PASS | PASS |
| D04b · contradicción de estado | FAIL | FAIL | PASS |
| D19b · contradicción de importe | FAIL | FAIL | PASS |

**Los originales D04b y D19b todavía fallan.** Ambos consultan la bandeja después de conciliar y reprocesar sin ejecutar archivo ni aportar motivo. Retirarlos automáticamente para obtener 28/28 contradiría el archivo motivado exigido. El reproceso sigue devolviendo 503 y conserva la evidencia, como corresponde.

`evidencias/adversarial-con-archivo.test.cjs` carga el original sin modificarlo y añade exclusivamente la acción nueva antes de consultar la bandeja en esos dos casos, con motivo y recibo probatorio. Todas las aserciones originales permanecen iguales; añade una comprobación de éxito del archivo. `variante-archivo-origen.json` registra SHA de origen y las dos inserciones exactas. El 28/28 de esta variante **no es el resultado del original**. Z03 comprueba además auditoría, campos originales, no alteración del pedido y visibilidad en seguimiento financiero.

## Históricas P06/P23

Siguen FAIL en ambas ejecuciones; no se cambian, omiten ni sustituyen sus aserciones. P06 espera conservar un pago aun con importe/moneda inválidos; la política vigente exige la validación financiera. P23 espera cancelar con información de proveedor insuficiente; la política vigente conserva revisión ante incertidumbre. Las v2 pasan y no reemplazan la aceptación comercial pendiente documentada en remediacion-2.

## Matriz: cinco FAIL conservados

- P13: conciliación sin ID conocido responde 409; no existe descubrimiento automático de transacciones que se pueda inventar localmente.
- P20: segundo APPROVED deja incidencia y preparación bloqueada; la matriz no ejecuta la resolución administrativa y su detección estática no reconoce la ruta vigente. C/R/N sí ejercitan las rutas reales.
- P22b: cupón agotado deja incidencia y bloqueo hasta decisión; la matriz no ejecuta esa resolución.
- P28: cancelación conserva vigilancia por un enlace aún activo y por incertidumbre financiera; no se cambia esta política.
- **X07: expires_at enviado y wompiExpiresAt son null. El vencimiento sigue pendiente.** No se modifica Payment Links para cerrarlo.

`matriz-veredictos-comparados.json` compara cada ID: los 50 veredictos coinciden antes/después. No significa que los cinco FAIL estén cerrados.

## Verificación adicional

Build Next aislado: aprobado. Chrome real, autenticación/Express reales y Mongo efímero: archivo en escritorio, reapertura en móvil, formulario obligatorio, seguimiento visible y contadores actuales; cero errores de página y cero solicitudes externas. `panel-result.json` y capturas.

ESLint comparado contra las copias iniciales: componente y servicio 0 errores antes/después; la página de alertas conserva un error anterior de `react-hooks/set-state-in-effect` en su efecto de carga, sin introducir uno nuevo. `lint-comparado.json`. No se amplía este trabajo para corregirlo. Diff de las fuentes propias sin errores de espacios (`git diff --check`).

Pruebas nuevas: permisos admin/superadmin frente a vendedor/cliente; falta de motivo/cuerpo/evidencia; prueba ajena o de otro ambiente; PENDING/lag recuperable; original sin pedido y con pedido; archivo duplicado/concurrente; reapertura y evidencia nueva; integridad de timestamps; AuditLog atómico con fallo real de Mongo; bloqueo de despacho independiente. No hay pruebas contra Atlas, Wompi real ni producción.
