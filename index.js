const express = require("express"); // imprting express package
const mongoose = require("mongoose"); // imprting mongoose package
const cors = require("cors");
require("dotenv").config(); // for environment variables
const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(cors());
const User = require("./models/Users");
const Post = require("./models/Post");
const Product = require("./models/Products");
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Connected successfully to MongoDB Atlas"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

// server port
app.listen(3000, () => {
  console.log("im listening to port 3000");
});

// server path or endpoint
app.get("/home", (req, res) => {
  res.send("wellcom to home");
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

// html file as a response
app.get("/htmlFile", (req, res) => {
  res.render("test.ejs", {
    name: "Ahmed",
  });
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
  const allUsers = await User.find();
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
    const { title, image, price, category, description } = req.body;
    const newProduct = new Product({
      title: title,
      image: image,
      price: price,
      category: category,
      description: description,
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
    const products = await Product.find();
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
