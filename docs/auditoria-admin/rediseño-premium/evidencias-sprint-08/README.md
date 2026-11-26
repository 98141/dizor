# Evidencias Sprint 08 · Configuración, Usuarios y personal, Auditoría

Ejecutar desde `dizor/`. Para las pruebas con Mongo: `MMS_DIR` (carpeta con `node_modules/mongodb-memory-server`), `MONGOMS_SYSTEM_BINARY` (mongod 8.3.2 local), `MONGOMS_VERSION=8.3.2`, `MONGOMS_RUNTIME_DOWNLOAD=false`. Sin `.env`, bases reales, red externa, correos ni pagos.

| Qué | Comando | Salida |
| --- | --- | --- |
| Backend Sprint 08 (10) | `node --test backend/test/sprint08-config-users-audit.test.js` | `backend-sprint08.txt` |
| Navegador Sprint 08 (34) | `node frontend/test/sprint08-configuracion-browser.cjs` (`DIZOR_SPRINT08_MODE=antes` solo captura el diseño anterior) | `despues/`, `antes/`, `navegador-sprint08.txt` |
| ESLint de lo tocado | `npx eslint …` desde `frontend/` | `eslint-sprint08.txt` (vacío = 0 problemas) |
| Regresión Node | `node docs/auditoria-admin/rediseño-premium/evidencias-sprint-08/regresion-node.cjs --etiqueta=sprint08` | `regresion-node-sprint08.*` |
| Línea base HEAD | el mismo comando dentro de una copia `git archive HEAD` con `--etiqueta=HEAD` | `regresion-node-HEAD.*`, `comparacion-regresion-node.json` |
| Navegador original | `node docs/auditoria-admin/rediseño-premium/evidencias-sprint-08/regresion-navegador.cjs [suite]` | `regresion-*.txt`, `regresion-navegador.json` |
| Suites derivadas | `node --require ./docs/…/evidencias-sprint-08/preservar-salidas.cjs ./docs/…/evidencias-sprint-08/ejecutar-suite-derivada.cjs navegacion\|fase6\|fase6-continuar` | `derivada-*.txt`, `derivada-*.json` |

`regresion/` recibe lo que las suites antiguas habrían escrito en sus carpetas de fase. `ejecutar-suite-derivada.cjs` no cambia archivos en disco: aplica en memoria sustituciones contadas y las registra; las aserciones neutralizadas se imprimen como «NO SUPERADA».
