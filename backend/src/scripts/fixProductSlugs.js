/**
 * Normaliza slugs de productos existentes (minúsculas, sin espacios).
 * Uso: npm run fix:slugs
 */
require("dotenv").config();

const connectDB = require("../config/db");
const Product = require("../models/product");
const slugifyText = require("../utils/slugifyText");

const fixProductSlugs = async () => {
  await connectDB();

  const products = await Product.find();
  let updated = 0;

  for (const product of products) {
    const nextSlug = slugifyText(product.name);
    if (!product.slug || product.slug !== nextSlug) {
      product.slug = nextSlug;
      await product.save({ validateBeforeSave: false });
      updated += 1;
      console.log(`✓ ${product.name} → ${nextSlug}`);
    }
  }

  console.log(`\nListo: ${updated} producto(s) actualizados de ${products.length}.`);
  process.exit(0);
};

fixProductSlugs().catch((err) => {
  console.error(err);
  process.exit(1);
});
