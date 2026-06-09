require("dotenv").config(); // for environment variables
const express = require("express"); // importing express package
const mongoose = require("mongoose"); // importing mongoose package
const cors = require("cors");
const compression = require("compression");
const User = require("./models/user");
const Product = require("./models/product");
const Order = require("./models/order");
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
    mongoose.set("strictQuery", true);

    // خيارات لمنع مشاكل الـ DNS مع Cloudflare و Vercel
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
    res
      .status(500)
      .json({ error: "Database connection failed", details: err.message });
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
// PRODUCT ROUTES (Multi-language Support)
// ============================================

// ===== Add New Product ======
app.post("/products", upload.array("images", 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    let imageUrls = [];

    try {
      for (const file of req.files) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const uniqueFileName = `${uniqueSuffix}-${file.originalname}`;

        const blob = await put(uniqueFileName, file.buffer, {
          access: "public",
          token: token,
          allowOverwrite: true,
        });

        imageUrls.push(blob.url);
      }
    } catch (blobError) {
      console.error("DETAILED_BLOB_ERROR:", blobError);
      return res.status(500).json({
        error: "Vercel Blob storage failed during sequence upload",
        details: blobError.message,
      });
    }

    let {
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

    // 💡 تحويل النصوص المترجمة القادمة من الـ Form-Data إلى Objects
    try {
      if (typeof title === "string") title = JSON.parse(title);
      if (typeof description === "string")
        description = JSON.parse(description);
      if (typeof category === "string") category = JSON.parse(category);
    } catch (parseError) {
      return res.status(400).json({
        error:
          "Title, Description, and Category must be valid JSON objects containing 'en' and 'ar'",
      });
    }

    // التحقق من وجود اللغتين لكل الحقول الحيوية
    if (
      !title?.en ||
      !title?.ar ||
      !description?.en ||
      !description?.ar ||
      !category?.en ||
      !category?.ar
    ) {
      return res
        .status(400)
        .json({
          error:
            "English and Arabic translations are required for title, description, and category",
        });
    }

    const newProduct = new Product({
      title,
      image: imageUrls[0],
      images: imageUrls,
      price: Number(price),
      category,
      description,
      discount: Number(discount) || 0,
      color,
      inStock: inStock === "true",
      brand,
      model,
    });

    await newProduct.save();

    res
      .status(201)
      .json({ message: "Product created with 4 images", product: newProduct });
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

    if (selectCategory) {
      filter.$or = [
        { "category.en": { $regex: selectCategory, $options: "i" } },
        { "category.ar": { $regex: selectCategory, $options: "i" } },
      ];
    }

    /* Price filter */
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search?.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { "title.en": searchRegex },
        { "title.ar": searchRegex },
        { "description.en": searchRegex },
        { "description.ar": searchRegex },
        { "category.en": searchRegex },
        { "category.ar": searchRegex },
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
    let updateData = { ...req.body };

    // معالجة النصوص وحفظها كـ Objects إذا تم تحديثها من فورم عادية
    if (typeof updateData.title === "string")
      updateData.title = JSON.parse(updateData.title);
    if (typeof updateData.description === "string")
      updateData.description = JSON.parse(updateData.description);
    if (typeof updateData.category === "string")
      updateData.category = JSON.parse(updateData.category);

    const updateProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    if (!updateProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updateProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================
// ORDER ROUTES
// ============================================
app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "fullname email")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch orders", error: err.message });
  }
});

app.post("/orders", protect, async (req, res) => {
  try {
    const { items, shippingInfo, paymentMethod } = req.body;

    let subtotal = 0;
    let discount = 0;

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.product);

        subtotal += product.price * item.qty;
        discount += (item.discount || 0) * item.qty;

        return {
          product: product._id,
          title: product.title,
          image: product.image,
          qty: item.qty,
          price: product.price,
        };
      }),
    );

    const total = subtotal - discount;

    const order = await Order.create({
      user: req.user._id,
      items: enrichedItems,
      subtotal,
      discount,
      total,
      shippingInfo,
      paymentMethod,
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: "Order creation failed" });
  }
});

app.get("/orders/my", protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// ===== Update Order Status By ID =====
app.put("/orders/:id", async (req, res) => {
  try {
    const { status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update order status", error: err.message });
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
      products,
      startDate,
      endDate,
      isActive,
    } = req.body;

    const offer = new Offer({
      title,
      description,
      discountPercentage,
      products: products || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
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
      .populate("products", "title image price")
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
    }).populate("products", "title image price");

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
    const {
      title,
      description,
      discountPercentage,
      products,
      startDate,
      endDate,
      isActive,
    } = req.body;

    // بناء أوبجكت التحديث وتأمين الداتا
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (discountPercentage !== undefined)
      updateData.discountPercentage = Number(discountPercentage);
    if (isActive !== undefined) updateData.isActive = isActive;

    // تأمين تحويل التواريخ لكائن Date حقيقي عشان الـ Validators ميزعلوش
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);

    // تأمين مصفوفة المنتجات (الجمع)
    if (products !== undefined) {
      updateData.products = Array.isArray(products) ? products : [];
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      { $set: updateData }, // استخدام $set أضمن وأقوى في الـ Update
      {
        new: true, // يرجعلك الأوبجكت بعد التعديل مش قبله
        runValidators: true,
      },
    ).populate("products", "title image price"); // بالمرة عشان يرجعلك البيانات متفصصة للفرونت إند

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
    console.error("Error updating offer:", err); // دي عشان لو فشل برضه يطبعلك السبب بالظبط في الـ Terminal
    res.status(500).json({
      message: "Offer update failed",
      error: err.message, // بنرجع الـ message عشان تعرف لو السكيمة قفشت في Validation معينة
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

const PORT = process.env.PORT || 8080;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening locally on port: ${PORT}`);
  });
}

const { getMegaDashboardStats } = require("../controllers/dashboardController");

app.get("/api/dashboard/all-stats", getMegaDashboardStats);

module.exports = app;
