import { Button } from "@chakra-ui/button";
import { useDisclosure } from "@chakra-ui/hooks";
import { Input, InputGroup, InputLeftElement } from "@chakra-ui/input";
import { Box, Text, Flex } from "@chakra-ui/layout";
import {
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
} from "@chakra-ui/menu";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/modal";
import { Tooltip } from "@chakra-ui/tooltip";
import { BellIcon, ChevronDownIcon, SearchIcon } from "@chakra-ui/icons";
import { Avatar } from "@chakra-ui/avatar";
import { useHistory } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/toast";
import ChatLoading from "../ChatLoading";
import { Spinner } from "@chakra-ui/spinner";
import ProfileModal from "./ProfileModal";
import NotificationBadge from "react-notification-badge";
import { Effect } from "react-notification-badge";
import { getSender } from "../../config/ChatLogics";
import UserListItem from "../userAvatar/UserListItem";
import { ChatState } from "../../Context/ChatProvider";

function SideDrawer() {
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const {
    setSelectedChat,
    user,
    notification,
    setNotification,
    chats,
    setChats,
  } = ChatState();

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const history = useHistory();

  const logoutHandler = () => {
    localStorage.removeItem("userInfo");
    history.push("/");
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      toast({
        title: "Please enter a name or email to search",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    try {
      setLoading(true);

      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      // Search works with both name and email (backend already supports this)
      const { data } = await axios.get(`/api/user?search=${search.trim()}`, config);

      setLoading(false);
      setSearchResult(data);
      
      if (data.length === 0) {
        toast({
          title: "No users found",
          description: "Try a different name or email",
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Please try again",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
      setLoading(false);
    }
  };

  // Handle Enter key press for search
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const accessChat = async (userId) => {
    try {
      setLoadingChat(true);
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.post(`/api/chat`, { userId }, config);

      if (!chats.find((c) => c._id === data._id)) setChats([data, ...chats]);
      setSelectedChat(data);
      setLoadingChat(false);
      onClose();
    } catch (error) {
      toast({
        title: "Error fetching the chat",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
      setLoadingChat(false);
    }
  };

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        bg="rgba(15, 15, 35, 0.95)"
        backdropFilter="blur(20px)"
        w="100%"
        p={{ base: "10px 15px", md: "12px 20px" }}
        boxShadow="0 4px 30px rgba(0, 0, 0, 0.3)"
        borderBottom="1px solid rgba(255, 255, 255, 0.1)"
        position="relative"
        zIndex={100}
      >
        <Tooltip label="Search Users by Name or Email" hasArrow placement="bottom-end">
          <Button
            variant="ghost"
            onClick={onOpen}
            size={{ base: "sm", md: "md" }}
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            borderRadius="full"
            leftIcon={<SearchIcon />}
          >
            <Text display={{ base: "none", md: "flex" }} fontWeight="500">
              Search User
            </Text>
          </Button>
        </Tooltip>
        
        <Flex align="center" gap={2}>
          <Text fontSize="2xl">💬</Text>
          <Text
            fontSize={{ base: "lg", md: "xl" }}
            fontFamily="Poppins, sans-serif"
            fontWeight="700"
            bgGradient="linear(to-r, #a855f7, #ec4899, #f97316)"
            bgClip="text"
          >
            Connect Hub
          </Text>
        </Flex>

        <Box display="flex" alignItems="center" gap={2} position="relative" zIndex={1000}>
          {/* Notifications Menu */}
          <Menu>
            <MenuButton
              p={2}
              position="relative"
              _hover={{ bg: "whiteAlpha.200" }}
              borderRadius="full"
              transition="all 0.2s"
            >
              <NotificationBadge
                count={notification.length}
                effect={Effect.SCALE}
              />
              <BellIcon fontSize="xl" color="white" />
            </MenuButton>
            <MenuList
              bg="rgba(20, 20, 40, 0.98)"
              backdropFilter="blur(20px)"
              border="1px solid rgba(255, 255, 255, 0.15)"
              borderRadius="xl"
              boxShadow="0 20px 50px rgba(0, 0, 0, 0.5)"
              p={2}
              zIndex={2000}
            >
              {!notification.length && (
                <Text p={3} color="gray.400" textAlign="center">
                  ✨ No New Messages
                </Text>
              )}
              {notification.map((notif) => (
                <MenuItem
                  key={notif._id}
                  onClick={() => {
                    setSelectedChat(notif.chat);
                    setNotification(notification.filter((n) => n !== notif));
                  }}
                  borderRadius="lg"
                  bg="transparent"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  mb={1}
                >
                  {notif.chat.isGroupChat
                    ? `👥 ${notif.chat.chatName}`
                    : `👤 ${getSender(user, notif.chat.users)}`}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>

          {/* Profile Menu */}
          <Menu>
            <MenuButton
              as={Button}
              bg="whiteAlpha.200"
              rightIcon={<ChevronDownIcon color="white" />}
              _hover={{ bg: "whiteAlpha.300" }}
              _active={{ bg: "whiteAlpha.300" }}
              borderRadius="full"
              p={1}
            >
              <Avatar
                size="sm"
                cursor="pointer"
                name={user.name}
                src={user.pic}
                border="2px solid"
                borderColor="purple.400"
              />
            </MenuButton>
            <MenuList
              bg="rgba(20, 20, 40, 0.98)"
              backdropFilter="blur(20px)"
              border="1px solid rgba(255, 255, 255, 0.15)"
              borderRadius="xl"
              boxShadow="0 20px 50px rgba(0, 0, 0, 0.5)"
              p={2}
              zIndex={2000}
            >
              <ProfileModal user={user}>
                <MenuItem
                  borderRadius="lg"
                  bg="transparent"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                >
                  👤 My Profile
                </MenuItem>
              </ProfileModal>
              <MenuDivider borderColor="whiteAlpha.200" />
              <MenuItem
                onClick={logoutHandler}
                borderRadius="lg"
                bg="transparent"
                color="white"
                _hover={{ bg: "red.500", color: "white" }}
              >
                🚪 Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </Box>

      {/* Search Drawer */}
      <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
        <DrawerContent
          bg="rgba(15, 15, 35, 0.98)"
          backdropFilter="blur(20px)"
          borderRightRadius="2xl"
          borderRight="1px solid rgba(255, 255, 255, 0.1)"
        >
          <DrawerHeader
            bgGradient="linear(to-r, purple.600, pink.600)"
            color="white"
            borderTopRightRadius="2xl"
            fontFamily="Poppins, sans-serif"
          >
            🔍 Search Users
          </DrawerHeader>
          <DrawerBody pt={4}>
            <Flex gap={2} mb={4}>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={handleKeyPress}
                  borderRadius="full"
                  bg="whiteAlpha.100"
                  border="1px solid rgba(255, 255, 255, 0.2)"
                  color="white"
                  _placeholder={{ color: "gray.400" }}
                  _hover={{ borderColor: "purple.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px #a855f7",
                    bg: "whiteAlpha.200",
                  }}
                />
              </InputGroup>
              <Button
                onClick={handleSearch}
                bgGradient="linear(to-r, purple.500, pink.500)"
                color="white"
                borderRadius="full"
                _hover={{
                  bgGradient: "linear(to-r, purple.600, pink.600)",
                  transform: "scale(1.05)",
                }}
                transition="all 0.2s"
                px={6}
              >
                Go
              </Button>
            </Flex>
            
            <Text fontSize="xs" color="gray.500" mb={4}>
              💡 Tip: Press Enter to search quickly
            </Text>

            {loading ? (
              <ChatLoading />
            ) : (
              searchResult?.map((searchUser) => (
                <UserListItem
                  key={searchUser._id}
                  user={searchUser}
                  handleFunction={() => accessChat(searchUser._id)}
                />
              ))
            )}
            {loadingChat && (
              <Flex justify="center" mt={4}>
                <Spinner color="purple.500" size="lg" />
              </Flex>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default SideDrawer;
