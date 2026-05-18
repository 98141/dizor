import Link from "next/link";

export default function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerHref,
}) {
  return (
    <div className="auth-page">
      <div className="auth-page__inner">
        <header className="auth-brand">
          <Link href="/" className="auth-brand__logo">
            Dizor
          </Link>
          <p className="auth-brand__tagline">
            Sombreros artesanales · Sandoná, Nariño
          </p>
        </header>

        <div className="auth-card">
          <h1 className="auth-card__title">{title}</h1>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
          {children}
          {footerText && footerLinkText && footerHref && (
            <p className="auth-card__footer">
              {footerText}{" "}
              <Link href={footerHref}>{footerLinkText}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
