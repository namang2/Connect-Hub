const express = require("express");
const {
  allMessages,
  sendMessage,
  sendFileMessage,
  sendLocationMessage,
  updateLiveLocation,
  downloadFileProxy,
  sendCallRecord,
} = require("../controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/download").get(protect, downloadFileProxy);
router.route("/call").post(protect, sendCallRecord);
router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);
router.route("/file").post(protect, sendFileMessage);
router.route("/location").post(protect, sendLocationMessage);
router.route("/location/:messageId").put(protect, updateLiveLocation);

module.exports = router;
