import Link from "next/link";
export default function CommunicationAlerts({ alerts }) {
  if (!alerts?.count) return null;
  return <section className="order-detail-card" aria-labelledby="communication-alerts-title">
    <h2 id="communication-alerts-title">Comunicaciones por revisar ({alerts.count})</h2>
    <p>Los errores de correo no cambian los pagos ni el inventario. Consulta el pedido para revisar su historial o solicitar un reintento.</p>
    <ul>{alerts.items.map((item) => <li key={item.id}>
      <Link href={`/admin/pedidos/${item.orderId}`}>{item.orderNumber || "Ver pedido"}</Link>{" · "}{item.message}{item.count > 1 ? ` (${item.count})` : ""}
    </li>)}</ul>
  </section>;
}
