import SiteHeaderServer from "@/components/layout/SiteHeaderServer";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteAnnouncement from "@/components/layout/SiteAnnouncement";
import PromoPopup from "@/components/marketing/PromoPopup";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import CookiePreferencesPanel from "@/components/consent/CookiePreferencesPanel";

export default function ShopLayout({ children }) {
  return (
    <>
      <PromoPopup />
      <SiteAnnouncement />
      <SiteHeaderServer />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppFloatingButton />
      <CookieConsentBanner />
      <CookiePreferencesPanel />
    </>
  );
}
