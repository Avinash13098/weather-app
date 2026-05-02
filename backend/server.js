const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "avinash123";

// 🔗 DB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/Weatherapp")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// 👤 MODEL
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  favorites: [String],
});
const User = mongoose.model("User", userSchema);

// 🔐 AUTH MIDDLEWARE (Bearer)
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ msg: "No token ❌" });

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ msg: "Bad auth format ❌" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ msg: "Invalid/Expired token ❌" });
  }
};

// 🏠 TEST
app.get("/", (req, res) => {
  res.send("🔥 Weather Backend Running...");
});

// 🔐 SIGNUP
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ msg: "Email & Password required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ msg: "User already exists ❌" });
    }

    const hashed = await bcrypt.hash(cleanPassword, 10);

    const user = new User({
      email: cleanEmail,
      password: hashed,
      favorites: [],
    });

    await user.save();

    res.json({ msg: "Signup success ✅" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Signup error" });
  }
});

// 🔐 LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ msg: "User not found ❌" });

    const match = await bcrypt.compare(cleanPassword, user.password);
    if (!match) return res.status(400).json({ msg: "Wrong password ❌" });

    const token = jwt.sign(
      { id: user._id },
      SECRET,
      { expiresIn: "1h" } // ⏳ expiry
    );

    res.json({
      token,
      userId: user._id,
      msg: "Login success ✅",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Login error" });
  }
});

// ⭐ PROTECTED ROUTES

app.get("/favorites", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user.favorites);
});

app.post("/add-fav", auth, async (req, res) => {
  const { city } = req.body;

  const user = await User.findById(req.userId);

  if (!user.favorites.includes(city)) {
    user.favorites.push(city);
    await user.save();
  }

  res.json({ msg: "Added ⭐" });
});

app.post("/delete-fav", auth, async (req, res) => {
  const { city } = req.body;

  const user = await User.findById(req.userId);
  user.favorites = user.favorites.filter((c) => c !== city);
  await user.save();

  res.json({ msg: "Removed ❌" });
});

// 🚀 START
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});