const express = require("express"); // imprting express package
const mongoose = require("mongoose"); // imprting mongoose package
const cors = require("cors");
const compression = require("compression");

require("dotenv").config(); // for environment variables
const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(compression());

app.use(cors());
const User = require("./models/Users");
const Post = require("./models/Post");
const Product = require("./models/Products");
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Connected successfully to MongoDB Atlas"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

// server port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`im listening to port: ${PORT}`);
});

// ===== Create User ======
app.post("/user", async (req, res) => {
  try {
    const { userName, userEmail } = req.body;
    const newUser = new User({ name: userName, email: userEmail });
    await newUser.save();
    res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (err) {
    console.log("Error Creating User", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Get Users ======
app.get("/users", async (req, res) => {
  const allUsers = await User.find().lean();
  console.log(allUsers);
  res.send({ newUser: allUsers });
});

// ===== Create Post ======

// ===== Create Product ======
app.post("/products", async (req, res) => {
  try {
    const {
      title,
      image,
      price,
      category,
      description,
      color,
      inStock,
      discount,
      model,
      brand,
    } = req.body;

    const newProduct = new Product({
      title: title,
      image: image,
      price: price,
      category: category,
      description: description,
      discount: discount,
      color: color,
      inStock: inStock,
      brand: brand,
      model: model,
    });
    await newProduct.save();
    res.status(201).json({
      message: "Products created successfully",
      Products: newProduct,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Get all Products ======
app.get("/products", async (req, res) => {
  try {
    const { selectCategory, minPrice, maxPrice, search, limit } = req.query;
    const filter = {};

    // Category filter (optional)
    if (selectCategory) {
      filter.category = { $regex: selectCategory, $options: "i" };
    }
    // Price filter (optional)
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    // Search filter
    if (search?.trim()) {
  filter = [
    { title: { $regex: search.trim(), $options: "i" } },
    { description: { $regex: search.trim(), $options: "i" } },
    { brand: { $regex: search.trim(), $options: "i" } },
  ];
}

    const products = await Product.find(filter).lean();
;
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== get Product By ID ======
app.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Delete Product By ID ======
app.delete("/products/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({
      message: "Product deleted successfully",
      product: deletedProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Update Product By ID ======
app.put("/products/:id", async (req, res) => {
  try {
    const updateProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json({
      message: "Product updated successfully",
      product: updateProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
