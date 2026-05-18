"use client";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/guards/ProtectedRoute";

function CuentaContent() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>Mi cuenta</h1>

      <p>Nombre: {user.name}</p>
      <p>Correo: {user.email}</p>
      <p>Rol: {user.role}</p>

      <button onClick={logout}>Cerrar sesión</button>
    </main>
  );
}

export default function CuentaPage() {
  return (
    <ProtectedRoute>
      <CuentaContent />
    </ProtectedRoute>
  );
}