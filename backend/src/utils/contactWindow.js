// Franja horaria para mensajes comerciales (H-05).
//
// INTERPRETACIÓN PENDIENTE DE REVISIÓN JURÍDICA: la aplicabilidad de la
// Ley 2300 de 2023 (arts. 3 y 5) a los correos comerciales de DIZOR no está
// confirmada (informe de auditoría, F.3). Se aplica de forma conservadora la
// franja que recogen las compilaciones consultadas:
//   lunes a viernes 7:00–19:00 y sábados 8:00–15:00, sin domingos ni festivos.
//
// Los festivos no se calculan aquí: no hay un calendario validado en el
// proyecto. Pueden bloquearse fechas con MARKETING_BLOCKED_DATES
// (AAAA-MM-DD separadas por comas). Pendiente: calendario oficial de
// festivos.

const COLOMBIA_UTC_OFFSET_HOURS = -5; // Colombia no aplica horario de verano

const toColombiaParts = (date) => {
  const shifted = new Date(date.getTime() + COLOMBIA_UTC_OFFSET_HOURS * 3600 * 1000);
  return {
    day: shifted.getUTCDay(), // 0 = domingo
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    isoDate: shifted.toISOString().slice(0, 10),
  };
};

const blockedDates = () =>
  new Set(
    (process.env.MARKETING_BLOCKED_DATES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

const isWithinCommercialWindow = (date = new Date()) => {
  const { day, minutes, isoDate } = toColombiaParts(date);
  if (blockedDates().has(isoDate)) return false;
  if (day === 0) return false;
  if (day === 6) return minutes >= 8 * 60 && minutes < 15 * 60;
  return minutes >= 7 * 60 && minutes < 19 * 60;
};

module.exports = { isWithinCommercialWindow, toColombiaParts };
