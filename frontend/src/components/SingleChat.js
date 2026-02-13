import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text, Flex, HStack } from "@chakra-ui/layout";
import { Tooltip } from "@chakra-ui/react";
import "./styles.css";
import {
  IconButton,
  Spinner,
  useToast,
  Progress,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  useDisclosure,
  Radio,
  RadioGroup,
  Stack,
} from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { ArrowBackIcon, AttachmentIcon, PhoneIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";
import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import MediaPermissions from "./Calling/MediaPermissions";
import VideoCall from "./Calling/VideoCall";
import MeetingRoom from "./Calling/MeetingRoom";
import CallNotification from "./Calling/CallNotification";
import EmojiPicker from "emoji-picker-react";

const ENDPOINT = process.env.NODE_ENV === "production"
  ? window.location.origin
  : "http://localhost:5000";

// Emoji Icon Component
const EmojiIcon = (props) => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" {...props}>
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
  </svg>
);

// Location Icon Component
const LocationIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="1.2em"
    height="1.2em"
    fill="currentColor"
    {...props}
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

// Video Icon Component
const VideoIcon = (props) => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" {...props}>
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
  </svg>
);

// Send Icon Component
const SendIcon = (props) => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" {...props}>
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

// Meeting Icon Component
const MeetingIcon = (props) => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" {...props}>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [liveLocationDuration, setLiveLocationDuration] = useState("15");
  
  // Calling states
  const [showPermissions, setShowPermissions] = useState(false);
  const [pendingCallType, setPendingCallType] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [callInfo, setCallInfo] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  
  // Active meeting state (for late-join)
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [joiningMeeting, setJoiningMeeting] = useState(false);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  
  const toast = useToast();
  const { isOpen: isLocationOpen, onOpen: onLocationOpen, onClose: onLocationClose } = useDisclosure();

  const socket = useRef();
  const selectedChatCompare = useRef();
  const fileInputRef = useRef();
  const liveLocationInterval = useRef(null);

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  const { selectedChat, setSelectedChat, user, notification, setNotification, onlineUsers, setOnlineUsers } =
    ChatState();

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      setLoading(true);

      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(data);
      setLoading(false);

      // UPDATED: Use socket.current
      socket.current.emit("join chat", selectedChat._id);
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: "Failed to Load the Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage) return;
      socket.current.emit("stop typing", selectedChat._id);
      try {
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        const messageContent = newMessage;
        setNewMessage("");
        const { data } = await axios.post(
          "/api/message",
          {
            content: messageContent,
            chatId: selectedChat._id,
          },
          config
        );
        socket.current.emit("new message", data);
        setMessages([...messages, data]);
      } catch (error) {
        toast({
          title: "Error Occured!",
          description: "Failed to send the Message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
    }
  };

  useEffect(() => {
    // UPDATED: Use socket.current
    socket.current = io(ENDPOINT);
    socket.current.emit("setup", user);
    socket.current.on("connected", () => setSocketConnected(true));
    socket.current.on("typing", () => setIsTyping(true));
    socket.current.on("stop typing", () => setIsTyping(false));

    // Listen for online users updates
    socket.current.on("online users updated", (users) => {
      setOnlineUsers(users);
    });

    // Cleanup on component unmount
    return () => {
        socket.current.disconnect();
    }
  }, [user, setOnlineUsers]);

  useEffect(() => {
    fetchMessages();
    // UPDATED: Use selectedChatCompare.current
    selectedChatCompare.current = selectedChat;

    // Check for active meetings in group chats
    if (selectedChat?.isGroupChat && socket.current) {
      socket.current.emit("meeting:check-active", { chatId: selectedChat._id });
    } else {
      setActiveMeeting(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]);

  // FULLY CORRECTED useEffect for receiving messages
  useEffect(() => {
    if (!socket.current) return;

    const messageReceivedHandler = (newMessageRecieved) => {
      // UPDATED: Use selectedChatCompare.current
      if (
        !selectedChatCompare.current ||
        selectedChatCompare.current._id !== newMessageRecieved.chat._id
      ) {
        // FIXED: Duplicate key issue by checking with .find()
        if (!notification.find((n) => n._id === newMessageRecieved._id)) {
          setNotification([newMessageRecieved, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
      }
    };

    socket.current.on("message recieved", messageReceivedHandler);

    // FIXED: Memory leak by cleaning up the listener
    return () => {
      socket.current.off("message recieved", messageReceivedHandler);
    };
  }, [notification, fetchAgain, setFetchAgain, setNotification]);

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.current.emit("typing", selectedChat._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.current.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", "chat-app");
      data.append("cloud_name", "dejog9zgj");

      // Determine resource type based on file
      let resourceType = "auto";
      if (file.type.startsWith("video/")) {
        resourceType = "video";
      } else if (file.type.startsWith("image/")) {
        resourceType = "image";
      }

      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/dejog9zgj/${resourceType}/upload`,
        data,
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      const fileUrl = uploadRes.data.secure_url;

      // Send file message to backend
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data: messageData } = await axios.post(
        "/api/message/file",
        {
          chatId: selectedChat._id,
          fileUrl: fileUrl,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          content: file.name,
        },
        config
      );

      socket.current.emit("new message", messageData);
      setMessages([...messages, messageData]);

      toast({
        title: "File sent successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error uploading file",
        description: error.message || "Failed to upload file",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Get current position promise wrapper
  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  // Send current location
  const sendCurrentLocation = async () => {
    setSendingLocation(true);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.post(
        "/api/message/location",
        {
          chatId: selectedChat._id,
          latitude,
          longitude,
          isLive: false,
        },
        config
      );

      socket.current.emit("new message", data);
      setMessages([...messages, data]);

      toast({
        title: "Location shared!",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      let errorMsg = "Failed to get location";
      if (error.code === 1) {
        errorMsg = "Location permission denied. Please enable location access.";
      } else if (error.code === 2) {
        errorMsg = "Location unavailable. Please try again.";
      } else if (error.code === 3) {
        errorMsg = "Location request timed out.";
      }
      toast({
        title: "Error",
        description: errorMsg,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setSendingLocation(false);
    }
  };

  // Send live location
  const sendLiveLocation = async () => {
    setSendingLocation(true);
    onLocationClose();

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.post(
        "/api/message/location",
        {
          chatId: selectedChat._id,
          latitude,
          longitude,
          isLive: true,
          duration: parseInt(liveLocationDuration),
        },
        config
      );

      socket.current.emit("new message", data);
      setMessages([...messages, data]);

      // Start updating live location
      const messageId = data._id;
      const durationMs = parseInt(liveLocationDuration) * 60 * 1000;
      const endTime = Date.now() + durationMs;

      liveLocationInterval.current = setInterval(async () => {
        if (Date.now() >= endTime) {
          clearInterval(liveLocationInterval.current);
          toast({
            title: "Live location sharing ended",
            status: "info",
            duration: 3000,
            isClosable: true,
            position: "bottom",
          });
          return;
        }

        try {
          const pos = await getCurrentPosition();
          await axios.put(
            `/api/message/location/${messageId}`,
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            },
            config
          );
          // Emit location update through socket
          socket.current.emit("location update", {
            messageId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            chatId: selectedChat._id,
          });
        } catch (err) {
          console.error("Failed to update live location:", err);
        }
      }, 10000); // Update every 10 seconds

      toast({
        title: `Live location sharing started for ${liveLocationDuration} minutes`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      let errorMsg = "Failed to start live location";
      if (error.code === 1) {
        errorMsg = "Location permission denied. Please enable location access.";
      }
      toast({
        title: "Error",
        description: errorMsg,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setSendingLocation(false);
    }
  };

  // Cleanup live location on unmount
  useEffect(() => {
    return () => {
      if (liveLocationInterval.current) {
        clearInterval(liveLocationInterval.current);
      }
    };
  }, []);

  // Handle emoji selection
  const handleEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Call/Meeting handlers
  const initiateCall = (callType) => {
    setPendingCallType(callType);
    setShowPermissions(true);
  };

  const handlePermissionGranted = () => {
    setShowPermissions(false);
    
    if (pendingCallType === "meeting" || pendingCallType === "group-voice" || pendingCallType === "group-video") {
      // Start group meeting with the appropriate mode
      startMeeting(pendingCallType);
    } else {
      // Start one-to-one call
      startCall(pendingCallType);
    }
  };

  const startCall = (callType) => {
    if (!selectedChat || selectedChat.isGroupChat) return;
    
    const recipient = getSenderFull(user, selectedChat.users);
    
    setCallInfo({
      recipientId: recipient._id,
      recipientInfo: {
        name: recipient.name,
        pic: recipient.pic,
        email: recipient.email,
      },
      callerInfo: {
        name: user.name,
        pic: user.pic,
        email: user.email,
      },
      callType,
    });
    setIsInCall(true);
  };

  const startMeeting = (meetingType = "meeting") => {
    if (!selectedChat || !selectedChat.isGroupChat) return;
    
    socket.current.emit("meeting:create", {
      chatId: selectedChat._id,
      creatorInfo: {
        name: user.name,
        pic: user.pic,
      },
      meetingType, // "meeting", "group-voice", or "group-video"
    });
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      setCallInfo({
        ...incomingCall,
        callerId: incomingCall.from,
        callerInfo: incomingCall.callerInfo,
      });
      setIsInCall(true);
      setIncomingCall(null);
    }
  };

  const handleRejectCall = () => {
    if (incomingCall && socket.current) {
      socket.current.emit("call:reject", {
        callId: incomingCall.callId,
        to: incomingCall.from,
        reason: "declined",
      });
    }
    setIncomingCall(null);
  };

  // Join an active meeting (late-join)
  const joinActiveMeeting = () => {
    if (!activeMeeting || isInMeeting) return;
    setJoiningMeeting(true);
    setMeetingInfo({
      meetingId: activeMeeting.meetingId,
      chatName: selectedChat?.chatName,
      chatId: selectedChat?._id,
      meetingType: activeMeeting.meetingType || "meeting",
    });
    setIsInMeeting(true);
    setJoiningMeeting(false);
  };

  // CRITICAL: Listen for incoming calls - STABLE listener that never re-registers
  // This must NOT depend on selectedChat to avoid missing calls during chat switches
  useEffect(() => {
    if (!socket.current) return;

    const handleIncomingCall = (callData) => {
      console.log("📞 Incoming call received:", callData);
      setIncomingCall(callData);
    };

    socket.current.on("call:incoming", handleIncomingCall);

    return () => {
      if (socket.current) {
        socket.current.off("call:incoming", handleIncomingCall);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected]); // Only re-register when socket connects

  // Listen for meeting events (these can depend on selectedChat)
  useEffect(() => {
    if (!socket.current) return;

    const handleMeetingCreated = ({ meetingId, meetingType }) => {
      const chatRef = selectedChatCompare.current;
      setMeetingInfo({
        meetingId,
        chatName: chatRef?.chatName,
        chatId: chatRef?._id,
        meetingType: meetingType || "meeting",
      });
      setIsInMeeting(true);
      
      const titles = {
        "group-voice": "Group Voice Call Started! 📞",
        "group-video": "Group Video Call Started! 📹",
        "meeting": "Meeting Started! 🎥",
      };
      
      toast({
        title: titles[meetingType] || titles["meeting"],
        description: "Other members will be notified",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    };

    const handleMeetingStarted = ({ meetingId, chatId, creatorInfo, meetingType }) => {
      setActiveMeeting({
        meetingId,
        chatId,
        meetingType: meetingType || "meeting",
        creatorInfo,
        participantCount: 1,
      });

      const labels = {
        "group-voice": "a group voice call",
        "group-video": "a group video call",
        "meeting": "a meeting",
      };
      
      toast({
        title: `${creatorInfo.name} started ${labels[meetingType] || labels["meeting"]}`,
        description: "Click 'Join' to enter the call",
        status: "info",
        duration: 10000,
        isClosable: true,
        position: "top",
      });
    };

    const handleActiveStatus = ({ chatId, activeMeeting: meetingData }) => {
      const chatRef = selectedChatCompare.current;
      if (chatId === chatRef?._id) {
        setActiveMeeting(meetingData);
      }
    };

    socket.current.on("meeting:created", handleMeetingCreated);
    socket.current.on("meeting:started", handleMeetingStarted);
    socket.current.on("meeting:active-status", handleActiveStatus);

    return () => {
      if (socket.current) {
        socket.current.off("meeting:created", handleMeetingCreated);
        socket.current.off("meeting:started", handleMeetingStarted);
        socket.current.off("meeting:active-status", handleActiveStatus);
      }
    };
  }, [selectedChat, toast]);

  return (
    <>
      {selectedChat ? (
        <>
          <Flex
            fontSize={{ base: "16px", md: "20px" }}
            pb={3}
            px={{ base: 2, md: 4 }}
            w="100%"
            fontFamily="Poppins, sans-serif"
            justifyContent="space-between"
            alignItems="center"
            bg="rgba(0, 0, 0, 0.3)"
            borderRadius="xl"
            border="1px solid rgba(255, 255, 255, 0.1)"
            mb={2}
            py={3}
          >
            <HStack>
            <IconButton
                display={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
                size="sm"
                variant="ghost"
                color="white"
                _hover={{ bg: "whiteAlpha.200" }}
              />
              <Box>
                <Text
                  fontWeight="600"
                  color="white"
                  bgGradient="linear(to-r, #a855f7, #ec4899)"
                  bgClip="text"
                  fontSize={{ base: "sm", md: "md" }}
                  isTruncated
                  maxW={{ base: "120px", sm: "180px", md: "300px" }}
                >
                  {!selectedChat.isGroupChat
                    ? getSender(user, selectedChat.users)
                    : `👥 ${selectedChat.chatName}`}
                </Text>
                {/* Online status indicator */}
                {!selectedChat.isGroupChat ? (
                  (() => {
                    const otherUser = getSenderFull(user, selectedChat.users);
                    const isOnline = onlineUsers.includes(otherUser._id);
                    return (
                      <Flex align="center" gap={1} mt={0.5}>
                        <Box
                          w="7px"
                          h="7px"
                          borderRadius="full"
                          bg={isOnline ? "green.400" : "gray.500"}
                          boxShadow={isOnline ? "0 0 6px rgba(72, 187, 120, 0.6)" : "none"}
                        />
                        <Text fontSize="2xs" color={isOnline ? "green.400" : "gray.500"} fontWeight="500">
                          {isOnline ? "Online" : "Offline"}
                        </Text>
                      </Flex>
                    );
                  })()
                ) : (
                  (() => {
                    const onlineCount = selectedChat.users.filter(
                      (u) => onlineUsers.includes(u._id)
                    ).length;
                    return (
                      <Flex align="center" gap={1} mt={0.5}>
                        <Box
                          w="7px"
                          h="7px"
                          borderRadius="full"
                          bg={onlineCount > 0 ? "green.400" : "gray.500"}
                          boxShadow={onlineCount > 0 ? "0 0 6px rgba(72, 187, 120, 0.6)" : "none"}
                        />
                        <Text fontSize="2xs" color="gray.400" fontWeight="500">
                          {onlineCount} of {selectedChat.users.length} online
                        </Text>
                      </Flex>
                    );
                  })()
                )}
              </Box>
            </HStack>
            
            <HStack spacing={{ base: 0, md: 1 }} flexShrink={0}>
              {/* Call Buttons */}
              {!selectedChat.isGroupChat ? (
                // One-to-one chat: Voice and Video call buttons
                <>
                  <Tooltip label="Voice Call" placement="bottom">
                    <IconButton
                      icon={<PhoneIcon />}
                      onClick={() => initiateCall("voice")}
                      size="sm"
                      variant="ghost"
                      color="green.400"
                      _hover={{ bg: "whiteAlpha.200", color: "green.300" }}
                      borderRadius="full"
                      aria-label="Voice Call"
                    />
                  </Tooltip>
                  <Tooltip label="Video Call" placement="bottom">
                    <IconButton
                      icon={<VideoIcon />}
                      onClick={() => initiateCall("video")}
                      size="sm"
                      variant="ghost"
                      color="blue.400"
                      _hover={{ bg: "whiteAlpha.200", color: "blue.300" }}
                      borderRadius="full"
                      aria-label="Video Call"
                    />
                  </Tooltip>
                  <ProfileModal user={getSenderFull(user, selectedChat.users)} />
                </>
              ) : (
                // Group chat: Voice Call, Video Call, and Meeting buttons
                <>
                  <Tooltip label="Group Voice Call" placement="bottom">
                    <IconButton
                      icon={<PhoneIcon />}
                      onClick={() => initiateCall("group-voice")}
                      size="sm"
                      variant="ghost"
                      color="green.400"
                      _hover={{ bg: "whiteAlpha.200", color: "green.300" }}
                      borderRadius="full"
                      aria-label="Group Voice Call"
                      minW={{ base: "32px", md: "40px" }}
                    />
                  </Tooltip>
                  <Tooltip label="Group Video Call" placement="bottom">
                    <IconButton
                      icon={<VideoIcon />}
                      onClick={() => initiateCall("group-video")}
                      size="sm"
                      variant="ghost"
                      color="blue.400"
                      _hover={{ bg: "whiteAlpha.200", color: "blue.300" }}
                      borderRadius="full"
                      aria-label="Group Video Call"
                      minW={{ base: "32px", md: "40px" }}
                    />
                  </Tooltip>
                  <Tooltip label="Start Meeting" placement="bottom">
                    <IconButton
                      icon={<MeetingIcon />}
                      onClick={() => initiateCall("meeting")}
                      size="sm"
                      variant="ghost"
                      color="purple.400"
                      _hover={{ bg: "whiteAlpha.200", color: "purple.300" }}
                      borderRadius="full"
                      aria-label="Start Meeting"
                      minW={{ base: "32px", md: "40px" }}
                    />
                  </Tooltip>
                  <UpdateGroupChatModal
                    fetchMessages={fetchMessages}
                    fetchAgain={fetchAgain}
                    setFetchAgain={setFetchAgain}
                  />
                </>
              )}
            </HStack>
          </Flex>
          {/* Active Meeting Join Banner */}
          {selectedChat?.isGroupChat && activeMeeting && !isInMeeting && (
            <Flex
              bg="linear-gradient(135deg, rgba(72, 187, 120, 0.15), rgba(56, 178, 172, 0.15))"
              border="1px solid rgba(72, 187, 120, 0.4)"
              borderRadius="xl"
              p={3}
              mb={2}
              align="center"
              justify="space-between"
              gap={2}
            >
              <Flex align="center" gap={2} flex="1" minW={0}>
                <Text fontSize="xl">
                  {activeMeeting.meetingType === "group-voice" ? "📞" :
                   activeMeeting.meetingType === "group-video" ? "📹" : "🎥"}
                </Text>
                <Box minW={0}>
                  <Text color="green.300" fontWeight="600" fontSize={{ base: "xs", md: "sm" }} isTruncated>
                    {activeMeeting.meetingType === "group-voice" ? "Voice Call" :
                     activeMeeting.meetingType === "group-video" ? "Video Call" : "Meeting"} in progress
                  </Text>
                  <Text color="gray.400" fontSize="2xs">
                    {activeMeeting.participantCount || 1} participant{(activeMeeting.participantCount || 1) > 1 ? "s" : ""}
          </Text>
                </Box>
              </Flex>
              <Button
                size="sm"
                colorScheme="green"
                borderRadius="full"
                onClick={joinActiveMeeting}
                isLoading={joiningMeeting}
                loadingText="Joining..."
                flexShrink={0}
              >
                Join
              </Button>
            </Flex>
          )}

          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"  
            p={{ base: 2, md: 3 }}
            bg="rgba(0, 0, 0, 0.2)"
            w="100%"
            h="100%"
            borderRadius="xl"
            overflowY="hidden"
            border="1px solid rgba(255, 255, 255, 0.05)"
          >
            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
                color="purple.400"
                thickness="4px"
              />
            ) : (
              <div className="messages">
                <ScrollableChat messages={messages} />
              </div>
            )}
            <FormControl isRequired mt={3}>
              {istyping ? (
                <div>
                  <Lottie
                    options={defaultOptions}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              ) : null}
              {(uploading || sendingLocation) && (
                <Progress
                  value={uploading ? uploadProgress : undefined}
                  isIndeterminate={sendingLocation}
                  size="xs"
                  colorScheme="purple"
                  mb={2}
                  borderRadius="md"
                  bg="rgba(255, 255, 255, 0.1)"
                />
              )}
              <Flex
                alignItems="center"
                gap={2}
                bg="rgba(255, 255, 255, 0.08)"
                border="1px solid rgba(255, 255, 255, 0.15)"
                p={2}
                borderRadius="full"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
                <IconButton
                  icon={<AttachmentIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={uploading}
                  variant="ghost"
                  color="purple.400"
                  _hover={{ bg: "whiteAlpha.200", color: "purple.300" }}
                  aria-label="Attach file"
                  size={{ base: "sm", md: "md" }}
                  borderRadius="full"
                />
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<LocationIcon />}
                    variant="ghost"
                    color="pink.400"
                    _hover={{ bg: "whiteAlpha.200", color: "pink.300" }}
                    aria-label="Share location"
                    size={{ base: "sm", md: "md" }}
                    borderRadius="full"
                    isLoading={sendingLocation}
                  />
                  <MenuList
                    bg="rgba(20, 20, 40, 0.98)"
                    backdropFilter="blur(20px)"
                    border="1px solid rgba(255, 255, 255, 0.15)"
                    borderRadius="xl"
                    boxShadow="0 20px 50px rgba(0, 0, 0, 0.5)"
                    p={2}
                  >
                    <MenuItem
                      icon={<LocationIcon />}
                      onClick={sendCurrentLocation}
                      bg="transparent"
                      color="white"
                      _hover={{ bg: "whiteAlpha.200" }}
                      borderRadius="lg"
                    >
                      📍 Share Current Location
                    </MenuItem>
                    <MenuItem
                      icon={<LocationIcon />}
                      onClick={onLocationOpen}
                      bg="transparent"
                      color="white"
                      _hover={{ bg: "whiteAlpha.200" }}
                      borderRadius="lg"
                    >
                      🔴 Share Live Location
                    </MenuItem>
                  </MenuList>
                </Menu>
                
                {/* Emoji Picker Button */}
                <Box position="relative">
                  <IconButton
                    icon={<EmojiIcon />}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    variant="ghost"
                    color="yellow.400"
                    _hover={{ bg: "whiteAlpha.200", color: "yellow.300" }}
                    aria-label="Add emoji"
                    size={{ base: "sm", md: "md" }}
                    borderRadius="full"
                  />
                  
                  {/* Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <Box
                      ref={emojiPickerRef}
                      position="fixed"
                      bottom={{ base: "70px", md: "80px" }}
                      left={{ base: "50%", md: "auto" }}
                      transform={{ base: "translateX(-50%)", md: "none" }}
                      zIndex={1000}
                      boxShadow="0 10px 40px rgba(0,0,0,0.5)"
                      borderRadius="xl"
                      overflow="hidden"
                      maxW={{ base: "90vw", md: "none" }}
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme="dark"
                        emojiStyle="native"
                        width={typeof window !== "undefined" && window.innerWidth < 480 ? 280 : 300}
                        height={typeof window !== "undefined" && window.innerWidth < 480 ? 300 : 350}
                        searchPlaceholder="Search emoji..."
                        previewConfig={{ showPreview: false }}
                      />
                    </Box>
                  )}
                </Box>
                
              <Input
                  variant="unstyled"
                  placeholder="Type a message..."
                value={newMessage}
                onChange={typingHandler}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  flex="1"
                  px={3}
                  fontSize={{ base: "sm", md: "md" }}
                  color="white"
                  _placeholder={{ color: "gray.500" }}
                />
                <IconButton
                  icon={<SendIcon />}
                  onClick={sendMessage}
                  bg={newMessage ? "linear-gradient(135deg, #a855f7, #ec4899)" : "transparent"}
                  color={newMessage ? "white" : "gray.600"}
                  _hover={{
                    bg: newMessage ? "linear-gradient(135deg, #9333ea, #db2777)" : "transparent",
                    color: newMessage ? "white" : "gray.600",
                    transform: newMessage ? "scale(1.1)" : "none",
                  }}
                  aria-label="Send message"
                  size={{ base: "sm", md: "md" }}
                  borderRadius="full"
                  isDisabled={!newMessage}
                  transition="all 0.2s"
                  boxShadow={newMessage ? "0 4px 15px rgba(168, 85, 247, 0.4)" : "none"}
                />
              </Flex>
            </FormControl>
          </Box>
        </>
      ) : (
        <Box
          display="flex"
          flexDir="column"
          alignItems="center"
          justifyContent="center"
          h="100%"
          bg="rgba(0, 0, 0, 0.2)"
          borderRadius="xl"
          border="1px solid rgba(255, 255, 255, 0.05)"
        >
          <Text fontSize="6xl" mb={4}>💬</Text>
          <Text
            fontSize={{ base: "lg", md: "2xl" }}
            fontFamily="Poppins, sans-serif"
            textAlign="center"
            px={4}
            bgGradient="linear(to-r, #a855f7, #ec4899)"
            bgClip="text"
            fontWeight="600"
          >
            Select a chat to start messaging
          </Text>
          <Text color="gray.500" fontSize="sm" mt={2}>
            Choose from your existing conversations
          </Text>
        </Box>
      )}

      {/* Live Location Duration Modal */}
      <Modal isOpen={isLocationOpen} onClose={onLocationClose} isCentered size={{ base: "sm", md: "md" }}>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
        <ModalContent
          bg="rgba(20, 20, 40, 0.98)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          borderRadius="2xl"
          mx={4}
        >
          <ModalHeader
            bgGradient="linear(to-r, #ec4899, #a855f7)"
            color="white"
            borderTopRadius="2xl"
          >
            🔴 Share Live Location
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody py={6}>
            <Text mb={4} color="gray.300">
              Share your real-time location for:
            </Text>
            <RadioGroup onChange={setLiveLocationDuration} value={liveLocationDuration}>
              <Stack spacing={3}>
                <Radio value="15" colorScheme="purple" size="lg" color="white">
                  <Text color="white">15 minutes</Text>
                </Radio>
                <Radio value="30" colorScheme="purple" size="lg">
                  <Text color="white">30 minutes</Text>
                </Radio>
                <Radio value="60" colorScheme="purple" size="lg">
                  <Text color="white">1 hour</Text>
                </Radio>
                <Radio value="480" colorScheme="purple" size="lg">
                  <Text color="white">8 hours</Text>
                </Radio>
              </Stack>
            </RadioGroup>
          </ModalBody>
          <ModalFooter borderTop="1px solid rgba(255, 255, 255, 0.1)">
            <Button
              variant="ghost"
              mr={3}
              onClick={onLocationClose}
              color="gray.400"
              _hover={{ bg: "whiteAlpha.100" }}
            >
              Cancel
            </Button>
            <Button
              bgGradient="linear(to-r, #ec4899, #a855f7)"
              color="white"
              onClick={sendLiveLocation}
              isLoading={sendingLocation}
              _hover={{ bgGradient: "linear(to-r, #db2777, #9333ea)" }}
            >
              Start Sharing
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Media Permissions Modal */}
      <MediaPermissions
        isOpen={showPermissions}
        onClose={() => setShowPermissions(false)}
        onPermissionGranted={handlePermissionGranted}
        callType={pendingCallType === "voice" || pendingCallType === "group-voice" ? "voice" : "video"}
      />

      {/* Video/Voice Call */}
      {isInCall && callInfo && (
        <VideoCall
          isOpen={isInCall}
          onClose={() => {
            setIsInCall(false);
            setCallInfo(null);
          }}
          socket={socket.current}
          callInfo={callInfo}
          isIncoming={!!callInfo.callerId}
          callType={callInfo.callType || "video"}
          chatId={selectedChat?._id}
          userToken={user?.token}
          onCallEnded={(callMsg) => {
            if (callMsg) setMessages((prev) => [...prev, callMsg]);
          }}
        />
      )}

      {/* Group Meeting */}
      {isInMeeting && meetingInfo && (
        <MeetingRoom
          isOpen={isInMeeting}
          onClose={() => {
            setIsInMeeting(false);
            setMeetingInfo(null);
            setActiveMeeting(null);
          }}
          socket={socket.current}
          meetingInfo={meetingInfo}
          user={user}
          onCallEnded={(callMsg) => {
            if (callMsg) setMessages((prev) => [...prev, callMsg]);
          }}
        />
      )}

      {/* Incoming Call Notification */}
      <CallNotification
        isOpen={!!incomingCall}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
        callerInfo={incomingCall?.callerInfo}
        callType={incomingCall?.callType}
      />
    </>
  );
};

export default SingleChat;