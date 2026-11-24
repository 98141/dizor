"use client";

import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import SpecialRequestsList from "@/components/admin/SpecialRequestsList";
import { AttentionHeader } from "@/components/admin/attention/AttentionUI";

export default function AdminSolicitudesPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin" pageHeader={<AttentionHeader />}>
        <div className="admin-page dz-page cs-page">
          <SpecialRequestsList />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
