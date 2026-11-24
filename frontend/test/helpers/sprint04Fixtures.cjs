"use strict";
// Fictitious data for Sprint 04 (Atención al cliente). Only types, statuses, categories and
// fields that exist in backend/src/models/specialRequest.js and customerRequest.js are used.
const NOW = Date.parse("2026-11-24T15:30:00-05:00"), H = 3600000, D = 24 * H;
const at = (ms) => new Date(NOW - ms).toISOString();
const LONG_DETAILS = "Necesitamos 12 sombreros aguadeños para el personal de recepción del hotel. Cada sombrero debe llevar las iniciales del colaborador grabadas en la cinta interior y una cinta exterior en cuero café oscuro.\n\nLas tallas se distribuyen así: 4 en talla S, 5 en talla M y 3 en talla L. Si alguna talla no está disponible, preferimos que nos avisen antes de iniciar la producción para ajustar la distribución.\n\nTambién nos interesa saber si es posible incluir una caja individual con el logotipo del hotel, aunque no es indispensable para esta primera entrega.";
const WHOLESALE = "Bolsos tejidos en iraca para tienda de artesanías: 80 unidades del modelo Sandoná en colores naturales y 70 carteras de mano en tonos tierra. Buscamos precio por volumen y condiciones de pago a 30 días. Requerimos factura electrónica y empaque individual en bolsa de tela.";
let seq = 0;
const sr = (over) => {
  seq += 1;
  return { id: `sr${seq}`, _id: `sr${seq}`, requestNumber: `SOL-20261124-${String(seq).padStart(4, "0")}`, type: "customization", status: "pendiente",
    contact: { name: "Cliente ficticio", email: "cliente@example.test", phone: "3001234567", company: "" },
    productName: "", productSlug: "", variantSummary: "", quantity: 1, customizationDetails: "", selectedOptions: [], productsDescription: "",
    estimatedQuantity: null, estimatedBudget: null, deliveryDepartment: "", desiredTimeline: "", customerNotes: "", adminNotes: "",
    quotedAmount: null, quotedCurrency: "COP", quotedAt: null, statusHistory: [], createdAt: at(seq * 7 * H), updatedAt: at(seq * 6 * H), ...over };
};
const specialRequests = () => { seq = 0; return [
  sr({ status: "pendiente", productName: "Sombrero Aguadeño clásico", variantSummary: "Talla M · Natural", quantity: 12, customizationDetails: LONG_DETAILS,
    selectedOptions: ["Grabado de iniciales", "Cinta en cuero"], customerNotes: "Por favor confirmar tiempos antes del viernes.",
    contact: { name: "María Fernanda de los Ángeles Ortiz Benavides", email: "maria.fernanda.ortiz.benavides.compras@hotel-casa-colonial-ejemplo.test", phone: "3104567890", company: "Hotel Boutique Casa Colonial de Pasto S.A.S." } }),
  sr({ type: "wholesale", status: "en_revision", productsDescription: WHOLESALE, estimatedQuantity: 150, estimatedBudget: 18000000, deliveryDepartment: "Nariño", desiredTimeline: "Antes del 15 de diciembre",
    contact: { name: "Tienda Artesanías del Sur", email: "pedidos@artesanias-sur.test", phone: "3209876543", company: "Artesanías del Sur" },
    statusHistory: [{ status: "en_revision", note: "Se solicitó disponibilidad al taller de Sandoná.", changedAt: at(20 * H) }] }),
  sr({ status: "cotizado", productName: "Sombrero Panamá fino", quantity: 3, customizationDetails: "Tres sombreros con cinta negra y bordado de la palabra «Boda».", quotedAmount: 1260000, quotedAt: at(30 * H), adminNotes: "Precio con 10 % de descuento autorizado por gerencia.",
    contact: { name: "Andrés Felipe Guerrero", email: "andres.guerrero@example.test", phone: "3001112233", company: "" },
    statusHistory: [{ status: "en_revision", note: "", changedAt: at(50 * H) }, { status: "cotizado", note: "Cotización enviada al cliente", changedAt: at(30 * H) }] }),
  sr({ type: "wholesale", status: "aprobado", productsDescription: "60 llaveros mini sombrero para recordatorios de evento corporativo.", estimatedQuantity: 60, quotedAmount: 840000,
    contact: { name: "Laura Valentina Benavides", email: "laura@example.test", phone: "3015556677", company: "Eventos Galeras" },
    statusHistory: [{ status: "cotizado", note: "", changedAt: at(80 * H) }, { status: "aprobado", note: "Cliente aceptó por WhatsApp; pendiente anticipo.", changedAt: at(60 * H) }] }),
  sr({ status: "completado", productName: "Sombrero vueltiao fino 21 vueltas", quantity: 1, customizationDetails: "Talla 58 con iniciales J.C.R.", quotedAmount: 420000,
    contact: { name: "Juan Camilo Rosero", email: "jc.rosero@example.test", phone: "3029998877", company: "" },
    statusHistory: [{ status: "en_revision", note: "", changedAt: at(240 * H) }, { status: "cotizado", note: "", changedAt: at(200 * H) }, { status: "aprobado", note: "", changedAt: at(150 * H) }, { status: "completado", note: "Entregado en tienda física.", changedAt: at(100 * H) }] }),
  sr({ type: "wholesale", status: "rechazado", productsDescription: "300 sombreros en 10 días.", estimatedQuantity: 300,
    contact: { name: "Distribuidora Andina", email: "compras@andina.test", phone: "3041231234", company: "Distribuidora Andina Ltda." },
    statusHistory: [{ status: "rechazado", note: "Capacidad de producción insuficiente para el plazo.", changedAt: at(90 * H) }] }),
  sr({ status: "cancelado", productName: "Cartera de mano en iraca", quantity: 2, customizationDetails: "Color vino tinto.", contact: { name: "Daniela Cabrera", email: "dcabrera@example.test", phone: "3057778899", company: "" },
    statusHistory: [{ status: "cancelado", note: "El cliente desistió.", changedAt: at(110 * H) }] }),
  // Optional data absent: no product, no company, no notes, no history.
  sr({ status: "pendiente", customizationDetails: "Quiero un sombrero para mi papá, talla 57.", contact: { name: "Santiago Insuasty", email: "s.insuasty@example.test", phone: "3060001122", company: "" } }),
  ...Array.from({ length: 10 }, (_, i) => sr({ type: i % 2 ? "wholesale" : "customization", status: ["pendiente", "en_revision", "cotizado", "completado"][i % 4],
    productName: i % 2 ? "" : "Sombrero playero ala ancha", estimatedQuantity: i % 2 ? 20 + i * 5 : null, quantity: i % 2 ? 1 : 2,
    customizationDetails: i % 2 ? "" : "Cinta de color a convenir.", productsDescription: i % 2 ? "Mezcla de sombreros y bolsos para temporada." : "",
    contact: { name: `Cliente ficticio ${i + 1}`, email: `cliente${i + 1}@example.test`, phone: "3000000000", company: "" } })),
]; };

