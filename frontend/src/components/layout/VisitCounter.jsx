"use client";

import { useEffect, useState } from "react";
import { registerVisit } from "@/services/visitService";
import { usePreferences } from "@/lib/consentPreferences";

const STORAGE_KEY = "dizor_last_visit_day";
const numberFormatter = new Intl.NumberFormat("es-CO");

// Muestra el total agregado de visitas (sin almacenamiento) y solo registra
// la visita —cookie de la API + clave local— si el visitante aceptó las
// "estadísticas propias". Sin permiso no hay petición ni almacenamiento.
export default function VisitCounter({ initialTotal = 0 }) {
  const [total, setTotal] = useState(initialTotal);
  const preferences = usePreferences();
  const statisticsAllowed = Boolean(preferences?.statistics);

  useEffect(() => {
    if (!statisticsAllowed) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = window.localStorage.getItem(STORAGE_KEY);

    if (lastVisit === today) return;

    registerVisit()
      .then((data) => {
        window.localStorage.setItem(STORAGE_KEY, today);
        if (typeof data?.total === "number") setTotal(data.total);
      })
      .catch(() => {});
  }, [statisticsAllowed]);

  return (
    <p className="site-footer__visits">
      {numberFormatter.format(total)} visitas
    </p>
  );
}
