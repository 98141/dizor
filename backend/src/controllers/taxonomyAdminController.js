const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const taxonomyModels = {
  categories: () => require("../models/category"),
  colors: () => require("../models/color"),
  sizes: () => require("../models/size"),
  "weave-types": () => require("../models/weaveType"),
  styles: () => require("../models/style"),
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
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return next(new AppError("Registro no encontrado", 404));
    }

    res.status(200).json({
      status: "success",
      item,
    });
  });

  const remove = catchAsync(async (req, res, next) => {
    const Model = getModel(type);
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
