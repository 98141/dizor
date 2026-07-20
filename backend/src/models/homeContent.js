const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    text: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const announcementItemSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, default: "" },
    linkHref: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const homeContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "default",
    },
    hero: {
      brandClaim: {
        type: String,
        trim: true,
        default: "DIZOR",
      },
      title: {
        type: String,
        trim: true,
        default: "Oficio colombiano, piezas que perduran",
      },
      subtitle: {
        type: String,
        trim: true,
        default:
          "Sombreros de palma de iraca tejidos a mano en Sandoná, Nariño. Tradición, elegancia y calidad en cada pieza.",
      },
      ctaLabel: { type: String, trim: true, default: "Ver catálogo" },
      ctaHref: { type: String, trim: true, default: "/catalogo" },
      secondaryCtaLabel: {
        type: String,
        trim: true,
        default: "Conoce nuestra historia",
      },
      secondaryCtaHref: {
        type: String,
        trim: true,
        default: "/pagina/sobre-dizor",
      },
      imageUrl: { type: String, trim: true, default: "" },
    },
    features: {
      type: [featureSchema],
      default: [],
    },
    featuredSection: {
      title: { type: String, trim: true, default: "Destacados" },
      linkLabel: { type: String, trim: true, default: "Ver todos" },
      linkHref: { type: String, trim: true, default: "/catalogo?featured=true" },
    },
    announcement: {
      // legacy, se conservan solo para migrar datos previos a "items"
      text: { type: String, trim: true, default: "" },
      linkHref: { type: String, trim: true, default: "" },
      isActive: { type: Boolean, default: false },
      items: { type: [announcementItemSchema], default: [] },
    },
    newSection: {
      eyebrow: { type: String, trim: true, default: "LO NUEVO" },
      title: { type: String, trim: true, default: "Novedades" },
      subtitle: {
        type: String,
        trim: true,
        default: "Las piezas recién marcadas como nuevas en nuestro catálogo.",
      },
      linkLabel: { type: String, trim: true, default: "Ver novedades" },
      linkHref: { type: String, trim: true, default: "/catalogo?isNew=true" },
      isActive: { type: Boolean, default: true },
    },
    craftSection: {
      eyebrow: { type: String, trim: true, default: "COLECCIÓN" },
      title: { type: String, trim: true, default: "Nuestros tejidos" },
      subtitle: {
        type: String,
        trim: true,
        default:
          "Explora cada línea de Dizor: Brisa, Común y Súper fino — carácter, finura y tiempo de elaboración.",
      },
      linkLabel: { type: String, trim: true, default: "Ver" },
    },
    historia: {
      eyebrow: { type: String, trim: true, default: "ORIGEN" },
      title: {
        type: String,
        trim: true,
        default: "Del páramo a la fibra, de la fibra a la pieza",
      },
      body: {
        type: String,
        trim: true,
        default:
          "Desde las manos de las artesanas de Sandoná, Nariño, nace cada sombrero Dizor. La palma de iraca se corta, se blanquea y se teje con una disciplina que se transmite de generación en generación. Cada puntada es un acto de memoria cultural, una forma de decir que lo hecho a mano tiene valor, permanencia y alma.",
      },
      imageUrl: { type: String, trim: true, default: "" },
      ctaLabel: { type: String, trim: true, default: "Sobre Dizor" },
      ctaHref: { type: String, trim: true, default: "/pagina/sobre-dizor" },
    },
    personalizacion: {
      eyebrow: { type: String, trim: true, default: "A TU MEDIDA" },
      title: {
        type: String,
        trim: true,
        default: "Personaliza tu sombrero",
      },
      body: {
        type: String,
        trim: true,
        default:
          "Iniciales, monogramas, ajustes de horma y detalles que hacen única tu pieza. Te acompañamos por WhatsApp para definir cada detalle.",
      },
      bullets: {
        type: [String],
        default: [
          "Iniciales y monogramas",
          "Ajustes de horma y acabado",
          "Pedidos especiales bajo consulta",
        ],
        validate: {
          validator: (arr) => !arr || arr.length <= 5,
          message: "Máximo 5 bullets",
        },
      },
      ctaLabel: { type: String, trim: true, default: "Personalizar" },
      ctaHref: { type: String, trim: true, default: "/personalizar" },
      whatsappHint: {
        type: String,
        trim: true,
        default: "También puedes escribirnos por WhatsApp",
      },
      imageUrl: { type: String, trim: true, default: "" },
      /** true = imagen izquierda / texto derecha */
      imageOnLeft: { type: Boolean, default: true },
    },
    porMayor: {
      eyebrow: { type: String, trim: true, default: "POR VOLUMEN" },
      title: {
        type: String,
        trim: true,
        default: "Pedidos al por mayor",
      },
      body: {
        type: String,
        trim: true,
        default:
          "Para tiendas, eventos o distribución. Cotizamos según cantidades y referencias, con atención directa desde Dizor.",
      },
      bullets: {
        type: [String],
        default: [
          "Mínimo 5 unidades",
          "Cotización personalizada por referencias",
          "Ideal para tiendas, eventos y distribución",
        ],
        validate: {
          validator: (arr) => !arr || arr.length <= 5,
          message: "Máximo 5 bullets",
        },
      },
      ctaLabel: { type: String, trim: true, default: "Solicitar cotización" },
      ctaHref: { type: String, trim: true, default: "/pedido-mayor" },
      imageUrl: { type: String, trim: true, default: "" },
      imageOnLeft: { type: Boolean, default: true },
    },
    inspiracion: {
      eyebrow: { type: String, trim: true, default: "INSPIRACIÓN" },
      title: {
        type: String,
        trim: true,
        default: "La pieza en la vida real",
      },
      subtitle: {
        type: String,
        trim: true,
        default:
          "Una selección visual del universo Dizor: fotografías curadas del oficio y de nuestras piezas.",
      },
      ctaLabel: {
        type: String,
        trim: true,
        default: "Síguenos en Instagram",
      },
      instagramUrl: {
        type: String,
        trim: true,
        default: "https://www.instagram.com/",
      },
    },
    reseñasSection: {
      eyebrow: { type: String, trim: true, default: "VOCES" },
      title: {
        type: String,
        trim: true,
        default: "Quienes ya eligieron Dizor",
      },
      isActive: { type: Boolean, default: true },
    },
    randomProductsSection: {
      eyebrow: { type: String, trim: true, default: "DESCUBRE" },
      title: {
        type: String,
        trim: true,
        default: "Piezas para explorar hoy",
      },
      subtitle: {
        type: String,
        trim: true,
        default: "Una selección renovada cada día desde nuestro catálogo.",
      },
      isActive: { type: Boolean, default: true },
    },
    newsletterSection: {
      eyebrow: { type: String, trim: true, default: "NOVEDADES" },
      title: {
        type: String,
        trim: true,
        default: "Entérate de las piezas nuevas",
      },
      subtitle: {
        type: String,
        trim: true,
        default:
          "Avisos puntuales de colecciones, personalización y el oficio detrás de cada trama.",
      },
    },
    bestsellerSection: {
      title: { type: String, trim: true, default: "Más vendidos" },
      linkLabel: { type: String, trim: true, default: "Ver todos" },
      linkHref: { type: String, trim: true, default: "/catalogo?sort=popular" },
      isActive: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeContent", homeContentSchema);
