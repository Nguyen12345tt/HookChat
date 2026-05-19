const multer = require('multer');

// Cấu hình lưu trữ file vào bộ nhớ đệm (RAM) thay vì ổ cứng
const storage = multer.memoryStorage();

// Bộ lọc: Chỉ cho phép upload ảnh hoặc file âm thanh
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng file không hỗ trợ! Chỉ nhận ảnh và ghi âm.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });
module.exports = upload;