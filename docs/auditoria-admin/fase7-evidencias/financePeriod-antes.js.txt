exports.parseFinancePeriod = (period, from, to) => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const endCustom = new Date(to);
    endCustom.setHours(23, 59, 59, 999);
    return {
      start,
      end: endCustom,
      label: `Del ${start.toLocaleDateString("es-CO")} al ${endCustom.toLocaleDateString("es-CO")}`,
    };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case "week": {
      start.setDate(start.getDate() - 6);
      return { start, end, label: "Últimos 7 días" };
    }
    case "quarter": {
      const qMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(qMonth, 1);
      return { start, end, label: "Trimestre actual" };
    }
    case "year": {
      start.setMonth(0, 1);
      return { start, end, label: "Año actual" };
    }
    case "all":
      return { start: null, end: null, label: "Histórico completo" };
    case "month":
    default: {
      start.setDate(1);
      return { start, end, label: "Mes actual" };
    }
  }
};

exports.buildDateFilter = (start, end) => {
  if (!start && !end) return {};
  const filter = {};
  if (start || end) filter.createdAt = {};
  if (start) filter.createdAt.$gte = start;
  if (end) filter.createdAt.$lte = end;
  return filter;
};
