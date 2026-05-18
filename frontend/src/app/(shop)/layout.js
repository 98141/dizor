import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteAnnouncement from "@/components/layout/SiteAnnouncement";

export default function ShopLayout({ children }) {
  return (
    <>
      <SiteAnnouncement />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
