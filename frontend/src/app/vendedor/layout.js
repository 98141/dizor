import "@/styles/layouts/admin-layout.css";
import "@/styles/pages/admin-orders.css";
import "@/styles/components/auth-form.css";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function VendedorLayout({ children }) {
  return children;
}
