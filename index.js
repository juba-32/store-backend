require("dotenv").config(); // for environment variables
const express = require("express"); // importing express package
const mongoose = require("mongoose"); // importing mongoose package
const cors = require("cors");
const compression = require("compression");
const User = require("./models/user");
const Product = require("./models/product");
const Order = require("./models/test");
const Offer = require("./models/offer");
const jwt = require("jsonwebtoken");
const { put } = require("@vercel/blob");
const upload = require("./middleware/upload");
const protect = require("./middleware/authMiddleware");

const app = express();

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(compression());
app.use(cors());

// --- إعداد الاتصال بالسيرفرات السحابية (SERVERLESS DB MIDDLEWARE) ---
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return; // استخدام الاتصال الكاش لو موجود
  }

  try {
    mongoose.set('strictQuery', true);
    
    // التعديل هنا: أضفنا خيارات لمنع مشاكل الـ DNS مع Cloudflare و Vercel
    await mongoose.connect(process.env.MONGODB_URL, {
      connectTimeoutMS: 30000, // زيادة وقت الانتظار لـ 30 ثانية منعاً للـ Timeout
      socketTimeoutMS: 30000,
    });
    
    isConnected = true;
    console.log("✅ Connected successfully to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

// ميديالوير عالمي للتأكد من جاهزية الداتا بيز قبل تنفيذ أي ريكويست
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database connection failed", details: err.message });
  }
});
// -------------------------------------------------------------

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register
app.post("/signup", async (req, res) => {
  const { fullname, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already in use" });

    user = new User({ fullname, email, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: { id: user._id, fullname, email } });
  } catch (err) {
    console.error(err);
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

// ============================================
// CUSTOMER ROUTES
// ============================================

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

// ============================================
// PRODUCT ROUTES
// ============================================

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
      return res.status(500).json({
        error: "Vercel Blob storage failed",
        details: blobError.message,
      });
    }

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

    // 2. Save to MongoDB
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
    const { selectCategory, minPrice, maxPrice, search, limit } = req.query;
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

// ============================================
// ORDER ROUTES
// ============================================

app.post("/orders", protect, async (req, res) => {
  try {
    const { items, shippingInfo, paymentMethod } = req.body;

    let subtotal = 0;
    let discount = 0;

    items.forEach((item) => {
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
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "title image price")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// ============================================
// OFFER ROUTES
// ============================================

// ===== Create Offer =====
app.post("/offers", async (req, res) => {
  try {
    const {
      title,
      description,
      discountPercentage,
      product,
      startDate,
      endDate,
      isActive,
    } = req.body;

    const offer = new Offer({
      title,
      description,
      discountPercentage,
      product,
      startDate,
      endDate,
      isActive,
    });

    await offer.save();

    res.status(201).json({
      message: "Offer created successfully",
      offer,
    });
  } catch (err) {
    res.status(500).json({
      message: "Offer creation failed",
      error: err.message,
    });
  }
});

// ===== Get All Offers =====
app.get("/offers", async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("product", "title image price")
      .sort({ createdAt: -1 });

    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch offers",
    });
  }
});

// ===== Get Active Offers =====
app.get("/offers/active", async (req, res) => {
  try {
    const now = new Date();

    const offers = await Offer.find({
      isActive: true,
      $or: [
        {
          startDate: { $lte: now },
          endDate: { $gte: now },
        },
        {
          startDate: null,
          endDate: null,
        },
      ],
    }).populate("product", "title image price");

    res.json(offers);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch active offers",
    });
  }
});

// ===== Update Offer =====
app.put("/offers/:id", async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedOffer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    res.json({
      message: "Offer updated successfully",
      offer: updatedOffer,
    });
  } catch (err) {
    res.status(500).json({
      message: "Offer update failed",
    });
  }
});

// ===== Delete Offer =====
app.delete("/offers/:id", async (req, res) => {
  try {
    const deletedOffer = await Offer.findByIdAndDelete(req.params.id);

    if (!deletedOffer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    res.json({
      message: "Offer deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Offer deletion failed",
    });
  }
});

// --- إدارة تشغيل السيرفر محلياً / سحابياً ---
const PORT = process.env.PORT || 8080;

// شرط لمنع استدعاء السيرفر مرتين في بيئة Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening locally on port: ${PORT}`);
  });
}

// تصدير التطبيق لمنصة Vercel لتتمكن من تشغيل الـ Serverless Functions
module.exports = app;