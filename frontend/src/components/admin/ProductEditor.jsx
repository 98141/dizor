"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProductForm from "./ProductForm";
import { catalogReturn } from "@/lib/catalogWorkspace";
function Editor(props) { const params = useSearchParams(); return <ProductForm {...props} returnTo={catalogReturn(params.get("returnTo"))} />; }
export default function ProductEditor(props) { return <Suspense fallback={<p role="status">Cargando producto…</p>}><Editor {...props} /></Suspense>; }
