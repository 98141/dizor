# Evidencias: auditoría del cierre de residuales

| Archivo | Qué es |
|---|---|
| `adversarial-cierre.test.cjs` | Batería F01–F35 (28 casos). `AUD_ROOT` elige el árbol probado |
| `preservar.cjs` | Precarga que desvía las escrituras bajo `docs/` a `salidas/<CLAUDE_RUN>/`; normaliza las rutas cortas 8.3 |
| `estado-repositorio.txt` | Rama, HEAD, `git status` y `diff --stat` al empezar |
| `huella-sha256-antes.txt` / `huella-verificacion-final.txt` | SHA-256 de 4.295 archivos antes de ejecutar y comprobación final |
| `ejec-F-cierre.txt` | Batería F: 27/1 |
| `ejec-D-original.txt`, `ejec-C-original.txt` | Mis baterías anteriores sin modificar: 26/2 y 35/35 |
| `ejec-codex-variante-D.txt` | Variante de Codex con archivo explícito: 28/28 |
| `ejec-codex-Z-residuales.txt`, `ejec-codex-R.txt`, `ejec-codex-L.txt`, `ejec-codex-N.txt`, `ejec-v2.txt` | Suites de Codex |
| `ejec-historica-9.txt`, `ejec-matriz-contrato.txt` | Suite histórica (273/275) y matriz (44/5/1) |
| `salidas/` | Escrituras desviadas (3 JSON de `auditoria-admin`, resultados de la matriz y `variante-archivo-origen.json`) |

## Reproducción (Git Bash, desde la raíz del repositorio)

```bash
REPO="$PWD"; . docs/auditoria-wompi-pedidos/auditoria-claude-2/evidencias/entorno.sh
E3="$REPO/docs/auditoria-wompi-pedidos/auditoria-cierre-residuales/evidencias"; P="$E3/preservar.cjs"
X="<directorio temporal>/arbol-cierre"; mkdir -p "$X"
tar --exclude='./.git' --exclude='node_modules' --exclude='.next' --exclude='.env' --exclude='.env.*' --exclude='./backend/logs' -cf - . | tar -x -C "$X"
# PowerShell: New-Item -ItemType Junction -Path "$X\backend\node_modules" -Target "$REPO\backend\node_modules"
# Al terminar, quitar SOLO la unión (cmd /c rmdir). Nunca borrar la copia con rm -rf mientras exista la unión.
export AUD_ROOT="$X"; cd "$X"
CLAUDE_RUN=f  node --require "$P" --test --test-concurrency=1 "$E3/adversarial-cierre.test.cjs"
CLAUDE_RUN=d  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/auditoria-claude-2/evidencias/adversarial-2.test.cjs
CLAUDE_RUN=c  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/adversarial.test.cjs
CLAUDE_RUN=z  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/cierre-residuales/residuales.test.cjs
CLAUDE_RUN=da node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/cierre-residuales/evidencias/adversarial-con-archivo.test.cjs
CLAUDE_RUN=r  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion/regresiones.test.cjs
CLAUDE_RUN=l  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion/limites.test.cjs
CLAUDE_RUN=n  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/remediacion-2/regresiones.test.cjs
CLAUDE_RUN=v  node --require "$P" --test --test-concurrency=1 backend/test/phase1-v2.test.js
CLAUDE_RUN=m  node --require "$P" docs/auditoria-wompi-pedidos/remediacion/auditoria-contrato.cjs
cd backend && CLAUDE_RUN=h node --require "$P" --require ../docs/auditoria-wompi-pedidos/remediacion/contrato-fixtures.cjs --test --test-concurrency=1 \
  test/phase1.test.js test/phase2-compatibility.test.js test/phase2.test.js test/phase3.test.js test/phase4.test.js \
  test/phase5-corrections.test.js test/phase5.test.js test/phase6.test.js test/phase7.test.js
```

Ninguna ejecución usa `.env`, Atlas, llaves reales ni red externa.
