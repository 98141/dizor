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

  const items = (announcement?.items || []).filter((item) =>
    item?.text?.trim()
  );

  if (!announcement?.isActive || items.length === 0) {
    return null;
  }

  const rotating = items.length > 1;

  return (
    <div className="site-announcement" role="region" aria-label="Avisos">
      <div
        className={`site-announcement__track${
          rotating ? " site-announcement__track--rotating" : ""
        }`}
        style={{ "--announcement-count": items.length }}
      >
        {items.map((item, i) => {
          const content = (
            <span className="site-announcement__text">{item.text}</span>
          );
          return (
            <div
              key={i}
              className="site-announcement__item"
              style={{ "--announcement-index": i }}
            >
              {item.linkHref ? (
                <Link
                  href={item.linkHref}
                  className="site-announcement__link"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
