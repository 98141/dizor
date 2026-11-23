# Evidencias: segunda auditoría independiente

## Archivos

| Archivo | Qué es |
|---|---|
| `adversarial-2.test.cjs` | Batería nueva D01–D24 (28 casos). `AUD_ROOT` elige el árbol probado |
| `preservar-claude-2.cjs` | Precarga que desvía escrituras bajo `docs/` a `salidas/<CLAUDE_RUN>/`, con normalización de rutas cortas 8.3 |
| `entorno.sh` | Variables comunes (Git Bash). Definir antes `REPO` |
| `estado-repositorio.txt` | Rama, HEAD, `git status` y `diff --stat` al empezar |
| `huella-sha256-antes.txt` | SHA-256 de 4.141 archivos antes de ejecutar nada |
| `huella-verificacion-final.txt` | Resultado de `sha256sum -c` al terminar, y archivos nuevos de terceros |
| `ejec-adversarial-original-35.txt` | Mi batería C, sin cambios, sobre `23ce3a6`: 35/35 |
| `ejec-adversarial-2.txt` | Batería D sobre `23ce3a6`: 23/5 (líneas `OBS` con los valores observados) |
| `ejec-codex-r01-r27.txt`, `ejec-codex-limites.txt`, `ejec-codex-n01-n15.txt`, `ejec-phase1-v2.txt` | Suites de Codex sobre `23ce3a6` |
| `ejec-suite-historica-9.txt` | Histórica con el adaptador de contrato: 273/275 |
| `ejec-historica-9-sin-adaptador.txt` | Histórica sin adaptador (informativa): 249/275 |
| `ejec-matriz-contrato.txt` | Matriz original en modo contrato: 44/5/1 |
| `ejec-head-checkout.txt` | `checkout.test.js` del otro frente sobre `23ce3a6` (informativa) |
| `ejec-arbol-vivo-*.txt` | Las mismas suites sobre el árbol vivo, con trabajo concurrente sin commit |
| `salidas/` | Escrituras desviadas: `wt-historica/` (3 JSON de `docs/auditoria-admin`) y `prueba-precarga/` (verificación de la precarga) |

## Reproducción (Git Bash, desde la raíz del repositorio)

```bash
REPO="$PWD"; E2="$REPO/docs/auditoria-wompi-pedidos/auditoria-claude-2/evidencias"; . "$E2/entorno.sh"
# Copia aislada de un commit (solo lectura sobre el repositorio):
X="<directorio temporal>/head-23ce3a6"; mkdir -p "$X" && git archive 23ce3a6 | tar -x -C "$X"
# En PowerShell: New-Item -ItemType Junction -Path "$X\backend\node_modules" -Target "$REPO\backend\node_modules"
# Nunca borrar la copia con rm -rf mientras exista la unión: hay que quitar primero la unión (cmd /c rmdir).
export AUD_ROOT="$X"; cd "$X"; P="$E2/preservar-claude-2.cjs"
CLAUDE_RUN=c  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/adversarial.test.cjs
CLAUDE_RUN=d  node --require "$P" --test --test-concurrency=1 "$E2/adversarial-2.test.cjs"
CLAUDE_RUN=r  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs
CLAUDE_RUN=l  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs
CLAUDE_RUN=n  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion-2/regresiones.test.cjs
CLAUDE_RUN=v2 node --require "$P" --test --test-concurrency=1 backend/test/phase1-v2.test.js
CLAUDE_RUN=m  node --require "$P" docs/auditoria-wompi-pedidos/remediacion/auditoria-contrato.cjs
cd backend && CLAUDE_RUN=h node --require "$P" --require ../docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs \
  --test --test-concurrency=1 test/phase1.test.js test/phase2-compatibility.test.js test/phase2.test.js test/phase3.test.js \
  test/phase4.test.js test/phase5-corrections.test.js test/phase5.test.js test/phase6.test.js test/phase7.test.js
```

Para probar el árbol vivo, omitir `AUD_ROOT` y ejecutar desde la raíz del repositorio.

Ninguna ejecución usa `.env`, Atlas, llaves reales ni red externa.
