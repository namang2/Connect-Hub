const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // File attachment fields
    file: {
      url: { type: String },
      name: { type: String },
      type: { type: String }, // 'image', 'document', 'video', 'audio', 'other'
      size: { type: Number },
    },
    isFile: { type: Boolean, default: false },
    // Location fields
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
      isLive: { type: Boolean, default: false },
      expiresAt: { type: Date }, // For live location expiry
    },
    isLocation: { type: Boolean, default: false },
    // Call record fields
    isCall: { type: Boolean, default: false },
    call: {
      callType: { type: String }, // 'voice', 'video', 'group-voice', 'group-video', 'meeting'
      duration: { type: Number, default: 0 }, // in seconds
      status: { type: String, default: "ended" }, // 'ended', 'missed', 'declined'
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
