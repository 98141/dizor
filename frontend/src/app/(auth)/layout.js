import SiteHeaderServer from "@/components/layout/SiteHeaderServer";
import SiteFooter from "@/components/layout/SiteFooter";
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import CookiePreferencesPanel from "@/components/consent/CookiePreferencesPanel";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <>
      <SiteHeaderServer />
      <main>{children}</main>
      <SiteFooter />
      <CookieConsentBanner />
      <CookiePreferencesPanel />
    </>
  );
}
