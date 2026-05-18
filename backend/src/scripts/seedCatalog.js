require("dotenv").config();

const connectDB = require("../config/db");
const Category = require("../models/category");
const Color = require("../models/color");
const Size = require("../models/size");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const Product = require("../models/product");

const upsertMany = async (Model, items, key = "name") => {
  const results = [];
  for (const item of items) {
    const doc = await Model.findOneAndUpdate(
      { [key]: item[key] },
      item,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(doc);
  }
  return results;
};

const seedCatalog = async () => {
  try {
    await connectDB();

    const weaveTypes = await upsertMany(WeaveType, [
      { name: "Brisa", description: "Tejido ligero y fresco", sortOrder: 1 },
      { name: "Común", description: "Tejido tradicional", sortOrder: 2 },
      {
        name: "Súper fino",
        description: "Tejido premium de alta densidad",
        sortOrder: 3,
      },
    ]);

    const styles = await upsertMany(Style, [
      { name: "Indiana", sortOrder: 1 },
      { name: "Safari", sortOrder: 2 },
      { name: "Panamá Hats", sortOrder: 3 },
      { name: "Clásico", sortOrder: 4 },
    ]);

    const categories = await upsertMany(Category, [
      { name: "Sombreros", description: "Colección principal", sortOrder: 1 },
      {
        name: "Accesorios",
        description: "Complementos artesanales",
        sortOrder: 2,
      },
    ]);

    const colors = await upsertMany(Color, [
      { name: "Natural", hexCode: "#E8DCC8", sortOrder: 1 },
      { name: "Negro", hexCode: "#1f1f1f", sortOrder: 2 },
      { name: "Café", hexCode: "#6B4423", sortOrder: 3 },
    ]);

    const sizes = await upsertMany(Size, [
      { name: "S", label: "Talla S (54-55 cm)", sortOrder: 1 },
      { name: "M", label: "Talla M (56-57 cm)", sortOrder: 2 },
      { name: "L", label: "Talla L (58-59 cm)", sortOrder: 3 },
    ]);

    const exists = await Product.findOne({ slug: "sombrero-indiana-natural" });

    if (!exists) {
      await Product.create({
        name: "Sombrero Indiana Natural",
        shortDescription:
          "Sombrero artesanal en palma de iraca, acabado natural.",
        fullDescription:
          "Sombrero tejido a mano en Sandoná, Nariño. Palma de iraca de alta calidad, ideal para climas cálidos. Horma Indiana con acabado premium.",
        category: categories[0]._id,
        weaveType: weaveTypes[0]._id,
        style: styles[0]._id,
        material: "Palma de iraca 100%",
        salePrice: 189000,
        internalCost: 95000,
        isFeatured: true,
        isNew: true,
        mainImage:
          "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&q=80",
        images: [
          {
            url: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&q=80",
            alt: "Sombrero Indiana Natural - vista frontal",
          },
        ],
        variants: [
          {
            size: sizes[1]._id,
            color: colors[0]._id,
            sku: "DIZ-IND-NAT-M",
            stock: 12,
            isActive: true,
          },
          {
            size: sizes[2]._id,
            color: colors[0]._id,
            sku: "DIZ-IND-NAT-L",
            stock: 8,
            isActive: true,
          },
        ],
        seoTitle: "Sombrero Indiana Natural | Dizor",
        seoDescription:
          "Sombrero artesanal en palma de iraca. Tejido Brisa, horma Indiana. Envíos a toda Colombia.",
      });
      console.log("Producto de ejemplo creado.");
    } else {
      console.log("Producto de ejemplo ya existe.");
    }

    console.log("Catálogo inicializado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error en seed catálogo:", error);
    process.exit(1);
  }
};

seedCatalog();
