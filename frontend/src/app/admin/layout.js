import "@/styles/layouts/admin-layout.css";
import "@/styles/pages/admin-cms.css";
import "@/styles/pages/admin-products.css";
import "@/styles/pages/admin-orders.css";
import "@/styles/pages/admin-marketing.css";
import "@/styles/pages/admin-dashboard.css";
import "@/styles/pages/admin-finanzas.css";
import "@/styles/pages/admin-alertas.css";
import "@/styles/components/auth-form.css";
import "@/styles/components/auth-card.css";
import "@/styles/pages/special-requests.css";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
