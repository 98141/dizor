import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteAnnouncement from "@/components/layout/SiteAnnouncement";
import PromoPopup from "@/components/marketing/PromoPopup";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";

export default function ShopLayout({ children }) {
  return (
    <>
      <PromoPopup />
      <SiteAnnouncement />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppFloatingButton />
    </>
  );
}
