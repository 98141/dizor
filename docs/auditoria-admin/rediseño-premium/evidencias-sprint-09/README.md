# Evidencias Sprint 09 · Editor de productos

Ejecutar desde `dizor/`. Variables: `MMS_DIR` (carpeta con `node_modules/mongodb-memory-server`), `MONGOMS_SYSTEM_BINARY` (mongod 8.3.2 local), `MONGOMS_VERSION=8.3.2`, `MONGOMS_RUNTIME_DOWNLOAD=false`. Sin `.env`, bases reales, Cloudinary, red externa, correos ni pagos.

| Qué | Comando | Salida |
| --- | --- | --- |
| Editor en Next + Express + Mongo (33) | `node frontend/test/sprint09-editor-next-browser.cjs` (`DIZOR_SPRINT09_MODE=antes` solo captura el diseño previo) | `despues/`, `antes/`, `navegador-sprint09.txt` |
| Ajuste relativo (unidad, 4) | `node --test frontend/test/stock-adjustment.test.cjs` | incluido en `regresion-node-sprint09.txt` |
| Catálogo F4 / Sprint 03 (20) | `node --preserve-symlinks --require ./docs/…/evidencias-sprint-09/preservar-salidas.cjs frontend/test/catalog-workspace-browser.cjs` | `regresion-catalogo.txt`, `regresion/fase4-evidencias/` |
| Regresión Node | `node docs/auditoria-admin/rediseño-premium/evidencias-sprint-09/regresion-node.cjs --etiqueta=sprint09` | `regresion-node-sprint09.*`, `comparacion-regresion-node.json` (línea base HEAD en `evidencias-sprint-08/regresion-node-HEAD.json`) |
| F5 / F6 derivadas | `node --require ./docs/…/evidencias-sprint-09/preservar-salidas.cjs ./docs/…/evidencias-sprint-09/ejecutar-suite-derivada.cjs navegacion\|fase6-continuar` | `derivada-*.txt`, `derivada-*.json`, `regresion/fase5-evidencias/`, `regresion/fase6-evidencias/` |

Imágenes de prueba: archivos de `frontend/public/` servidos por el propio Next. Los fallos de red se inyectan interceptando peticiones del navegador; «aplicado pero respuesta perdida» reenvía primero la petición a Express y después responde 502/503 al navegador.
