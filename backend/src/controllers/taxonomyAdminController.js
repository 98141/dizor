const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const taxonomyModels = {
  categories: () => require("../models/category"),
  colors: () => require("../models/color"),
  sizes: () => require("../models/size"),
  "weave-types": () => require("../models/weaveType"),
  styles: () => require("../models/style"),
};

/** Campo del producto que referencia cada taxonomía. */
const PRODUCT_USAGE = {
  categories: { field: "category", label: "en esta categoría" },
  "weave-types": { field: "weaveType", label: "con este tejido" },
  styles: { field: "style", label: "con esta horma" },
  sizes: { field: "variants.size", label: "con variantes en esta talla" },
  colors: { field: "variants.color", label: "con variantes en este color" },
};

const getModel = (type) => {
  const factory = taxonomyModels[type];
  if (!factory) return null;
  return factory();
};

const createTaxonomyHandlers = (type) => {
  const list = catchAsync(async (req, res) => {
    const Model = getModel(type);
    const items = await Model.find().sort({ sortOrder: 1, name: 1 });

    res.status(200).json({
      status: "success",
      results: items.length,
      items,
    });
  });

  const create = catchAsync(async (req, res, next) => {
    const Model = getModel(type);
    const item = await Model.create(req.body);

    res.status(201).json({
      status: "success",
      item,
    });
  });

  const update = catchAsync(async (req, res, next) => {
    const Model = getModel(type);
    const item = await Model.findById(req.params.id);

    if (!item) {
      return next(new AppError("Registro no encontrado", 404));
    }

    // save() (no findByIdAndUpdate) para que el hook regenere el slug al
    // renombrar: el slug es la URL pública del filtro (?weaveType=fino).
    const { _id, slug, createdAt, updatedAt, ...changes } = req.body || {};
    item.set(changes);
    await item.save();

    res.status(200).json({
      status: "success",
      item,
    });
  });

  const remove = catchAsync(async (req, res, next) => {
    const Model = getModel(type);

    // No eliminar si hay productos asociados (evitar referencias rotas).
    const usage = PRODUCT_USAGE[type];
    if (usage) {
      const Product = require("../models/product");
      const linked = await Product.countDocuments({
        [usage.field]: req.params.id,
      });
      if (linked > 0) {
        return next(
          new AppError(
            `No se puede eliminar: hay ${linked} producto(s) ${usage.label}. Desactívalo o reasigna los productos primero.`,
            400
          )
        );
      }
    }

    const item = await Model.findByIdAndDelete(req.params.id);

    if (!item) {
      return next(new AppError("Registro no encontrado", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Eliminado correctamente",
    });
  });

  return { list, create, update, remove };
};

const handlers = {};
Object.keys(taxonomyModels).forEach((type) => {
  handlers[type] = createTaxonomyHandlers(type);
});

exports.handlers = handlers;
exports.getModel = getModel;
