"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { createSpecialRequest } from "@/services/specialRequestService";
import { getProductBySlug } from "@/services/productService";

function PersonalizarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const productSlug = searchParams.get("producto");

  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    quantity: 1,
    variantSummary: "",
    customizationDetails: "",
    customerNotes: "",
    selectedOptions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm((p) => ({
        ...p,
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!productSlug) return;
    getProductBySlug(productSlug)
      .then((res) => setProduct(res.product))
      .catch(() => setProduct(null));
  }, [productSlug]);

  const toggleOption = (opt) => {
    setForm((p) => {
      const has = p.selectedOptions.includes(opt);
      return {
        ...p,
        selectedOptions: has
          ? p.selectedOptions.filter((o) => o !== opt)
          : [...p.selectedOptions, opt],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await createSpecialRequest({
        type: "customization",
        name: form.name,
        email: form.email,
        phone: form.phone,
        quantity: form.quantity,
        variantSummary: form.variantSummary,
        customizationDetails: form.customizationDetails,
        customerNotes: form.customerNotes,
        selectedOptions: form.selectedOptions,
        productId: product?.id,
        productName: product?.name,
        productSlug: product?.slug,
      });
      router.push(
        `/solicitud/confirmacion?ref=${data.request.requestNumber}&tipo=customization`
      );
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const options = product?.customizationOptions?.length
    ? product.customizationOptions
    : ["Bordado", "Cinta personalizada", "Color especial", "Otro"];

  return (
    <div className="special-page">
      <h1 className="special-page__title">Solicitar personalización</h1>
      <p className="special-page__intro">
        Cuéntanos cómo quieres tu sombrero artesanal. Te contactaremos con una
        cotización y tiempos de elaboración.
      </p>

      <div className="special-form-card">
        {product && (
          <div className="special-product-ref">
            <strong>Producto base:</strong> {product.name}
            <br />
            <Link href={`/producto/${encodeURIComponent(product.slug)}`}>
              Ver ficha
            </Link>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Tus datos</h2>
          <AuthFormField
            label="Nombre"
            name="name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <AuthFormField
            label="Correo"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <AuthFormField
            label="Teléfono / WhatsApp"
            name="phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />

          <h2>Detalle del pedido</h2>
          <AuthFormField
            label="Cantidad"
            name="quantity"
            type="number"
            value={form.quantity}
            onChange={(e) =>
              setForm((p) => ({ ...p, quantity: e.target.value }))
            }
            required
          />
          <AuthFormField
            label="Talla / color (si aplica)"
            name="variantSummary"
            value={form.variantSummary}
            onChange={(e) =>
              setForm((p) => ({ ...p, variantSummary: e.target.value }))
            }
            placeholder="Ej. Talla M, color natural"
          />

          {options.length > 0 && (
            <div className="special-options">
              <span className="auth-field__label">Opciones de interés</span>
              {options.map((opt) => (
                <label key={opt}>
                  <input
                    type="checkbox"
                    checked={form.selectedOptions.includes(opt)}
                    onChange={() => toggleOption(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="customizationDetails">
              Describe tu personalización *
            </label>
            <textarea
              id="customizationDetails"
              className="auth-field__input"
              rows={5}
              value={form.customizationDetails}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  customizationDetails: e.target.value,
                }))
              }
              required
              placeholder="Colores, bordado, iniciales, referencias..."
            />
          </div>

          <AuthFormField
            label="Notas adicionales"
            name="customerNotes"
            value={form.customerNotes}
            onChange={(e) =>
              setForm((p) => ({ ...p, customerNotes: e.target.value }))
            }
          />

          <AuthErrorAlert message={error} />
          <AuthSubmitButton loading={loading}>Enviar solicitud</AuthSubmitButton>
        </form>
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        <Link href="/pedido-mayor">¿Necesitas pedido al por mayor?</Link>
      </p>
    </div>
  );
}

export default function PersonalizarPage() {
  return (
    <Suspense fallback={<p className="auth-loading">Cargando…</p>}>
      <PersonalizarForm />
    </Suspense>
  );
}
