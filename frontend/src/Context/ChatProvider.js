import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";

const ChatContext = createContext();

const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState();
  const [user, setUser] = useState();
  const [notification, setNotification] = useState([]);
  const [chats, setChats] = useState([]);
  const [fetchChatsFlag, setFetchChatsFlag] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const history = useHistory();

  // Function to trigger chat refresh
  const refreshChats = useCallback(() => {
    setFetchChatsFlag(prev => prev + 1);
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    if (userInfo) {
    setUser(userInfo);
    }
  }, []);

  // Redirect to login if no user and trying to access protected routes
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (!user && currentPath === "/chats") {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      if (!userInfo) {
        history.push("/");
      }
    }
  }, [user, history]);

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        user,
        setUser,
        notification,
        setNotification,
        chats,
        setChats,
        refreshChats,
        fetchChatsFlag,
        onlineUsers,
        setOnlineUsers,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const ChatState = () => {
  return useContext(ChatContext);
};

export default ChatProvider;
