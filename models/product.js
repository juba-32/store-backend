const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  discount: { type: Number, default: 0 },
  color: { type: String },
  inStock: { type: Boolean, default: true },
  brand: { type: String },
  model: { type: String },
  image: { type: String },
  images: { type: [String], default: [] }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;