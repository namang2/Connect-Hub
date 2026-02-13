const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const cloudinary = require("../config/cloudinary");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Send File Message
//@route           POST /api/Message/file
//@access          Protected
const sendFileMessage = asyncHandler(async (req, res) => {
  const { chatId, fileUrl, fileName, fileType, fileSize, content } = req.body;

  if (!chatId || !fileUrl) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  // Determine file category
  let fileCategory = "other";
  if (fileType) {
    if (fileType.startsWith("image/")) {
      fileCategory = "image";
    } else if (fileType.startsWith("video/")) {
      fileCategory = "video";
    } else if (fileType.startsWith("audio/")) {
      fileCategory = "audio";
    } else if (
      fileType.includes("pdf") ||
      fileType.includes("document") ||
      fileType.includes("msword") ||
      fileType.includes("spreadsheet") ||
      fileType.includes("presentation")
    ) {
      fileCategory = "document";
    }
  }

  var newMessage = {
    sender: req.user._id,
    content: content || fileName || "File",
    chat: chatId,
    isFile: true,
    file: {
      url: fileUrl,
      name: fileName,
      type: fileCategory,
      size: fileSize,
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Send Location Message
//@route           POST /api/Message/location
//@access          Protected
const sendLocationMessage = asyncHandler(async (req, res) => {
  const { chatId, latitude, longitude, address, isLive, duration } = req.body;

  if (!chatId || latitude === undefined || longitude === undefined) {
    console.log("Invalid location data passed into request");
    return res.sendStatus(400);
  }

  // Calculate expiry time for live location (default 15 minutes)
  let expiresAt = null;
  if (isLive) {
    const durationMs = (duration || 15) * 60 * 1000; // Convert minutes to ms
    expiresAt = new Date(Date.now() + durationMs);
  }

  var newMessage = {
    sender: req.user._id,
    content: isLive ? "📍 Live Location" : "📍 Current Location",
    chat: chatId,
    isLocation: true,
    location: {
      latitude,
      longitude,
      address: address || "",
      isLive: isLive || false,
      expiresAt,
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Update Live Location
//@route           PUT /api/Message/location/:messageId
//@access          Protected
const updateLiveLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const { messageId } = req.params;

  if (!messageId || latitude === undefined || longitude === undefined) {
    return res.sendStatus(400);
  }

  try {
    const message = await Message.findById(messageId);

    if (!message || !message.isLocation || !message.location.isLive) {
      res.status(404);
      throw new Error("Live location message not found");
    }

    // Check if live location has expired
    if (message.location.expiresAt && new Date() > message.location.expiresAt) {
      res.status(400);
      throw new Error("Live location has expired");
    }

    // Update location
    message.location.latitude = latitude;
    message.location.longitude = longitude;
    await message.save();

    const updatedMessage = await Message.findOne({ _id: messageId })
      .populate("sender", "name pic email")
      .populate("chat");

    res.json(updatedMessage);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Download file via proxy (avoids CORS & Cloudinary 401 issues)
//@route           GET /api/Message/download
//@access          Protected
const downloadFileProxy = asyncHandler(async (req, res) => {
  const { url, name } = req.query;

  if (!url) {
    res.status(400);
    throw new Error("File URL is required");
  }

  const https = require("https");
  const http = require("http");

  const fileName = name || "download";

  // ── Content-type lookup from file extension ──
  const getContentTypeFromName = (fn) => {
    const ext = (fn || "").split(".").pop().toLowerCase();
    const mimeTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      csv: "text/csv",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      webm: "video/webm",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
    };
    return mimeTypes[ext] || "application/octet-stream";
  };

  // ── Parse Cloudinary URL → resource_type, publicId, format ──
  const parseCloudinaryUrl = (cloudUrl) => {
    const match = cloudUrl.match(
      /res\.cloudinary\.com\/[^/]+\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const resourceType = match[1]; // "image" | "video" | "raw"
    const fullPath = match[2];

    if (resourceType === "raw") {
      // For raw, the extension is part of the public_id
      const lastDot = fullPath.lastIndexOf(".");
      return {
        resourceType,
        publicId: fullPath,
        format: lastDot > 0 ? fullPath.substring(lastDot + 1) : "",
      };
    }

    // For image/video, strip the extension
    const lastDot = fullPath.lastIndexOf(".");
    if (lastDot > 0) {
      return {
        resourceType,
        publicId: fullPath.substring(0, lastDot),
        format: fullPath.substring(lastDot + 1),
      };
    }
    return { resourceType, publicId: fullPath, format: "" };
  };

  // ── Build a list of download URLs to try, in priority order ──
  const urlsToTry = [];

  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    const parsed = parseCloudinaryUrl(url);
    console.log("📥 Download request for Cloudinary URL:", { url, fileName, parsed });

    if (parsed && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // STRATEGY 1: private_download_url — API endpoint, always works
      try {
        const apiDownloadUrl = cloudinary.utils.private_download_url(
          parsed.publicId,
          parsed.format || "",
          {
            resource_type: parsed.resourceType,
            type: "upload",
            attachment: true,
          }
        );
        console.log("🔑 Strategy 1 — private_download_url:", apiDownloadUrl);
        urlsToTry.push(apiDownloadUrl);
      } catch (e) {
        console.log("⚠️ private_download_url failed:", e.message);
      }

      // STRATEGY 2: signed CDN URL (no transformations, just signed)
      try {
        const opts = {
          resource_type: parsed.resourceType,
          sign_url: true,
          secure: true,
          type: "upload",
        };
        if (parsed.format && parsed.resourceType !== "raw") {
          opts.format = parsed.format;
        }
        const signedUrl = cloudinary.url(parsed.publicId, opts);
        console.log("🔑 Strategy 2 — signed CDN URL:", signedUrl);
        urlsToTry.push(signedUrl);
      } catch (e) {
        console.log("⚠️ signed URL failed:", e.message);
      }
    }

    // STRATEGY 3: fl_attachment on original URL
    urlsToTry.push(url.replace("/upload/", "/upload/fl_attachment/"));
  }

  // STRATEGY 4: the original URL as-is
  urlsToTry.push(url);

  console.log(`📥 Will try ${urlsToTry.length} URLs for download`);

  // ── Try each URL in order until one works ──
  let attempt = 0;

  const tryNextUrl = () => {
    if (attempt >= urlsToTry.length) {
      if (!res.headersSent) {
        res.status(502).json({
          message: "Could not download file from any source. All attempts failed.",
        });
      }
      return;
    }

    const currentUrl = urlsToTry[attempt];
    attempt++;

    console.log(`📥 Attempt ${attempt}/${urlsToTry.length}: ${currentUrl.substring(0, 120)}...`);

    fetchAndPipe(currentUrl, 0, () => {
      // This callback is called on failure — try next URL
      tryNextUrl();
    });
  };

  // ── Fetch a URL, follow redirects, pipe to response ──
  const fetchAndPipe = (fetchUrl, redirectCount, onFail) => {
    if (redirectCount > 10) {
      onFail();
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(fetchUrl);
    } catch (e) {
      onFail();
      return;
    }

    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const request = protocol.get(fetchUrl, { timeout: 30000 }, (fileResponse) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(fileResponse.statusCode)) {
        const loc = fileResponse.headers.location;
        if (loc) {
          fileResponse.resume();
          const abs = loc.startsWith("http") ? loc : new URL(loc, fetchUrl).toString();
          fetchAndPipe(abs, redirectCount + 1, onFail);
          return;
        }
      }

      if (fileResponse.statusCode !== 200) {
        console.log(`❌ Attempt returned status ${fileResponse.statusCode}`);
        fileResponse.resume();
        onFail();
        return;
      }

      // SUCCESS — set headers and pipe the file
      console.log("✅ Download success, streaming to client...");

      const nameBasedType = getContentTypeFromName(fileName);
      const serverType = fileResponse.headers["content-type"] || "";
      const contentType =
        nameBasedType !== "application/octet-stream"
          ? nameBasedType
          : serverType || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      if (fileResponse.headers["content-length"]) {
        res.setHeader("Content-Length", fileResponse.headers["content-length"]);
      }

      fileResponse.pipe(res);

      fileResponse.on("error", (err) => {
        console.error("Download stream error:", err);
        if (!res.headersSent) res.status(500).json({ message: "Error streaming file" });
      });
    });

    request.on("error", (err) => {
      console.error(`Download request error: ${err.message}`);
      onFail();
    });

    request.on("timeout", () => {
      request.destroy();
      console.log("Download request timed out");
      onFail();
    });
  };

  tryNextUrl();
});

//@description     Send Call Record Message
//@route           POST /api/Message/call
//@access          Protected
const sendCallRecord = asyncHandler(async (req, res) => {
  const { chatId, callType, duration, status } = req.body;

  if (!chatId || !callType) {
    console.log("Invalid call data passed into request");
    return res.sendStatus(400);
  }

  const callIcons = {
    voice: "📞",
    video: "📹",
    "group-voice": "📞",
    "group-video": "📹",
    meeting: "🎥",
  };

  const callLabels = {
    voice: "Voice Call",
    video: "Video Call",
    "group-voice": "Group Voice Call",
    "group-video": "Group Video Call",
    meeting: "Group Meeting",
  };

  const icon = callIcons[callType] || "📞";
  const label = callLabels[callType] || "Call";

  // Format duration
  let durationStr = "";
  if (duration && duration > 0) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    durationStr = ` • ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const statusLabel = status === "missed" ? " (Missed)" : status === "declined" ? " (Declined)" : "";
  const content = `${icon} ${label}${durationStr}${statusLabel}`;

  var newMessage = {
    sender: req.user._id,
    content,
    chat: chatId,
    isCall: true,
    call: {
      callType,
      duration: duration || 0,
      status: status || "ended",
    },
  };

  try {
    var message = await Message.create(newMessage);

    message = await Message.findOne({ _id: message._id })
      .populate("sender", "name pic email")
      .populate("chat");

    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { allMessages, sendMessage, sendFileMessage, sendLocationMessage, updateLiveLocation, downloadFileProxy, sendCallRecord };
