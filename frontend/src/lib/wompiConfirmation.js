// Capture before the confirmation page removes the provider's URL parameters.
// This ID is only a lookup hint; approval always comes from the backend.
export function wompiReturnId(params) {
  const id = params.get("id");
  return params.get("payment") === "wompi" && typeof id === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(id) ? id : "";
}

export function createConfirmationLoader({ orderNumber, accessToken, transactionId, verify, lookup }) {
  let verifyReturn = Boolean(transactionId);
  return async () => {
    if (verifyReturn) {
      try {
        const data = await verify(orderNumber, accessToken, transactionId);
        verifyReturn = data.order.paymentStatus === "pendiente";
        return data;
      } catch (err) {
        // An unavailable provider must not hide the registered order or imply
        // approval. Keep retrying temporary failures within the page's budget.
        if ([400, 403, 404, 409, 429].includes(err.response?.status)) verifyReturn = false;
      }
    }
    return lookup(orderNumber, accessToken);
  };
}
