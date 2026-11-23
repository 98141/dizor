import { findMunicipality } from "./municipalities";

// El orden de las claves coincide con el orden visual y de foco del formulario.
export function validateCheckout({ buyer, shipping, paymentMethod, methods, municipalities, privacyAuthorization, termsAccepted }) {
  const errors = {};
  if (!buyer.name.trim()) errors.name = "Ingresa tu nombre completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) errors.email = "Ingresa un correo electrónico válido.";
  const phone = buyer.phone.replace(/[\s()+.-]/g, "");
  if (!/^(57)?\d{10}$/.test(phone)) errors.phone = "Ingresa un teléfono de Colombia de 10 dígitos (puedes incluir +57).";
  if (!shipping.address.trim()) errors.address = "Ingresa la dirección de entrega.";
  if (!findMunicipality(municipalities, shipping.city, shipping.department)) errors.municipality = "Selecciona una ciudad o municipio de la lista";
  if (!methods.some((method) => method.id === paymentMethod)) errors.payment = "Selecciona un medio de pago disponible.";
  if (!privacyAuthorization) errors["consent-order_processing"] = "Autoriza el tratamiento de datos para gestionar tu pedido.";
  if (!termsAccepted) errors["consent-terms"] = "Acepta los términos y condiciones para comprar.";
  return errors;
}
