# Evidencias: auditoría final GO / NO-GO

| Archivo | Qué es |
|---|---|
| `adversarial-conclusion.test.cjs` | Batería G01–G10 contra la operación "concluir seguimiento" (RC-01) |
| `preservar.cjs` | Precarga que desvía escrituras bajo `docs/` a `salidas/` |
| `estado-repositorio.txt` | Rama, HEAD, `origin/main...main`, `git status` y diff |
| `huella-sha256-antes.txt` / `huella-verificacion-final.txt` | 4.401 archivos antes de ejecutar; comprobación final sin diferencias |
| `ejec-G/F/FA/C/D/DA/Q/Z/R/L/N/V/CK/FM/H/M.txt` | Salidas de cada suite (`05` §2) |
| `salidas/` | Escrituras desviadas |

## Reproducción

Igual que en `auditoria-cierre-residuales/evidencias/LEEME.md`, con `X=<temporal>/arbol-final` y estos añadidos:

```bash
CLAUDE_RUN=G  node --require "$P" --test --test-concurrency=1 "$E/adversarial-conclusion.test.cjs"
CLAUDE_RUN=FA node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/preproduccion/evidencias/f-con-conclusion.test.cjs
CLAUDE_RUN=Q  node --require "$P" --test --test-concurrency=1 docs/auditoria-wompi-pedidos/preproduccion/rc01.test.cjs
CLAUDE_RUN=CK node --require "$P" --test --test-concurrency=1 backend/test/checkout.test.js backend/test/municipality-catalog.test.js
CLAUDE_RUN=FM node --require "$P" --test --test-concurrency=1 frontend/test/municipalities.test.cjs
```

**Ningún script de esta carpeta contacta Wompi real.** Los scripts `preproduccion/evidencias/sandbox-*.cjs` de Codex sí lo hacen: leen `backend/.env` y `sandbox-expiry.cjs` crea enlaces. No ejecutarlos sin autorización.
