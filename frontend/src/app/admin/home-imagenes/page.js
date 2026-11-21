import { redirect } from "next/navigation";
import { contentHref } from "@/lib/adminNavigation.mjs";
export default async function LegacyPage({ searchParams }) {
  const raw = await searchParams || {}, params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  redirect(contentHref("imagenes", params.toString()));
}
