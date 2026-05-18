const slugify = require("slugify");

const slugifyText = (text) =>
  slugify(text, {
    lower: true,
    strict: true,
    locale: "es",
  });

module.exports = slugifyText;
