import "@/styles/layouts/admin-layout.css";
import "@/styles/pages/admin-orders.css";
import "@/styles/components/auth-form.css";
import "@/styles/layouts/admin-premium.css";
import "@/styles/layouts/admin-polish.css";
import "@/styles/layouts/admin-buttons.css";
import "@/styles/layouts/admin-controls.css";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function VendedorLayout({ children }) {
  return children;
}
