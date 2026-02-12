/**
 * Script to delete all users from the database
 * Run with: node backend/scripts/deleteAllUsers.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const colors = require("colors");

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

const deleteAllData = async () => {
  try {
    await connectDB();
    
    // Delete all users
    const User = require("../models/userModel");
    const userResult = await User.deleteMany({});
    console.log(`Deleted ${userResult.deletedCount} users`.red.bold);
    
    // Delete all chats
    const Chat = require("../models/chatModel");
    const chatResult = await Chat.deleteMany({});
    console.log(`Deleted ${chatResult.deletedCount} chats`.red.bold);
    
    // Delete all messages
    const Message = require("../models/messageModel");
    const messageResult = await Message.deleteMany({});
    console.log(`Deleted ${messageResult.deletedCount} messages`.red.bold);
    
    console.log("\n✅ All data has been deleted successfully!".green.bold);
    console.log("You can now register with fresh, authentic users.".cyan);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Run the script
deleteAllData();

