"use client";
// Atención al cliente (Sprint 04): shared header and status presentation. Labels come from the
// existing label maps; tones only add visual weight (the text always states the status).
import { useAuth } from "@/context/AuthContext";
import { HiOutlineShieldCheck } from "react-icons/hi2";
import { StatusChip } from "@/components/admin/dashboard/DashboardUI";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/specialRequestLabels";
import { STATUS_LABELS as PQR_STATUS_LABELS } from "@/lib/customerRequestLabels";

const REQUEST_TONES = { pendiente: "warning", en_revision: "info", cotizado: "accent", aprobado: "success", completado: "success", rechazado: "danger", cancelado: "muted" };
const PQR_TONES = { recibida: "warning", en_tramite: "info", respondida: "success", cerrada: "muted" };

/** Page header shown above the section tabs. Sellers only manage requests, so their title says so. */
export function AttentionHeader() {
  const { user } = useAuth();
  const vendor = user?.role === "vendedor";
  return <header className="dz-page cs-head">
    <h1>{vendor ? "Solicitudes especiales" : "Atención al cliente"}</h1>
    <p className="dz-lead">{vendor ? "Personalizaciones y pedidos al por mayor de tus clientes." : "Gestiona solicitudes, personalizaciones y consultas de tus clientes."}</p>
  </header>;
}

export const RequestStatusChip = ({ status }) => <StatusChip tone={REQUEST_TONES[status] || "neutral"}>{REQUEST_STATUS_LABELS[status] || status}</StatusChip>;
export const RequestTypeChip = ({ type }) => <StatusChip tone="neutral">{REQUEST_TYPE_LABELS[type] || type}</StatusChip>;
export const PqrStatusChip = ({ status }) => <StatusChip tone={PQR_TONES[status] || "neutral"}>{PQR_STATUS_LABELS[status] || status}</StatusChip>;
/** Personal-data requests keep a distinct, labelled treatment (not colour alone). */
export const PqrCategoryChip = ({ category }) => category === "datos_personales"
  ? <span className="dz-chip dz-chip--review cs-chip-data"><HiOutlineShieldCheck aria-hidden="true" />Datos personales</span>
  : <StatusChip tone="neutral">Consumo</StatusChip>;

const dateTime = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
export const formatWhen = (value, withTime = true) => value ? (withTime ? dateTime : dateOnly).format(new Date(value)).replace(/\./g, "") : "Sin fecha";
