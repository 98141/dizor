import { getLegalEffectiveDate } from "@/lib/businessInfo";

/**
 * Versión del documento y, solo si se definió al publicar
 * (NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE), su fecha de entrada en vigor.
 * Nunca se muestra una fecha de edición local como fecha de vigencia.
 */
export default function LegalDocMeta({ version }) {
  const effective = getLegalEffectiveDate();
  return (
    <p className="content-page__body-p legal-doc-meta">
      Versión {version}
      {effective ? ` · Vigente desde el ${effective}` : ""}
    </p>
  );
}
