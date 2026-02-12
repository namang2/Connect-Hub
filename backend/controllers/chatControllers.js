const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");

//@description     Create or fetch One to One Chat
//@route           POST /api/chat/
//@access          Protected
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name pic email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

//@description     Fetch all chats for a user
//@route           GET /api/chat/
//@access          Protected
const fetchChats = asyncHandler(async (req, res) => {
  try {
    Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("groupAdmins", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: "latestMessage.sender",
          select: "name pic email",
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please Fill all the feilds" });
  }

  var users = JSON.parse(req.body.users);

  if (users.length < 1) {
    return res
      .status(400)
      .send("At least 1 user is required to form a group chat");
  }

  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
      groupAdmins: [req.user._id], // Creator is the first admin
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("groupAdmins", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Rename Group
// @route   PUT /api/chat/rename
// @access  Protected
const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      chatName: chatName,
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
});

// @desc    Remove user from Group
// @route   PUT /api/chat/groupremove
// @access  Protected
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});

// @desc    Add user to Group / Leave
// @route   PUT /api/chat/groupadd
// @access  Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // Check if requester is admin
  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat Not Found");
  }

  const isAdmin = chat.groupAdmins?.some(
    (admin) => admin.toString() === req.user._id.toString()
  ) || chat.groupAdmin?.toString() === req.user._id.toString();

  if (!isAdmin) {
    res.status(403);
    throw new Error("Only admins can add members");
  }

  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $addToSet: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  res.json(added);
});

// @desc    Make user admin
// @route   PUT /api/chat/makeadmin
// @access  Protected
const makeAdmin = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat Not Found");
  }

  // Only original admin or existing admins can promote
  const isAdmin = chat.groupAdmins?.some(
    (admin) => admin.toString() === req.user._id.toString()
  ) || chat.groupAdmin?.toString() === req.user._id.toString();

  if (!isAdmin) {
    res.status(403);
    throw new Error("Only admins can promote members");
  }

  // Check if user is already admin
  if (chat.groupAdmins?.some((admin) => admin.toString() === userId)) {
    res.status(400);
    throw new Error("User is already an admin");
  }

  const updated = await Chat.findByIdAndUpdate(
    chatId,
    {
      $addToSet: { groupAdmins: userId },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  res.json(updated);
});

// @desc    Remove admin rights
// @route   PUT /api/chat/removeadmin
// @access  Protected
const removeAdmin = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat Not Found");
  }

  // Only original creator can demote admins
  if (chat.groupAdmin?.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Only the group creator can remove admins");
  }

  // Cannot remove original admin
  if (userId === chat.groupAdmin?.toString()) {
    res.status(400);
    throw new Error("Cannot remove the original creator's admin rights");
  }

  const updated = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { groupAdmins: userId },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  res.json(updated);
});

// @desc    Remove user from Group (admin only) or Leave group
// @route   PUT /api/chat/groupremove
// @access  Protected
const removeFromGroupEnhanced = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat Not Found");
  }

  // Check if user is removing themselves (leaving)
  const isSelf = userId === req.user._id.toString();

  // Check if requester is admin
  const isAdmin = chat.groupAdmins?.some(
    (admin) => admin.toString() === req.user._id.toString()
  ) || chat.groupAdmin?.toString() === req.user._id.toString();

  // Only allow if: user is leaving themselves OR user is admin removing someone else
  if (!isSelf && !isAdmin) {
    res.status(403);
    throw new Error("Only admins can remove members");
  }

  // If removing the original admin, prevent it unless they're leaving themselves
  if (userId === chat.groupAdmin?.toString() && !isSelf) {
    res.status(400);
    throw new Error("Cannot remove the group creator");
  }

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId, groupAdmins: userId },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  res.json(removed);
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  makeAdmin,
  removeAdmin,
  removeFromGroupEnhanced,
};
