const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  image: String,
  title: String,
  category: String,
  price: Number,
  discount: Number,
  color: String,
  description: String,
  inStock: Boolean
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
