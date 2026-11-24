# Reproducción de la corrección F6-I01

Ejecutar desde la raíz `dizor`. Se reutilizan las dependencias existentes, Node, Chrome y MongoDB locales. No se instalan paquetes ni se usan bases reales.

## Entorno temporal

```powershell
$env:MMS_DIR='C:\Users\Asus ExpertBook\AppData\Local\Temp\claude\05d7f1a4ff6d7b65\82d41488-1994-4eae-b07c-5cfc50d82869\scratchpad\testenv'
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
```

Next se compila en una copia temporal sin `.env`, con red bloqueada durante build y solo loopback en ejecución. Express y las sesiones pertenecen al fixture; Mongo usa su propio conjunto de réplicas temporal. Correo y pagos están simulados. Chrome bloquea orígenes externos. La limpieza comprueba la ubicación temporal y el prefijo propio antes de retirar únicamente ese directorio y su unión de dependencias.

## Antes y después

```powershell
$env:DIZOR_I01_MODE='antes'
node frontend/test/taxonomy-responsive-next-browser.cjs
$env:DIZOR_I01_MODE='despues'
node frontend/test/taxonomy-responsive-next-browser.cjs
```

El modo `antes` usa la copia preservada `admin-polish-antes.css` **solo dentro del directorio temporal de build**. No restaura ni modifica el workspace. Su salida es correcta cuando reproduce el defecto a 1024 px con ancho del documento igual al viewport. El modo `despues` exige acciones y encabezados completos, ausencia de desplazamiento horizontal interno y del documento, pruebas de operaciones y teclado.

Cada modo recorre las cinco taxonomías en 22 anchos: 360, 390, 699, 700, 701, 820, 899, 900, 901, 1024, 1099, 1100, 1101, 1199, 1200, 1201, 1279, 1280, 1281, 1439, 1440 y 1441. Cambia el tamaño sin recargar cada pestaña. Incluye nombres cortos y extensos dentro de las validaciones existentes.

El comprobador mide el rectángulo de cada botón y texto, intersecta los contenedores que recortan o desplazan y comprueba los puntos pulsables visibles mediante `elementFromPoint`. El desplazamiento horizontal se reinicia a cero antes de medir. El desplazamiento vertical normal del documento permite alcanzar el listado cuando queda debajo del formulario.

La prueba adversarial restablece temporalmente en Chrome las dos condiciones anteriores —dos columnas y tabla mínima de 640 px—. Debe fallar el mismo comprobador aunque el documento no desborde. Después retira esa hoja temporal y vuelve a exigir el resultado correcto. Esto no modifica archivos de aplicación.

## Regresión Node

```powershell
node --require ./docs/auditoria-admin/cierre-fase6/correccion-f6-i01-evidencias/preservar-salidas.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js backend/test/phase4.test.js backend/test/phase5.test.js backend/test/phase5-corrections.test.js backend/test/phase6.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js docs/auditoria-admin/cierre-fase3/independiente.test.js docs/auditoria-admin/cierre-fase4/independiente.test.js docs/auditoria-admin/cierre-fase5/independiente.test.js docs/auditoria-admin/cierre-fase5/revalidacion-evidencias/revalidacion.test.js docs/auditoria-admin/cierre-fase6/independiente.test.js frontend/test/stock-adjustment.test.cjs frontend/test/admin-fields.test.cjs
```

Son las 292 pruebas de línea base más las 3 independientes de Fase 6: 295. `regresion-node.txt` conserva el resultado de esta ejecución.

## Regresión de navegador

```powershell
node docs/auditoria-admin/cierre-fase6/correccion-f6-i01-evidencias/regresion-navegador.cjs
```

Reproduce las ocho suites originales: 8 + 20 + 20 + 35 + 10 + 25 + 18 + 59 = 195. `preservar-salidas.cjs` desvía sus escrituras a esta carpeta; no se sustituyen pruebas ni evidencias publicadas de fases anteriores. Los códigos de salida y duraciones quedan en `regresion-navegador.json`.

## Comprobaciones estáticas

```powershell
node docs/auditoria-admin/cierre-fase6/correccion-f6-i01-evidencias/verificar-estatico.cjs
```

Comprueba sintaxis, parseo CSS, ESLint de los scripts nuevos y los componentes de taxonomía, comparación de los mismos 23 archivos frontend de Fase 6 y `git diff --check`. CSS no tiene una configuración de ESLint en este proyecto: se verifica con PostCSS y build. No se suprimen reglas.

`baseline-archivos.json` registra el estado inicial real del workspace, incluidos cambios previos todavía sin commit. La preservación final compara contra esa copia y permite únicamente el cambio solicitado en `admin-polish.css`. Los archivos nuevos de esta corrección se enumeran por separado.
