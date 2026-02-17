const multer = require("multer");

// MUST use memoryStorage to get req.file.buffer
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 4 * 1024 * 1024, 
  }
});

module.exports = upload;