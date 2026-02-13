const express = require("express");
const multer = require("multer");
const { uploadFile } = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Use memory storage so the file stays in RAM (no disk writes needed)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

// POST /api/upload  — upload a single file
router.post("/", protect, upload.single("file"), uploadFile);

module.exports = router;

