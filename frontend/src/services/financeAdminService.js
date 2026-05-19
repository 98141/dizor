import api from "./api";

const financeParams = (params = {}) => {
  const { range, period, from, to, ...rest } = params;
  return {
    range: range || period || "month",
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...rest,
  };
};

export const getFinanceReport = async (params = {}) => {
  const res = await api.get("/admin/finance/report", {
    params: financeParams(params),
  });
  return res.data;
};

/** @deprecated use getFinanceReport */
export const getFinanceOverview = getFinanceReport;

const downloadExport = async (path, params, filename) => {
  const res = await api.get(path, {
    params: financeParams(params),
    responseType: "blob",
  });
  const blob = new Blob([res.data], {
    type: res.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportFinanceCsv = (params) =>
  downloadExport(
    "/admin/finance/export/csv",
    params,
    `dizor-finanzas-${Date.now()}.csv`
  );

export const exportFinanceXlsx = (params) =>
  downloadExport(
    "/admin/finance/export/xlsx",
    params,
    `dizor-finanzas-${Date.now()}.xlsx`
  );

export const exportFinancePdf = (params) =>
  downloadExport(
    "/admin/finance/export/pdf",
    params,
    `dizor-finanzas-${Date.now()}.pdf`
  );
