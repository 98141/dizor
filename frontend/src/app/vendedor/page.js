"use client";

import RoleRoute from "@/guards/RoleRoute";
import { useAuth } from "@/context/AuthContext";

function VendedorDashboard() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>Panel vendedor Dizor</h1>
      <p>Bienvenido: {user.name}</p>
      <p>Rol: {user.role}</p>

      <ul>
        <li>Pedidos asignados</li>
        <li>Pagos manuales</li>
        <li>Solicitudes especiales</li>
        <li>Exportar pedidos</li>
      </ul>

      <button
        type="button"
        onClick={async () => {
          await logout();
          window.location.href = "/login";
        }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}

export default function VendedorPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <VendedorDashboard />
    </RoleRoute>
  );
}