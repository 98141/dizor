"use client";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import CatalogWorkspace from "@/components/admin/CatalogWorkspace";
export default function InventarioPage(){return <RoleRoute allowedRoles={["superadmin","admin"]}><AdminShell variant="admin"><CatalogWorkspace initialView="movements" /></AdminShell></RoleRoute>;}
