import { Suspense } from "react";
import SiteHeaderServer from "@/components/layout/SiteHeaderServer";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteAnnouncement from "@/components/layout/SiteAnnouncement";
import PromoPopup from "@/components/marketing/PromoPopup";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import CookiePreferencesPanel from "@/components/consent/CookiePreferencesPanel";

import "@/styles/layouts/public-header.css";
import "@/styles/layouts/public-footer.css";
import "@/styles/layouts/site-announcement.css";
import "@/styles/components/product-card.css";
import "@/styles/components/catalog-filters.css";
import "@/styles/components/marketing.css";
import "@/styles/components/cookie-consent.css";
import "@/styles/pages/special-requests.css";
import "@/styles/components/auth-form.css";

export default function ShopLayout({ children }) {
  return (
    <>
      <PromoPopup />
      <SiteAnnouncement />
      <SiteHeaderServer />
      <main>{children}</main>
      <Suspense
        fallback={
          <footer className="site-footer" aria-hidden="true" style={{ minHeight: 220 }} />
        }
      >
        <SiteFooter />
      </Suspense>
      <WhatsAppFloatingButton />
      <CookieConsentBanner />
      <CookiePreferencesPanel />
    </>
  );
}
