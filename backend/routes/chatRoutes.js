const express = require("express");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  removeFromGroup,
  addToGroup,
  renameGroup,
  makeAdmin,
  removeAdmin,
  removeFromGroupEnhanced,
} = require("../controllers/chatControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, accessChat);
router.route("/").get(protect, fetchChats);
router.route("/group").post(protect, createGroupChat);
router.route("/rename").put(protect, renameGroup);
router.route("/groupremove").put(protect, removeFromGroup);
router.route("/groupadd").put(protect, addToGroup);
router.route("/makeadmin").put(protect, makeAdmin);
router.route("/removeadmin").put(protect, removeAdmin);
router.route("/groupremove-enhanced").put(protect, removeFromGroupEnhanced);

module.exports = router;
