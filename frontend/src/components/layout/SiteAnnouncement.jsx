import Link from "next/link";
import { getHomeContent } from "@/services/cmsService";

export default async function SiteAnnouncement() {
  let announcement = null;

  try {
    const data = await getHomeContent();
    announcement = data.home?.announcement;
  } catch {
    announcement = null;
  }

  if (!announcement?.isActive || !announcement.text?.trim()) {
    return null;
  }

  const content = (
    <span className="site-announcement__text">{announcement.text}</span>
  );

  return (
    <div className="site-announcement" role="region" aria-label="Aviso">
      {announcement.linkHref ? (
        <Link href={announcement.linkHref} className="site-announcement__link">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
