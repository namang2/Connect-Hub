const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");

dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept json data


app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT||5000;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL || true
      : "http://localhost:3000",
  },
});

// Store active calls, meetings, and online users
const activeCalls = new Map();
const activeMeetings = new Map();
const onlineUsers = new Map(); // userId -> Set of socketIds

// Helper: broadcast online users list to all connected sockets
const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(onlineUsers.keys());
  io.emit("online users updated", onlineUserIds);
};

io.on("connection", (socket) => {
  console.log("Connected to socket.io");
  
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.userId = userData._id;
    socket.userName = userData.name;
    socket.userPic = userData.pic;

    // Track online status
    if (!onlineUsers.has(userData._id)) {
      onlineUsers.set(userData._id, new Set());
    }
    onlineUsers.get(userData._id).add(socket.id);

    socket.emit("connected");

    // Send current online users to the newly connected user
    socket.emit("online users updated", Array.from(onlineUsers.keys()));

    // Broadcast to everyone that this user is now online
    broadcastOnlineUsers();
  });

  // Allow clients to request the current online users list
  socket.on("get online users", () => {
    socket.emit("online users updated", Array.from(onlineUsers.keys()));
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });
  
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });

  // ==================== VIDEO/VOICE CALLING ====================

  // Initiate a call (one-to-one)
  socket.on("call:initiate", ({ to, callType, offer, callerInfo }) => {
    console.log(`Call initiated from ${socket.userId} to ${to}, type: ${callType}`);
    
    const callId = `call_${Date.now()}_${socket.userId}`;
    activeCalls.set(callId, {
      callerId: socket.userId,
      receiverId: to,
      callType,
      status: "ringing",
      startTime: null,
    });

    socket.to(to).emit("call:incoming", {
      callId,
      from: socket.userId,
      callerInfo,
      callType,
      offer,
    });

    socket.emit("call:initiated", { callId });
  });

  // Accept a call
  socket.on("call:accept", ({ callId, answer, to }) => {
    console.log(`Call ${callId} accepted`);
    
    const call = activeCalls.get(callId);
    if (call) {
      call.status = "active";
      call.startTime = Date.now();
      activeCalls.set(callId, call);
    }

    socket.to(to).emit("call:accepted", { callId, answer });
  });

  // Reject a call
  socket.on("call:reject", ({ callId, to, reason }) => {
    console.log(`Call ${callId} rejected: ${reason}`);
    activeCalls.delete(callId);
    socket.to(to).emit("call:rejected", { callId, reason });
  });

  // End a call
  socket.on("call:end", ({ callId, to }) => {
    console.log(`Call ${callId} ended`);
    activeCalls.delete(callId);
    socket.to(to).emit("call:ended", { callId });
  });

  // ICE candidate exchange
  socket.on("call:ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("call:ice-candidate", { candidate, from: socket.userId });
  });

  // ==================== GROUP MEETINGS ====================

  // Create a meeting room
  socket.on("meeting:create", ({ chatId, creatorInfo, meetingType }) => {
    const meetingId = `meeting_${chatId}_${Date.now()}`;
    const type = meetingType || "meeting";
    
    activeMeetings.set(meetingId, {
      chatId,
      creatorId: socket.userId,
      meetingType: type,
      participants: new Map([[socket.id, {
        oderId: socket.userId,
        name: creatorInfo.name,
        pic: creatorInfo.pic,
        isAudioOn: false,
        isVideoOn: false,
        isScreenSharing: false,
      }]]),
      createdAt: Date.now(),
    });

    socket.join(meetingId);
    
    socket.emit("meeting:created", { meetingId, meetingType: type });
    
    // Notify all users in the chat about the meeting
    socket.to(chatId).emit("meeting:started", {
      meetingId,
      chatId,
      creatorInfo,
      meetingType: type,
    });
  });

  // Check for active meeting in a chat
  socket.on("meeting:check-active", ({ chatId }) => {
    let activeMeeting = null;
    activeMeetings.forEach((meeting, meetingId) => {
      if (meeting.chatId === chatId && meeting.participants.size > 0) {
        activeMeeting = {
          meetingId,
          meetingType: meeting.meetingType,
          participantCount: meeting.participants.size,
          creatorId: meeting.creatorId,
        };
      }
    });
    socket.emit("meeting:active-status", { chatId, activeMeeting });
  });

  // Join a meeting
  socket.on("meeting:join", ({ meetingId, userInfo }) => {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) {
      socket.emit("meeting:error", { message: "Meeting not found" });
      return;
    }

    // Get existing participants
    const existingParticipants = Array.from(meeting.participants.entries()).map(
      ([socketId, info]) => ({ socketId, ...info })
    );

    // Add new participant
    meeting.participants.set(socket.id, {
      oderId: socket.userId,
      name: userInfo.name,
      pic: userInfo.pic,
      isAudioOn: false,
      isVideoOn: false,
      isScreenSharing: false,
    });

    socket.join(meetingId);

    // Notify existing participants about new user
    socket.to(meetingId).emit("meeting:user-joined", {
      oderId: socket.id,
      userInfo,
    });

    // Send existing participants to the new user
    socket.emit("meeting:joined", {
      meetingId,
      participants: existingParticipants,
    });
  });

  // Leave a meeting
  socket.on("meeting:leave", ({ meetingId }) => {
    const meeting = activeMeetings.get(meetingId);
    if (meeting) {
      meeting.participants.delete(socket.id);
      socket.leave(meetingId);

      // If no participants left, delete meeting
      if (meeting.participants.size === 0) {
        activeMeetings.delete(meetingId);
      } else {
        socket.to(meetingId).emit("meeting:user-left", {
          oderId: socket.id,
          userId: socket.userId,
        });
      }
    }
  });

  // WebRTC offer for meeting
  socket.on("meeting:offer", ({ meetingId, to, offer }) => {
    socket.to(to).emit("meeting:offer", {
      from: socket.id,
      offer,
    });
  });

  // WebRTC answer for meeting
  socket.on("meeting:answer", ({ meetingId, to, answer }) => {
    socket.to(to).emit("meeting:answer", {
      from: socket.id,
      answer,
    });
  });

  // ICE candidate for meeting
  socket.on("meeting:ice-candidate", ({ meetingId, to, candidate }) => {
    socket.to(to).emit("meeting:ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  // Toggle audio/video in meeting
  socket.on("meeting:toggle-media", ({ meetingId, mediaType, isEnabled }) => {
    const meeting = activeMeetings.get(meetingId);
    if (meeting && meeting.participants.has(socket.id)) {
      const participant = meeting.participants.get(socket.id);
      if (mediaType === "audio") {
        participant.isAudioOn = isEnabled;
      } else if (mediaType === "video") {
        participant.isVideoOn = isEnabled;
      }
      
      socket.to(meetingId).emit("meeting:media-toggled", {
        oderId: socket.id,
        mediaType,
        isEnabled,
      });
    }
  });

  // Screen sharing
  socket.on("meeting:screen-share-start", ({ meetingId }) => {
    const meeting = activeMeetings.get(meetingId);
    if (meeting && meeting.participants.has(socket.id)) {
      meeting.participants.get(socket.id).isScreenSharing = true;
      
      socket.to(meetingId).emit("meeting:screen-share-started", {
        oderId: socket.id,
        userName: socket.userName,
      });
    }
  });

  socket.on("meeting:screen-share-stop", ({ meetingId }) => {
    const meeting = activeMeetings.get(meetingId);
    if (meeting && meeting.participants.has(socket.id)) {
      meeting.participants.get(socket.id).isScreenSharing = false;
      
      socket.to(meetingId).emit("meeting:screen-share-stopped", {
        oderId: socket.id,
      });
    }
  });

  // ==================== DISCONNECT ====================

  socket.on("disconnect", () => {
    console.log("USER DISCONNECTED:", socket.userId);

    // Remove from online users tracking
    if (socket.userId && onlineUsers.has(socket.userId)) {
      onlineUsers.get(socket.userId).delete(socket.id);
      // Only remove user from online list if they have no more active sockets
      if (onlineUsers.get(socket.userId).size === 0) {
        onlineUsers.delete(socket.userId);
      }
      broadcastOnlineUsers();
    }
    
    // Clean up any active calls
    activeCalls.forEach((call, callId) => {
      if (call.callerId === socket.userId || call.receiverId === socket.userId) {
        const otherId = call.callerId === socket.userId ? call.receiverId : call.callerId;
        socket.to(otherId).emit("call:ended", { callId, reason: "disconnect" });
        activeCalls.delete(callId);
      }
    });

    // Clean up meeting participation
    activeMeetings.forEach((meeting, meetingId) => {
      if (meeting.participants.has(socket.id)) {
        meeting.participants.delete(socket.id);
        socket.to(meetingId).emit("meeting:user-left", {
          oderId: socket.id,
          userId: socket.userId,
        });
        
        if (meeting.participants.size === 0) {
          activeMeetings.delete(meetingId);
        }
      }
    });
  });

  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(socket.userId);
  });
});
