# Evidencias reproducibles — Fase 6

Fecha de referencia: 21/11/2026, America/Bogota. Ejecutar desde la raíz `dizor`.

## Entorno

Se reutilizan Node, Chrome, MongoDB y las dependencias ya instaladas. No se instalan paquetes. `axe-core` 4.11.4 ya estaba disponible en `frontend/node_modules`.

```powershell
$env:MMS_DIR='C:\Users\Asus ExpertBook\AppData\Local\Temp\claude\05d7f1a4ff6d7b65\82d41488-1994-4eae-b07c-5cfc50d82869\scratchpad\testenv'
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
```

El fixture crea su propio conjunto de réplicas temporal, usuarios `.test`, API y puertos. Los transportes de correo y pagos están simulados. El arnés Next copia el frontend a un directorio temporal sin `.env`, `.next` ni credenciales heredadas; bloquea red durante build y permite únicamente loopback en ejecución. Chrome también bloquea orígenes externos. Se limpia exclusivamente el directorio propio, después de comprobar su ruta y retirar la unión de dependencias.

## Regresión Node y casos nuevos

```powershell
node --require ./docs/auditoria-admin/fase6-evidencias/preservar-evidencias.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js backend/test/phase4.test.js backend/test/phase5.test.js backend/test/phase5-corrections.test.js backend/test/phase6.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js docs/auditoria-admin/cierre-fase3/independiente.test.js docs/auditoria-admin/cierre-fase4/independiente.test.js docs/auditoria-admin/cierre-fase5/independiente.test.js docs/auditoria-admin/cierre-fase5/revalidacion-evidencias/revalidacion.test.js frontend/test/stock-adjustment.test.cjs frontend/test/admin-fields.test.cjs
```

Resultado publicado: `regresion-node-final.txt`. Los 285 casos anteriores conservan sus aserciones; se agregan 7 casos. El gancho desvía las escrituras de suites anteriores a `regresion/`, sin modificar los originales.

## Regresión de navegador

```powershell
node docs/auditoria-admin/fase6-evidencias/regresion-navegador.cjs
```

Ejecuta las siete suites anteriores: 8 + 20 + 20 + 35 + 10 + 25 + 18 = 136. Guarda códigos de salida y duración en `regresion-navegador.json`, logs separados y evidencias originales reproducidas en `regresion/`.

## Inspección y pruebas nuevas sobre Next real

```powershell
$env:DIZOR_PHASE6_MODE='despues'
node frontend/test/admin-polish-next-browser.cjs
```

`antes/` contiene la pasada previa sobre el código inicial. No reproducir ese modo sobre código corregido para sustituir la línea base. `despues/` contiene la evidencia final sobre 33 pantallas a 1440, 1024, 820, 390 y 360 px, más subsecciones y estados de interacción. `next-navegador.json` incluye los casos, errores de página, hidratación y peticiones externas. `build-fase6.json` y `.txt` registran el build aislado.

`despues/axe.json`: 58 evaluaciones de axe sobre los dos anchos extremos de las 29 pantallas de administrador, con etiquetas WCAG 2 A/AA, 2.1 AA y 2.2 AA. `accesibilidad.json` añade contraste calculado y nombres de botones del árbol de accesibilidad de Chrome. No sustituyen una evaluación completa con lector de pantalla ni una certificación WCAG.

`secciones-adicionales.json` comprueba las cinco taxonomías, las 20 subsecciones editoriales y las dos listas de Marketing con registros. Las pruebas usan eventos reales de teclado y también dos envíos síncronos para reproducir la carrera anterior al siguiente render de React.

## Sintaxis, lint y preservación

```powershell
node docs/auditoria-admin/fase6-evidencias/verificar-estatico.cjs
node docs/auditoria-admin/fase6-evidencias/manifestar.cjs
```

La comprobación estática transforma JSX con el compilador existente, usa `node --check` y parsea CSS. Compara cada diagnóstico de los archivos modificados con `lint-antes.json`, sin suprimir reglas. `lint-despues.json` conserva además la inspección de todo el ámbito administrativo. El manifiesto registra SHA-256 y compara con HEAD los archivos protegidos, normalizando únicamente saltos de línea.

Se revisan además el estado de error del editor de costos y el ajuste abierto a los cinco anchos. `resumir-resultados.cjs` comprueba los totales, los enlaces del informe y genera `resumen-final.json` y `MATRIZ_FINAL.md`.

Las pruebas pueden necesitar permiso del entorno para abrir puertos locales, iniciar Chrome y crear una unión de dependencias. No requieren acceso a producción, despliegue, cuentas reales ni edición de `.env`.
