import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import CookiePreferencesPanel from "@/components/consent/CookiePreferencesPanel";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <CookieConsentBanner />
      <CookiePreferencesPanel />
    </>
  );
}
