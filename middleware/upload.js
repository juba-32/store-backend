const multer = require("multer");

// MUST use memoryStorage to get req.file.buffer
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB to stay under Vercel's limit
  }
});

module.exports = upload;