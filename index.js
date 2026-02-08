const express = require("express"); // imprting express package
const mongoose = require("mongoose"); // imprting mongoose package
const cors = require("cors");
const compression = require("compression");
require("dotenv").config(); // for environment variables

const authRoutes = require("./routes/auth");

const app = express();

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(compression());
app.use(cors());

const Product = require("./models/Products");

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Connected successfully to MongoDB Atlas"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

app.use("/api/auth", authRoutes);
// server port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`im listening to port: ${PORT}`);
});

// ===== Create Product ======
import multer from "multer";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });
app.post("/products", upload.single("image"), async (req, res) => {
  try {
    const {
      title,
      price,
      category,
      description,
      color,
      inStock,
      discount,
      model,
      brand,
    } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : "";
    const newProduct = new Product({
      title,
      image,
      price,
      category,
      description,
      discount,
      color,
      inStock,
      brand,
      model,
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
    const { selectCategory, minPrice, maxPrice, search } = req.query;
    const filter = {};

    if (selectCategory) {
      filter.category = { $regex: selectCategory, $options: "i" };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    // Search filter
    if (search?.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
      ];
    }
    const products = await Product.find(filter).lean();
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
      { new: true },
    );
    res.status(200).json({
      message: "Product updated successfully",
      product: updateProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
