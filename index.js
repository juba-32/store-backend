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
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`im listening to port: ${PORT}`);
});

// ===== Create Product ======

console.log("Token exists:", !!process.env.BLOB_READ_WRITE_TOKEN);
const { put } = require("@vercel/blob");
const upload = require("./middleware/upload");

app.post("/products", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // 1. Upload to Vercel Blob
    let blob;
    try {
      blob = await put(req.file.originalname, req.file.buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (blobError) {
      console.error("BLOB_ERROR:", blobError);
      return res.status(500).json({ error: "Vercel Blob storage failed", details: blobError.message });
    }

    const { title, price, category, description, color, inStock, discount, model, brand } = req.body;

    const newProduct = new Product({
      title,
      image: blob.url,
      price: Number(price), 
      category,
      description,
      discount: Number(discount) || 0,
      color,
      inStock: inStock === "true",
      brand,
      model,
    });

    // 3. Save to MongoDB
    await newProduct.save();

    res.status(201).json({ message: "Product created", product: newProduct });
  } catch (err) {
    console.error("GENERAL_ERROR:", err);
    res.status(500).json({ error: "Server crashed", details: err.message });
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
