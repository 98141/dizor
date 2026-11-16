import { isAnalyticsConfigured } from "@/lib/analytics/config";

// Inventario de tecnologías OPCIONALES (no necesarias para prestar el
// servicio pedido). El banner, el panel de preferencias y la política de
// cookies se derivan de esta lista, no de la presencia de un proveedor
// concreto (H-09 revisado).
//
// - `active`: la tecnología existe y está funcionando en este despliegue.
// - Si ninguna categoría está activa, no hay nada que aceptar o rechazar.
//
// Clasificar el contador de visitas como opcional es una decisión
// CONSERVADORA: guarda una cookie y una clave en el dispositivo que no son
// necesarias para comprar. Su calificación jurídica está pendiente de
// revisión (ver 05-borradores-legales-internos.md §4).
export function getOptionalCategories() {
  return [
    {
      id: "statistics",
      title: "Estadísticas propias",
      description:
        "Contador de visitas del pie de página: guarda solo la fecha de tu última visita para contarla una vez al día. No usa servicios de terceros.",
      active: true,
    },
    {
      id: "analytics",
      title: "Analíticas (Google Analytics)",
      description:
        "Medirían cómo se usa el sitio (páginas vistas, productos populares) mediante Google Analytics.",
      active: isAnalyticsConfigured(),
      inactiveNote: "Actualmente no utilizamos cookies analíticas.",
    },
    {
      id: "marketing",
      title: "Marketing",
      description: "Para anuncios personalizados y remarketing.",
      active: false,
      inactiveNote: "No utilizamos cookies de marketing.",
    },
  ];
}

export function hasActiveOptionalCategory() {
  return getOptionalCategories().some((c) => c.active);
}

export function isCategoryActive(id) {
  return getOptionalCategories().some((c) => c.id === id && c.active);
}
