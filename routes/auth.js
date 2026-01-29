const express = require("express");
const router = express.Router();
const User = require("../models/Users");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

// Generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// Register
router.post("/signup", async (req, res) => {
  const { fullname, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already in use" });

    user = new User({ fullname, email, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: { id: user._id, fullname, email } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user._id);
    res.json({ token, user: { id: user._id, fullname: user.fullname, email } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
