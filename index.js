const express = require("express"); // imprting express package
const mongoose = require("mongoose"); // imprting mongoose package
const cors = require("cors");
const compression = require("compression");
require("dotenv").config(); // for environment variables
const User = require("./models/Users");
const Product = require("./models/Products");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(compression());
app.use(cors());


mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Connected successfully to MongoDB Atlas"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`im listening to port: ${PORT}`);
});



 const generateToken = (id) =>
   jwt.sign({ id }, process.env.JWT_SECRET, {
     expiresIn: process.env.JWT_EXPIRES_IN,
   });


 // Register
 app.post("/signup", async (req, res) => {
   const { fullname, email, password } = req.body;

   try {
     let user = await User.findOne({ email });
     if (user) return res.status(400).json({ message: "Email already in use" });

     user = new User({ fullname, email, password });
     await user.save();
     console.log("JWT_SECRET:", process.env.JWT_SECRET);
     console.log("JWT_EXPIRES_IN:", process.env.JWT_EXPIRES_IN);

     const token = generateToken(user._id);
     res.status(201).json({ token, user: { id: user._id, fullname, email } });
   } catch (err) {
   console.log(err);
   res.status(500).json({ message: err.message });
 }
 });

// Login
 app.post("/login", async (req, res) => {
   const { email, password } = req.body;

   try {
     const user = await User.findOne({ email });
     if (!user) return res.status(400).json({ message: "Invalid credentials" });

     const isMatch = await user.matchPassword(password);
     if (!isMatch)
       return res.status(400).json({ message: "Invalid credentials" });

     const token = generateToken(user._id);
     res.json({ token, user: { id: user._id, fullname: user.fullname, email } });
   } catch (err) {
     res.status(500).json({ message: "Server error" });
   }
 });

// Get All Users (Customers)
app.get("/customers", async (req, res) => {
  try {
    const users = await User.find({}, "fullname email");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// Delete User
app.delete("/customers/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});





// ===== Create Product ======

console.log("Token exists:", !!process.env.BLOB_READ_WRITE_TOKEN);
const { put } = require("@vercel/blob");
const upload = require("./middleware/upload");

// ===== Add New Product ======
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
    const {
      selectCategory,
      minPrice,
      maxPrice,
      search,
      limit,
    } = req.query;

    const filter = {};

    /* Category filter */
    if (selectCategory) {
      filter.category = { $regex: selectCategory, $options: "i" };
    }

    /* Price filter */
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    /* Search filter */
    if (search?.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
      ];
    }

    /* Build query */
    let query = Product.find(filter).lean();

    /* OPTIONAL limit */
    if (limit) {
      query = query.limit(Number(limit));
    }

    const products = await query;
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


const Order = require("./models/orders");
const protect = require("./middleware/authMiddleware");

app.post("/orders", protect, async (req, res) => {
  try {
    const { items, shippingInfo, paymentMethod } = req.body;

    let subtotal = 0;
    let discount = 0;

    items.forEach(item => {
      subtotal += item.price * item.qty;
      discount += (item.discount || 0) * item.qty;
    });

    const total = subtotal - discount;

    const order = await Order.create({
      user: req.user._id,
      items,
      subtotal,
      discount,
      total,
      shippingInfo,
      paymentMethod,
    });

    // Clear user cart after successful order
    req.user.cart = [];
    await req.user.save();

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: "Order creation failed" });
  }
});


app.get("/orders/my", protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("items.product", "title image price")
    .sort({ createdAt: -1 });

  res.json(orders);
});