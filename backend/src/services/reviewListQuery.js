/** Query de listado administrativo. Sin `page`, se conserva el contrato anterior. */

const LEGACY_DEFAULT = 100;
const LEGACY_MAX = 200;
const PAGE_SIZES = [10, 20];

function positiveInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function adminReviewListQuery(query = {}) {
  const askedForPage = query.page !== undefined && query.page !== "";
  if (!askedForPage) {
    const requested = positiveInt(query.limit);
    return {
      paginated: false,
      limit: Math.min(LEGACY_MAX, requested || LEGACY_DEFAULT),
    };
  }

  const limit = positiveInt(query.limit);
  if (!PAGE_SIZES.includes(limit)) {
    return { error: "El tamaño de página debe ser 10 o 20", status: 400 };
  }
  const page = positiveInt(query.page);
  if (!page) {
    return { error: "La página no es válida", status: 400 };
  }
  return { paginated: true, page, limit };
}

module.exports = { adminReviewListQuery, PAGE_SIZES };
