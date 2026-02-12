import { AddIcon } from "@chakra-ui/icons";
import { Box, Stack, Text, Flex } from "@chakra-ui/layout";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import { Button, Avatar, Skeleton } from "@chakra-ui/react";
import { ChatState } from "../Context/ChatProvider";

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState();
  const [loading, setLoading] = useState(true);

  const { selectedChat, setSelectedChat, user, chats, setChats, fetchChatsFlag, onlineUsers } = ChatState();

  const toast = useToast();

  const fetchChats = useCallback(async () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const config = {
        headers: {
        Authorization: `Bearer ${user.token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      };

      const { data } = await axios.get("/api/chat", config);
      setChats(data);
    } catch (error) {
      toast({
        title: "Error loading chats",
        description: "Failed to load your conversations",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.token, setChats, toast]);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setLoggedUser(userInfo);
  }, []);

  useEffect(() => {
    if (user?.token) {
    fetchChats();
  }
  }, [user?.token, fetchAgain, fetchChatsFlag, fetchChats]);

  return (
    <Box
      display={{ base: selectedChat ? "none" : "flex", md: "flex" }}
      flexDir="column"
      p={{ base: 3, md: 4 }}
      bg="rgba(15, 15, 35, 0.8)"
      backdropFilter="blur(20px)"
      w={{ base: "100%", md: "35%", lg: "30%" }}
      borderRadius="2xl"
      border="1px solid rgba(255, 255, 255, 0.1)"
      boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
      h="100%"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        pb={3}
        px={2}
        justify="space-between"
        align="center"
      >
        <Flex align="center" gap={2}>
          <Text fontSize="xl">💬</Text>
          <Text
            fontSize={{ base: "lg", md: "xl" }}
            fontFamily="Poppins, sans-serif"
            fontWeight="700"
            bgGradient="linear(to-r, #a855f7, #ec4899)"
            bgClip="text"
      >
        My Chats
          </Text>
        </Flex>
        <GroupChatModal>
          <Button
            display="flex"
            fontSize={{ base: "xs", md: "sm" }}
            rightIcon={<AddIcon boxSize={3} />}
            size="sm"
            bgGradient="linear(to-r, #a855f7, #ec4899)"
            color="white"
            _hover={{
              bgGradient: "linear(to-r, #9333ea, #db2777)",
              transform: "translateY(-2px)",
              boxShadow: "0 4px 20px rgba(168, 85, 247, 0.4)",
            }}
            transition="all 0.2s"
            borderRadius="full"
            px={4}
          >
            New Group
          </Button>
        </GroupChatModal>
      </Flex>

      {/* Chat List */}
      <Box
        display="flex"
        flexDir="column"
        p={2}
        bg="rgba(0, 0, 0, 0.2)"
        w="100%"
        h="100%"
        borderRadius="xl"
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(168, 85, 247, 0.3)',
            borderRadius: '10px',
          },
        }}
      >
        {loading ? (
          <ChatLoading />
        ) : chats && chats.length > 0 ? (
          <Stack spacing={2}>
            {chats.map((chat) => (
              <Flex
                onClick={() => setSelectedChat(chat)}
                cursor="pointer"
                bg={
                  selectedChat === chat
                    ? "linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3))"
                    : "rgba(255, 255, 255, 0.05)"
                }
                color="white"
                px={4}
                py={3}
                borderRadius="xl"
                key={chat._id}
                border="1px solid"
                borderColor={
                  selectedChat === chat
                    ? "rgba(168, 85, 247, 0.5)"
                    : "rgba(255, 255, 255, 0.1)"
                }
                _hover={{
                  bg: selectedChat === chat
                    ? "linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.4))"
                    : "rgba(255, 255, 255, 0.1)",
                  transform: "translateX(5px)",
                  borderColor: "rgba(168, 85, 247, 0.3)",
                }}
                transition="all 0.2s"
                align="center"
                gap={3}
              >
                {/* Avatar with online indicator */}
                <Box position="relative">
                  <Avatar
                    size="sm"
                    name={!chat.isGroupChat ? getSender(loggedUser, chat.users) : chat.chatName}
                    bg={chat.isGroupChat ? "purple.500" : "pink.500"}
                    color="white"
                  />
                  {/* Online dot */}
                  {!chat.isGroupChat ? (
                    (() => {
                      const otherUser = getSenderFull(loggedUser, chat.users);
                      const isOnline = onlineUsers.includes(otherUser?._id);
                      return isOnline ? (
                        <Box
                          position="absolute"
                          bottom="0px"
                          right="0px"
                          w="10px"
                          h="10px"
                          bg="green.400"
                          borderRadius="full"
                          border="2px solid"
                          borderColor="rgba(15, 15, 35, 0.8)"
                          boxShadow="0 0 6px rgba(72, 187, 120, 0.6)"
                        />
                      ) : null;
                    })()
                  ) : (
                    (() => {
                      const onlineCount = chat.users?.filter(
                        (u) => onlineUsers.includes(u._id)
                      ).length || 0;
                      return onlineCount > 0 ? (
                        <Box
                          position="absolute"
                          bottom="0px"
                          right="0px"
                          w="10px"
                          h="10px"
                          bg="green.400"
                          borderRadius="full"
                          border="2px solid"
                          borderColor="rgba(15, 15, 35, 0.8)"
                          boxShadow="0 0 6px rgba(72, 187, 120, 0.6)"
                        />
                      ) : null;
                    })()
                  )}
                </Box>

                {/* Chat Info */}
                <Box flex="1" minW={0}>
                  <Flex align="center" gap={2}>
                    <Text fontWeight="600" fontSize={{ base: "sm", md: "md" }} isTruncated>
                      {!chat.isGroupChat ? (
                        getSender(loggedUser, chat.users)
                      ) : (
                        <>👥 {chat.chatName}</>
                      )}
                </Text>
                  </Flex>
                  {chat.latestMessage ? (
                    <Text
                      fontSize="xs"
                      color="gray.400"
                      isTruncated
                    >
                      <Text as="span" fontWeight="500" color="gray.300">
                        {chat.latestMessage.sender.name}:
                      </Text>{" "}
                      {chat.latestMessage.content.length > 30
                        ? chat.latestMessage.content.substring(0, 30) + "..."
                      : chat.latestMessage.content}
                  </Text>
                  ) : !chat.isGroupChat ? (
                    <Text fontSize="2xs" color={
                      onlineUsers.includes(getSenderFull(loggedUser, chat.users)?._id) ? "green.400" : "gray.500"
                    }>
                      {onlineUsers.includes(getSenderFull(loggedUser, chat.users)?._id) ? "Online" : "Offline"}
                    </Text>
                  ) : (
                    <Text fontSize="2xs" color="gray.500">
                      {chat.users?.filter((u) => onlineUsers.includes(u._id)).length || 0} online
                    </Text>
                )}
              </Box>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            h="100%"
            color="gray.500"
            textAlign="center"
            p={4}
          >
            <Text fontSize="4xl" mb={3}>💬</Text>
            <Text fontWeight="500">No conversations yet</Text>
            <Text fontSize="sm" mt={1}>Search for users to start chatting!</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default MyChats;
