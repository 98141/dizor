"use client";

import { useEffect, useState } from "react";
import { registerVisit } from "@/services/visitService";

const STORAGE_KEY = "dizor_last_visit_day";
const numberFormatter = new Intl.NumberFormat("es-CO");

export default function VisitCounter({ initialTotal = 0 }) {
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = window.localStorage.getItem(STORAGE_KEY);

    if (lastVisit === today) return;

    registerVisit()
      .then((data) => {
        window.localStorage.setItem(STORAGE_KEY, today);
        if (typeof data?.total === "number") setTotal(data.total);
      })
      .catch(() => {});
  }, []);

  return (
    <p className="site-footer__visits">
      {numberFormatter.format(total)} visitas
    </p>
  );
}
