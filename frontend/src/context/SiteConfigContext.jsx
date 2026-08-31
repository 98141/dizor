"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SITE_NAME } from "@/lib/fetchAppearance";

const SiteConfigContext = createContext({
  siteName: DEFAULT_SITE_NAME,
  logoUrl: "",
});

export function SiteConfigProvider({ siteName, logoUrl = "", children }) {
  return (
    <SiteConfigContext.Provider value={{ siteName, logoUrl }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
