"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { createSpecialRequest } from "@/services/specialRequestService";
import { getCheckoutConfig } from "@/services/checkoutService";
import { trackWholesaleRequest } from "@/lib/analytics/events";

export default function PedidoMayorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [departments, setDepartments] = useState(["Nariño"]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    productsDescription: "",
    estimatedQuantity: 10,
    estimatedBudget: "",
    deliveryDepartment: "Nariño",
    desiredTimeline: "",
    customerNotes: "",
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
    getCheckoutConfig()
      .then((d) => setDepartments(d.config?.departments || ["Nariño"]))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await createSpecialRequest({
        type: "wholesale",
        ...form,
        estimatedBudget:
          form.estimatedBudget === "" ? null : Number(form.estimatedBudget),
      });
      trackWholesaleRequest({
        sourcePage: "pedido-mayor",
        quantityRange: String(form.estimatedQuantity || ""),
      });
      router.push(
        `/solicitud/confirmacion?ref=${data.request.requestNumber}&tipo=wholesale`
      );
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="special-page">
      <h1 className="special-page__title">Pedido al por mayor</h1>
      <p className="special-page__intro">
        Para tiendas, eventos o distribución. Mínimo 5 unidades. Te enviamos
        cotización personalizada según cantidades y referencias.
      </p>

      <div className="special-form-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Contacto</h2>
          <AuthFormField
            label="Nombre o responsable"
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
          <AuthFormField
            label="Empresa (opcional)"
            name="company"
            value={form.company}
            onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
          />

          <h2>Pedido</h2>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="productsDescription">
              Productos y referencias *
            </label>
            <textarea
              id="productsDescription"
              className="auth-field__input"
              rows={4}
              value={form.productsDescription}
              onChange={(e) =>
                setForm((p) => ({ ...p, productsDescription: e.target.value }))
              }
              required
              placeholder="Modelos, tejidos, tallas, colores..."
            />
          </div>
          <AuthFormField
            label="Cantidad estimada (mín. 5)"
            name="estimatedQuantity"
            type="number"
            min="5"
            value={form.estimatedQuantity}
            onChange={(e) =>
              setForm((p) => ({ ...p, estimatedQuantity: e.target.value }))
            }
            required
          />
          <AuthFormField
            label="Presupuesto aproximado COP (opcional)"
            name="estimatedBudget"
            type="number"
            min="0"
            value={form.estimatedBudget}
            onChange={(e) =>
              setForm((p) => ({ ...p, estimatedBudget: e.target.value }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="deliveryDepartment">
              Departamento de entrega
            </label>
            <select
              id="deliveryDepartment"
              name="deliveryDepartment"
              className="auth-field__input"
              value={form.deliveryDepartment}
              onChange={(e) =>
                setForm((p) => ({ ...p, deliveryDepartment: e.target.value }))
              }
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <AuthFormField
            label="Fecha deseada / plazo"
            name="desiredTimeline"
            value={form.desiredTimeline}
            onChange={(e) =>
              setForm((p) => ({ ...p, desiredTimeline: e.target.value }))
            }
            placeholder="Ej. Para marzo 2026"
          />
          <AuthFormField
            label="Notas"
            name="customerNotes"
            value={form.customerNotes}
            onChange={(e) =>
              setForm((p) => ({ ...p, customerNotes: e.target.value }))
            }
          />

          <AuthErrorAlert message={error} />
          <AuthSubmitButton loading={loading}>Solicitar cotización</AuthSubmitButton>
        </form>
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        <Link href="/personalizar">¿Un solo sombrero personalizado?</Link>
      </p>
    </div>
  );
}
