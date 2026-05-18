import { AuthProvider } from "@/context/AuthContext";
import "@/styles/base/globals.css";

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