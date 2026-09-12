import { Suspense } from "react";
import SiteHeaderServer from "@/components/layout/SiteHeaderServer";
import SiteFooter from "@/components/layout/SiteFooter";
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import CookiePreferencesPanel from "@/components/consent/CookiePreferencesPanel";

import "@/styles/layouts/public-header.css";
import "@/styles/layouts/public-footer.css";
import "@/styles/components/auth-card.css";
import "@/styles/components/auth-form.css";
import "@/styles/pages/cuenta.css";
import "@/styles/components/cookie-consent.css";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <>
      <SiteHeaderServer />
      <main>{children}</main>
      <Suspense
        fallback={
          <footer className="site-footer" aria-hidden="true" style={{ minHeight: 220 }} />
        }
      >
        <SiteFooter />
      </Suspense>
      <CookieConsentBanner />
      <CookiePreferencesPanel />
    </>
  );
}
