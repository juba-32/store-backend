const express = require("express");
const router = express.Router();
const User = require("../models/Users");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

// Generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// Register
router.post("/signup", async (req, res) => {
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
router.post("/login", async (req, res) => {
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
router.get("/customers", async (req, res) => {
  try {
    const users = await User.find({}, "fullname email");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete User
router.delete("/customers/:id", async (req, res) => {
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

module.exports = router;
