"use client";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import CatalogWorkspace from "@/components/admin/CatalogWorkspace";
export default function AdminProductosPage(){return <RoleRoute allowedRoles={["superadmin","admin","vendedor"]}><AdminShell variant="admin"><CatalogWorkspace /></AdminShell></RoleRoute>;}
