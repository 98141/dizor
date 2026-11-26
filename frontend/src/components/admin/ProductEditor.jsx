"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProductForm from "./ProductForm";
import AdminConfirmModal from "./AdminConfirmModal";
import ProductDescription from "@/components/products/ProductDescription";
import { catalogReturn } from "@/lib/catalogWorkspace";

// Sprint 09: the shared editor receives the real description renderer (same component as the
// product page) and the admin confirmation dialog. ProductForm itself keeps minimal imports.
const previewDescription = (text, shortDescription) => <ProductDescription text={text} shortDescription={shortDescription} />;
function Editor(props) {
  const params = useSearchParams();
  return <ProductForm {...props} returnTo={catalogReturn(params.get("returnTo"))} initialSection={params.get("section") || "general"}
    ConfirmModal={AdminConfirmModal} renderDescriptionPreview={previewDescription} />;
}
export default function ProductEditor(props) { return <Suspense fallback={<p role="status">Cargando producto…</p>}><Editor {...props} /></Suspense>; }