const LONG_PQR = "Compré un sombrero aguadeño talla M el 3 de noviembre y llegó con la cinta despegada en uno de los lados. ".repeat(12) + "Solicito el cambio del producto o la devolución del dinero.";
let pq = 0;
const pqr = (over) => { pq += 1; return { id: `pqr${pq}`, radicado: `PQR-20261124-${String(pq).padStart(4, "0")}`, category: "consumo", type: "peticion", status: "recibida",
  receivedAt: at(pq * 9 * H), contact: { name: "Persona ficticia", email: "persona@example.test", phone: "" }, orderNumber: "", description: "Consulta de prueba.", user: null,
  history: [{ status: "recibida", publicNote: "", internalNote: "", changedAt: at(pq * 9 * H) }], updatedAt: at(pq * 8 * H), ...over }; };
const customerRequests = () => { pq = 0; return [
  pqr({ type: "reclamo", status: "en_tramite", description: LONG_PQR, orderNumber: "DIZ-20261103-8F2C1A9B0D3E4F5A6B7C",
    contact: { name: "María Fernanda de los Ángeles Ortiz Benavides", email: "maria.fernanda.ortiz.benavides.compras@hotel-casa-colonial-ejemplo.test", phone: "3104567890" },
    history: [{ status: "recibida", changedAt: at(9 * H) }, { status: "en_tramite", publicNote: "Recibimos su reclamo y estamos verificando el pedido.", internalNote: "Revisar fotos con bodega.", changedAt: at(4 * H) }] }),
  pqr({ category: "datos_personales", type: "supresion", status: "recibida", description: "Solicito suprimir mis datos personales de sus bases de datos de marketing y no recibir más comunicaciones.", contact: { name: "Andrés Felipe Guerrero", email: "andres.guerrero@example.test", phone: "" } }),
  pqr({ type: "peticion", status: "respondida", description: "¿Hacen envíos a Leticia, Amazonas?", history: [{ status: "recibida", changedAt: at(40 * H) }, { status: "respondida", publicNote: "Sí, con un tiempo estimado de 8 a 12 días hábiles.", internalNote: "", changedAt: at(20 * H) }] }),
  pqr({ type: "queja", status: "cerrada", description: "La atención por WhatsApp tardó dos días en responder.", history: [{ status: "recibida", changedAt: at(90 * H) }, { status: "en_tramite", changedAt: at(70 * H) }, { status: "cerrada", publicNote: "Ofrecimos disculpas y ajustamos los turnos de atención.", internalNote: "Caso cerrado por gerencia.", changedAt: at(50 * H) }] }),
  pqr({ category: "datos_personales", type: "rectificacion", status: "en_tramite", description: "Mi número de teléfono registrado es incorrecto; el correcto termina en 4521." }),
  pqr({ category: "datos_personales", type: "consulta", status: "cerrada", description: "Quiero saber qué datos personales tienen registrados." }),
  pqr({ category: "datos_personales", type: "revocatoria", status: "recibida", description: "Revoco la autorización para recibir publicidad por correo." }),
  pqr({ category: "datos_personales", type: "actualizacion", status: "respondida", description: "Actualizar mi dirección de entrega." }),
]; };
module.exports = { NOW, specialRequests, customerRequests };
