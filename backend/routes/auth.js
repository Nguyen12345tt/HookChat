const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Bí mật để ký Token (sau này bạn nên chuyển nó vào file .env nhé)
const JWT_SECRET = process.env.JWT_SECRET || "hookchat_super_secret_key_123";

// 📝 API 1: ĐĂNG KÝ TÀI KHOẢN (REGISTER)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Kiểm tra xem email đã tồn tại chưa
    let user = await User.findOne({ email });
    if (user)
      return res.status(400).json({ message: "Email này đã được sử dụng!" });

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo User mới và lưu vào DB
    user = new User({
      name,
      email,
      password: hashedPassword,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    });
    await user.save();

    res.status(201).json({ message: "Đăng ký thành công!" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server", error: error.message });
  }
});

// 🔑 API 2: ĐĂNG NHẬP (LOGIN)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra xem có user này không
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Tài khoản không tồn tại!" });

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Sai mật khẩu!" });

    // Cấp "Thẻ thông hành" (Token)
    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // Trả về thông tin user và token
    res.json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server", error: error.message });
  }
});

module.exports = router;
