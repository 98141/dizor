# Evidencias y reproducción

## Línea base y preservación

- `evidencias/git-status.txt`, `git-show.txt`, `git-log.txt`: estado inicial y alcance completo del commit 23ce3a6. No había commits posteriores.
- `evidencias/linea-base-sha256.json`: 4216 archivos de fuentes, pruebas y documentación existentes antes de editar.
- `evidencias/originales/`: ocho fuentes previstas, copiadas antes de modificar. El servicio nuevo no existía.
- `evidencias/preservacion.json`: comparación final; solo cambian las ocho fuentes propias entre los archivos iniciales. Cero pruebas originales o evidencias previas modificadas; trabajo paralelo de checkout conservado byte a byte respecto a esta línea base.
- `evidencias/codigo-final-sha256.json`, `cierre-residuales.diff`, `git-status-final.txt`: cambios atribuibles al cierre. Los demás cambios del árbol ya estaban al comenzar.

## Reproducción de fallas y correcciones

| Hallazgo | Reproducción antes | Validación después |
|---|---|---|
| NR-01 | antes-D.txt D13; antes-NR.txt Z01 | final-ajuste-D.txt D13; final-cierre-NR.txt Z01, final-N.txt N08, final-R.txt R26 |
| NR-02 | antes-D.txt D17b/D18; antes-NR.txt Z02 | final-ajuste-D.txt D17b/D18; final-cierre-NR.txt Z02; final-C/N para moneda y error de reproceso |
| NR-03 estado | antes-D.txt D04b; antes-NR.txt Z03-state, ruta inexistente | final-cierre-NR.txt Z03-state; final-DA.txt D04b con archivo explícito |
| NR-03 importe | antes-D.txt D19b; antes-NR.txt Z03-amount, ruta inexistente | final-cierre-NR.txt Z03-amount; final-DA.txt D19b con archivo explícito |
| Integridad, permisos y concurrencia | antes-NR.txt no existe operación | final-cierre-NR.txt Z04–Z11; Z08 inyecta fallo real insert de Mongo y prueba rollback de AuditLog+evento |

El primer conjunto residual tenía nueve pruebas y reproduce 9 FAIL; luego pasa 9/9. Se agregaron tres pruebas de cobertura (prueba originada en webhook con GET privado, superadmin/nueva evidencia y petición sin cuerpo/ambiente incorrecto): resultado final 12/12. No se presenta una línea base ficticia de esas tres adicionales.

## Ejecución local

Desde la raíz real `C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\Dizor\dizor`:

```powershell
node docs/auditoria-wompi-pedidos/cierre-residuales/evidencias/ejecutar.cjs repeticion NR C D R L N V H M
```

El ejecutor reutiliza la instalación existente de mongodb-memory-server en RicardoMelo/ecommerce-mern/backend y el binario local Mongo 8.3; no instala paquetes. Las pruebas originales conservan sus fixtures. C/D/N/NR fijan GET privado explícitamente; R/matriz/históricas reutilizan los adaptadores de contrato anteriores, indicados en sus fuentes. No son una prueba externa del contrato de Wompi.

`preload.cjs` redirige escrituras de resultados en docs anteriores hacia esta carpeta; no transforma aserciones ni fuentes de aplicación. Así se conserva la evidencia histórica incluso cuando una suite intenta escribir en su ruta antigua. Las salidas nuevas de la matriz están en `antes-M-salidas/` y `final-M-salidas/`.

Para la variante de archivo:

```powershell
$env:MMS_DIR = 'C:\Users\Asus ExpertBook\Desktop\Desarrollo_MBT\RicardoMelo\ecommerce-mern\backend'
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
node --require ./docs/auditoria-wompi-pedidos/cierre-residuales/evidencias/preload.cjs --test ./docs/auditoria-wompi-pedidos/cierre-residuales/evidencias/adversarial-con-archivo.test.cjs
```

## Panel administrativo

`evidencias/panel.cjs` crea una copia temporal del frontend sin .env, construye Next con red bloqueada y usa Chrome real contra Express/Mongo temporales. Solo cambia el origen CORS del fixture al puerto local asignado; no cambia estados del proveedor automáticamente ni aserciones originales. El proveedor simulado se configura explícitamente.

`panel-build.txt`, `panel-ejecucion.txt`, `panel-server.txt`, `panel-result.json` y capturas `panel-archivo.png`, `panel-reapertura-movil.png` documentan el resultado final. Las copias temporales se eliminan después de verificar su ubicación y retirar únicamente la junction creada hacia node_modules. No se borran carpetas de trabajo ajenas.

`lint.cjs` compara la misma configuración ESLint, con cwd frontend, antes y después; `lint-comparado.json` distingue el fallo previo de la página y los dos archivos sin errores.

No se cargaron secretos de entorno del proyecto. Todas las identidades, compras, claves y transacciones de los fixtures son ficticias. Los logs describen fallos inyectados y datos locales; no son evidencia de una transacción financiera real.
