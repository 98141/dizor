#!/usr/bin/env bash
# =============================================================================
#  Dizor · Script de auditoría de ciberseguridad
#  Uso:   ./security-audit.sh sombrerosdizor.com.co
#  Ejecuta: auditoría de dependencias (npm/osv), escaneo de puertos (nmap),
#           escaneo web de vulnerabilidades (nuclei, nikto) y headers HTTP.
#  Genera un reporte con fecha en ./security-reports/
#
#  IMPORTANTE: escanea SOLO infraestructura tuya. Preferible contra staging
#  o en horario de bajo tráfico. Requiere Kali/Linux con las herramientas.
# =============================================================================

set -uo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Uso: $0 <dominio-o-IP>   (ej: $0 sombrerosdizor.com.co)"
  exit 1
fi

# Normalizar: quitar https:// http:// y la barra final por si se pasa una URL
HOST="$(echo "$TARGET" | sed -E 's#^https?://##; s#/.*$##')"
URL="https://${HOST}"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUTDIR="./security-reports/${HOST}_${STAMP}"
mkdir -p "$OUTDIR"
REPORT="${OUTDIR}/RESUMEN.txt"

# Colores
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${G}[+]${NC} $*"; echo "[+] $*" >> "$REPORT"; }
warn() { echo -e "${Y}[!]${NC} $*"; echo "[!] $*" >> "$REPORT"; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "=== Auditoría Dizor · $HOST · $STAMP ===" | tee "$REPORT"
echo "Reportes en: $OUTDIR" | tee -a "$REPORT"
echo >> "$REPORT"

# -----------------------------------------------------------------------------
# 1. AUDITORÍA DE DEPENDENCIAS  (se corre sobre el código local)
# -----------------------------------------------------------------------------
log "1/5 · Auditoría de dependencias (npm audit + osv-scanner)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for dir in backend frontend; do
  if [[ -f "${SCRIPT_DIR}/${dir}/package.json" ]]; then
    log "   npm audit → ${dir}"
    ( cd "${SCRIPT_DIR}/${dir}" && npm audit --omit=dev ) \
      > "${OUTDIR}/npm-audit-${dir}.txt" 2>&1 || true
    grep -E "vulnerabilities|Severity" "${OUTDIR}/npm-audit-${dir}.txt" | tail -5 >> "$REPORT" || true
  fi
done

if have osv-scanner; then
  log "   osv-scanner → repo completo"
  osv-scanner --recursive "${SCRIPT_DIR}" > "${OUTDIR}/osv-scanner.txt" 2>&1 || true
else
  warn "   osv-scanner no instalado (instala: go install github.com/google/osv-scanner/cmd/osv-scanner@latest)"
fi

# -----------------------------------------------------------------------------
# 2. ESCANEO DE PUERTOS  (nmap)
# -----------------------------------------------------------------------------
if have nmap; then
  log "2/5 · Escaneo de puertos y servicios (nmap)"
  nmap -sV -sC -Pn "$HOST" -oN "${OUTDIR}/nmap-servicios.txt" >/dev/null 2>&1 || true
  log "   Escaneo completo de puertos (-p-, puede tardar)"
  nmap -p- -T4 -Pn "$HOST" -oN "${OUTDIR}/nmap-full.txt" >/dev/null 2>&1 || true
  # Alertar si hay puertos peligrosos expuestos
  if grep -qE "^(27017|5000|3306|6379|9200)/" "${OUTDIR}/nmap-full.txt" 2>/dev/null; then
    warn "   ALERTA: puerto de BD/servicio interno expuesto públicamente. Revisar firewall."
    grep -E "^(27017|5000|3306|6379|9200)/" "${OUTDIR}/nmap-full.txt" >> "$REPORT"
  fi
else
  warn "2/5 · nmap no instalado (apt install nmap)"
fi

# -----------------------------------------------------------------------------
# 3. HEADERS DE SEGURIDAD HTTP
# -----------------------------------------------------------------------------
log "3/5 · Headers de seguridad HTTP"
if have curl; then
  curl -s -I -L "$URL" > "${OUTDIR}/http-headers.txt" 2>&1 || true
  for h in "Strict-Transport-Security" "Content-Security-Policy" "X-Frame-Options" "X-Content-Type-Options"; do
    if grep -qi "$h" "${OUTDIR}/http-headers.txt"; then
      log "   OK · $h presente"
    else
      warn "   FALTA · $h"
    fi
  done
fi

# -----------------------------------------------------------------------------
# 4. ESCANEO WEB DE VULNERABILIDADES  (nuclei + nikto)
# -----------------------------------------------------------------------------
if have nuclei; then
  log "4/5 · Escaneo de vulnerabilidades conocidas (nuclei)"
  nuclei -u "$URL" -severity medium,high,critical \
    -o "${OUTDIR}/nuclei.txt" >/dev/null 2>&1 || true
  [[ -s "${OUTDIR}/nuclei.txt" ]] && warn "   nuclei encontró hallazgos → nuclei.txt" || log "   nuclei sin hallazgos med/high/crit"
else
  warn "4/5 · nuclei no instalado (apt install nuclei; luego: nuclei -update-templates)"
fi

if have nikto; then
  log "   nikto → config comunes"
  nikto -h "$URL" -o "${OUTDIR}/nikto.txt" -Format txt >/dev/null 2>&1 || true
else
  warn "   nikto no instalado (apt install nikto)"
fi

# -----------------------------------------------------------------------------
# 5. TLS / SSL
# -----------------------------------------------------------------------------
if have nmap; then
  log "5/5 · Chequeo TLS/SSL (nmap ssl-enum-ciphers)"
  nmap --script ssl-enum-ciphers -p 443 "$HOST" -oN "${OUTDIR}/tls.txt" >/dev/null 2>&1 || true
fi

echo >> "$REPORT"
echo "=== Fin. Revisa el detalle en ${OUTDIR} ===" | tee -a "$REPORT"
log "Auditoría completada. Resumen: $REPORT"
