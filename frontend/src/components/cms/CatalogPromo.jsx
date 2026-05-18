"use client";

import { useEffect, useState } from "react";
import PromoBanner from "./PromoBanner";

export default function CatalogPromo() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    fetch(`${base}/content/banners?placement=catalog_top`)
      .then((r) => r.json())
      .then((d) => setBanner(d.banners?.[0] || null))
      .catch(() => setBanner(null));
  }, []);

  if (!banner) return null;

  return <PromoBanner banner={banner} />;
}
