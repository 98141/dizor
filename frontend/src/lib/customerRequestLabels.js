export const CATEGORY_LABELS = {
  consumo: "Petición, queja o reclamo sobre una compra",
  datos_personales: "Solicitud sobre mis datos personales",
};

export const TYPE_LABELS = {
  peticion: "Petición",
  queja: "Queja",
  reclamo: "Reclamo",
  consulta: "Consultar mis datos",
  actualizacion: "Actualizar mis datos",
  rectificacion: "Corregir mis datos",
  supresion: "Suprimir mis datos",
  revocatoria: "Revocar una autorización",
};

export const STATUS_LABELS = {
  recibida: "Recibida",
  en_tramite: "En trámite",
  respondida: "Respondida",
  cerrada: "Cerrada",
};

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota" })
    : "";
