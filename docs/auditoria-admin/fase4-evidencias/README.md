# Evidencias reproducibles — Fase 4

Ejecutar desde la raíz `dizor`, con las dependencias locales existentes. No cargar `.env`, no iniciar `backend/src/server.js` ni usar una base existente. No se requieren credenciales reales ni instalaciones nuevas.

## Regresión y concurrencia

PowerShell; ajustar las rutas locales de herramientas:

```powershell
$env:MMS_DIR='C:\ruta\herramientas-mongo' # contiene node_modules/mongodb-memory-server
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
$env:MONGOMS_VERSION='8.3.2'
$env:MONGOMS_RUNTIME_DOWNLOAD='false'
node --require ./docs/auditoria-admin/fase4-evidencias/preservar-evidencias.cjs --test --test-concurrency=1 backend/test/phase1.test.js backend/test/phase2.test.js backend/test/phase2-compatibility.test.js backend/test/phase3.test.js backend/test/phase4.test.js docs/auditoria-admin/cierre-fase2/independiente.test.js docs/auditoria-admin/cierre-fase3/independiente.test.js frontend/test/stock-adjustment.test.cjs
```

Resultado consolidado: **210 aprobadas, cero fallidas/omitidas**. Desglose: 57 + 53 + 5 + 34 + 42 + 9 + 6 + 4. La referencia final es `regresion-completa.txt`. `pruebas-fase4.txt` conserva una ejecución inicial de las 42 nuevas; la consolidada contiene las verificaciones finales ampliadas.

Solo las nuevas: `node --test backend/test/phase4.test.js` o `npm run test:phase4` desde backend, con las variables anteriores. Las cuatro originales de React también pueden ejecutarse con `node --test frontend/test/stock-adjustment.test.cjs`.

Los fixtures usan replica set efímero en localhost, datos `.test`, proveedores simulados y salida externa bloqueada. No leen `.env`, no arrancan el servidor real y no modifican bases existentes. Los cambios crudos de datos históricos y el borrado de fixtures pertenecen exclusivamente a esas bases efímeras.

`preservar-evidencias.cjs` redirige solo los JSON generados por las pruebas anteriores hacia `cierre-fase1-resultados.json`, `cierre-fase2-resultados.json` y `cierre-fase3-resultados.json` de esta carpeta. No altera sus aserciones ni informes. Algunos textos de diagnóstico de los fixtures anteriores son históricos; los veredictos actuales son los de esta corrida.

## Volumen y explain

V42 crea **1.201 productos y 3.601 variantes**. Verifica 400 coincidencias y una página de 20 filas; guarda el tiempo de la petición completa y el plan del pipeline real en `rendimiento.json`. El explain no incluye el populate posterior, y la petición medida sí incluye el controlador completo. No se añade ningún índice para mejorar artificialmente la prueba.

La evidencia es local y ficticia. No permite inferir latencia productiva. La agregación calcula la clasificación antes de paginar; una búsqueda no anclada puede examinar muchos candidatos. El riesgo de consultas de pedidos de Fase 3 no se modificó.

## React en Chrome aislado

```powershell
# Opcionales si las herramientas existentes están en otras rutas:
$env:DIZOR_BROWSER_TOOLS='C:\ruta\node_modules\puppeteer-core'
$env:DIZOR_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node frontend/test/catalog-workspace-browser.cjs
```

Se utilizaron Chrome instalado, `puppeteer-core` ya disponible en la carpeta temporal `dizor-verify-puppeteer`, React/SWC/webpack/Next del frontend y perfil temporal. El script compila los componentes reales de Catálogo, ajuste, historial y editor, con AdminShell y CSS reales. Adapta router/contextos y servicios a una API HTTP ficticia propia. No inicia una sesión contra Next/backend de desarrollo ni se conecta a proveedores.

Resultado: **C01–C20 aprobadas**, `pageErrors: []`, `externalRequests: []`. Incluye filtros, regreso desde edición, foco por variante, confirmación, doble clic, respuesta perdida después de aplicar, conservación de clave al reintentar, error/recuperación, vendedor, galería/formulario y estados vacíos. La descarga de PDF se comprueba como acción de interfaz; su endpoint real se comprueba en V38.

Genera `navegador.json`, `navegador.txt` y dieciséis capturas: Productos, Existencias, Movimientos y Editor en escritorio, tablet 820 px, móvil 390 px y móvil 360 px. Se mide desbordamiento horizontal y se revisan visualmente las capturas. Las miniaturas son SVG ficticio servido en localhost.

El perfil, bundle y servidor son temporales. El script comprueba la ruta de su carpeta antes de eliminarla. Si aparece un fallo, el JSON conserva la condición y contexto de la espera; solo una corrida con `passed:true` es una aprobación.

## Sintaxis, lint y build

```powershell
node docs/auditoria-admin/fase4-evidencias/verificar-estatico.cjs
node docs/auditoria-admin/fase4-evidencias/build-fase4.cjs
git diff --check
```

La verificación estática aplica `node --check` a 15 archivos Node y ESLint del proyecto a 13 archivos frontend. Compara con `git show HEAD:<ruta>` sin reescribir el árbol. Backend no dispone de configuración propia: se aplican expresamente `no-unreachable`, `no-dupe-keys` y `no-unused-vars`.

Resultados en `estatico-resumen.json`, `sintaxis.json` y `eslint-*.json`: sin fallos de sintaxis ni diagnósticos nuevos. Frontend conserva tres errores/una advertencia anteriores (base: cinco errores/dos advertencias). Node conserva una advertencia anterior (base: dos). La salida 0 del comparador significa ausencia de regresión estática, no lint global limpio; los mensajes completos antes/después se conservan.

El build copia frontend a una carpeta temporal y excluye `.env*`, `.next`, pruebas y dependencias. Enlaza dependencias existentes, filtra variables heredadas y bloquea fetch/TCP. Ejecuta `next build --webpack` sin iniciar la aplicación ni desplegar; retira el enlace antes de borrar únicamente la carpeta temporal validada. Evidencias: `build-fase4.json` / `build-fase4.txt`.

En este host los sockets de localhost y el enlace temporal de dependencias requirieron ejecución fuera del sandbox restrictivo. Se usó exclusivamente para estas comprobaciones aisladas.

## Alcance

No se usaron correos/pagos reales, producción, datos reales o archivos `.env`. No se activó entrega externa, no hubo commits/pushes ni migraciones reales. Los índices históricos y las pruebas anteriores permanecen sin cambios. Los registros nuevos de intención/control utilizan su `_id` en las bases de prueba; no sustituyen ni inventan movimientos históricos.

Informe: [informe-fase4-productos-inventario-2026-11-20.md](../informe-fase4-productos-inventario-2026-11-20.md).

`resultados-finales.json` consolida las comprobaciones finales. `manifest-sha256.json` registra las huellas de los archivos de esta entrega y la comparación de archivos protegidos con HEAD. El manifiesto no incluye su propia huella.
