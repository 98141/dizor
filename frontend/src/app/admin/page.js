"use client";

import RoleRoute from "@/guards/RoleRoute";
import { useAuth } from "@/context/AuthContext";

function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>Panel administrativo Dizor</h1>
      <p>Bienvenido: {user.name}</p>
      <p>Rol: {user.role}</p>

      <ul>
        <li>Productos</li>
        <li>Pedidos</li>
        <li>Clientes</li>
        <li>Inventario</li>
        <li>Reportes</li>
        <li>Configuración</li>
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

export default function AdminPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminDashboard />
    </RoleRoute>
  );
}