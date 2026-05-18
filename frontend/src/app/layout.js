import { AuthProvider } from "@/context/AuthContext";
import "@/styles/base/variables.css";
import "@/styles/base/globals.css";
import "@/styles/components/auth-card.css";
import "@/styles/components/auth-form.css";
import "@/styles/pages/cuenta.css";
import "@/styles/layouts/public-header.css";
import "@/styles/layouts/public-footer.css";
import "@/styles/components/product-card.css";
import "@/styles/components/catalog-filters.css";
import "@/styles/pages/home.css";
import "@/styles/pages/producto.css";
import "@/styles/pages/admin-products.css";

export const metadata = {
  title: "Dizor | Sombreros artesanales",
  description: "Sombreros artesanales en palma de iraca de Sandoná, Nariño.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}