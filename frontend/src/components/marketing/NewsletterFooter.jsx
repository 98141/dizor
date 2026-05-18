"use client";

import { useEffect, useState } from "react";
import { getMarketingConfig } from "@/services/marketingService";
import NewsletterSignup from "./NewsletterSignup";

export default function NewsletterFooter() {
  const [newsletter, setNewsletter] = useState(null);

  useEffect(() => {
    getMarketingConfig()
      .then((d) => setNewsletter(d.config?.newsletter))
      .catch(() => setNewsletter(null));
  }, []);

  return (
    <NewsletterSignup
      title={newsletter?.footerTitle || "Newsletter Dizor"}
      description={newsletter?.footerText || "Recibe lanzamientos y ofertas."}
      successMessage={newsletter?.successMessage}
      source="footer"
    />
  );
}
