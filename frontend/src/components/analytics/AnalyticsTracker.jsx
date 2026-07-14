"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { GA_MEASUREMENT_ID, isAnalyticsConfigured } from "@/lib/analytics/config";
import { useAnalyticsConsent } from "@/lib/analytics/consent";
import {
  initConsentDefaults,
  initGtag,
  trackPageView,
  updateConsentSignal,
} from "@/lib/analytics/events";
import { sanitizePageView } from "@/lib/analytics/urlSanitizer";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sanitized = sanitizePageView(pathname, searchParams);
    if (!sanitized) return;
    trackPageView({
      pagePath: sanitized,
      pageTitle: typeof document !== "undefined" ? document.title : undefined,
    });
  }, [pathname, searchParams]);

  return null;
}

function GtagBootstrap() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initGtag();
  }, []);

  return null;
}

// Google Consent Mode v2 (Sprint 4): establece la señal "default: denied"
// apenas la app monta —solo local, no carga ningún script remoto— y la
// actualiza cada vez que cambia el consentimiento otorgado por el usuario.
// Se monta siempre que haya un ID configurado, independientemente de si ya
// hay consentimiento o no (por eso vive fuera del guard de más abajo).
function ConsentModeSync({ consentGranted }) {
  useEffect(() => {
    initConsentDefaults();
  }, []);

  useEffect(() => {
    updateConsentSignal(consentGranted);
  }, [consentGranted]);

  return null;
}

// Componente central de analítica, montado una sola vez en el root layout.
// No renderiza nada visible. El script remoto de GA4 y el tracking de
// page_view solo se activan cuando hay un ID de GA4 configurado Y
// consentimiento otorgado (ver lib/analytics/consent.js) — mientras el
// banner del Sprint 4 no registre una decisión, el consentimiento por
// defecto es denegado y esa parte permanece inactiva.
export default function AnalyticsTracker() {
  const consentGranted = useAnalyticsConsent();

  if (!isAnalyticsConfigured()) return null;

  return (
    <>
      <ConsentModeSync consentGranted={consentGranted} />
      {consentGranted && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <GtagBootstrap />
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
        </>
      )}
    </>
  );
}
