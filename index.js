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
  console.log("im listening to port 8080");
});



// path params
app.get("/pathParams/:num1/:num2", (req, res) => {
  const num1 = req.params.num1;
  const num2 = req.params.num2;
  const total = Number(num1) + Number(num2);
  res.send(`total is:  ${total}`);
});

// body params
app.post("/bodyParams", (req, res) => {
  const name = req.body.name;
  const age = req.body.age;
  const position = req.body.position;
  const person = name + " " + age + " " + position;
  res.send(`${person}`);
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
app.post("/post", async (req, res) => {
  const newPost = new Post();
  newPost.title = "post title";
  newPost.body = "post body";
  await newPost.save();
  res.send("create post");
});

// ===== Create Products ======
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
    console.log("Error Creating Products", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


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
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    // Apply limit if provided
    const query = Product.find(filter).lean();
    if (limit) query.limit(Number(limit));

    const products = await query;
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Server error" });
  }
});


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
