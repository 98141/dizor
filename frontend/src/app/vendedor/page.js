"use client";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AdminDashboard from "@/components/admin/AdminDashboard";
export default function VendedorPage() {
  return <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}><AdminShell variant="vendedor"><div className="admin-page"><AdminDashboard vendor /></div></AdminShell></RoleRoute>;
}
