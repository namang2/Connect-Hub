import { ViewIcon, SearchIcon, EditIcon } from "@chakra-ui/icons";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  FormControl,
  Input,
  useToast,
  Box,
  IconButton,
  Spinner,
  Text,
  VStack,
  Flex,
  Divider,
  InputGroup,
  InputLeftElement,
  Avatar,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
  HStack,
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import { ChatState } from "../../Context/ChatProvider";
import UserBadgeItem from "../userAvatar/UserBadgeItem";
import UserListItem from "../userAvatar/UserListItem";

// Member Card Component with admin controls and online status
const MemberCard = ({ member, isAdmin, isCreator, currentUserId, creatorId, onRemove, onMakeAdmin, onRemoveAdmin, loading, isOnline }) => {
  const isCurrentUser = member._id === currentUserId;
  const isMemberCreator = member._id === creatorId;
  const canManageAdmin = isCreator && !isMemberCreator; // Only creator can manage admin rights
  const canRemove = (isAdmin || isCreator) && !isMemberCreator; // Admins can remove, but not the creator

  return (
    <Flex
      align="center"
      p={3}
      bg="rgba(255, 255, 255, 0.05)"
      borderRadius="xl"
      border="1px solid"
      borderColor={isAdmin ? "rgba(168, 85, 247, 0.3)" : "rgba(255, 255, 255, 0.1)"}
      _hover={{ bg: "rgba(255, 255, 255, 0.08)" }}
      transition="all 0.2s"
    >
      {/* Avatar with online dot */}
      <Box position="relative" mr={3}>
        <Avatar size="sm" name={member.name} src={member.pic} />
        <Box
          position="absolute"
          bottom="0px"
          right="0px"
          w="10px"
          h="10px"
          bg={isOnline ? "green.400" : "gray.500"}
          borderRadius="full"
          border="2px solid rgba(15, 15, 35, 1)"
          boxShadow={isOnline ? "0 0 6px rgba(72, 187, 120, 0.6)" : "none"}
        />
      </Box>
      
      <Box flex="1">
        <Flex align="center" gap={2} flexWrap="wrap">
          <Text color="white" fontWeight="500" fontSize="sm">
            {member.name}
            {isCurrentUser && (
              <Text as="span" color="gray.500" fontSize="xs" ml={1}>
                (You)
              </Text>
            )}
          </Text>
          {isMemberCreator && (
            <Badge colorScheme="purple" fontSize="xs" borderRadius="full">
              👑 Creator
            </Badge>
          )}
          {isAdmin && !isMemberCreator && (
            <Badge colorScheme="pink" fontSize="xs" borderRadius="full">
              ⭐ Admin
            </Badge>
          )}
        </Flex>
        <Flex align="center" gap={2}>
          <Text color="gray.500" fontSize="xs" isTruncated>
            {member.email}
          </Text>
          <Text fontSize="2xs" color={isOnline ? "green.400" : "gray.500"} fontWeight="500" flexShrink={0}>
            • {isOnline ? "Online" : "Offline"}
          </Text>
        </Flex>
      </Box>

      {/* Admin actions menu */}
      {(canManageAdmin || canRemove) && !isCurrentUser && (
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<Text>⋮</Text>}
            variant="ghost"
            size="sm"
            color="gray.400"
            _hover={{ bg: "whiteAlpha.200" }}
            isLoading={loading}
          />
          <MenuList
            bg="rgba(15, 15, 35, 0.98)"
            border="1px solid rgba(255, 255, 255, 0.1)"
            borderRadius="xl"
            py={2}
          >
            {canManageAdmin && (
              <>
                {isAdmin ? (
                  <MenuItem
                    onClick={() => onRemoveAdmin(member)}
                    bg="transparent"
                    color="orange.400"
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    ⬇️ Remove Admin
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() => onMakeAdmin(member)}
                    bg="transparent"
                    color="purple.400"
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    ⭐ Make Admin
                  </MenuItem>
                )}
              </>
            )}
            {canRemove && (
              <MenuItem
                onClick={() => onRemove(member)}
                bg="transparent"
                color="red.400"
                _hover={{ bg: "whiteAlpha.100" }}
              >
                🚫 Remove from Group
              </MenuItem>
            )}
          </MenuList>
        </Menu>
      )}
    </Flex>
  );
};

const UpdateGroupChatModal = ({ fetchMessages, fetchAgain, setFetchAgain }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [groupChatName, setGroupChatName] = useState("");
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renameloading, setRenameLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  const { selectedChat, setSelectedChat, user, onlineUsers } = ChatState();

  // Check if current user is admin
  const isCurrentUserAdmin = () => {
    if (!selectedChat) return false;
    const isCreator = selectedChat.groupAdmin?._id === user._id;
    const isInAdminList = selectedChat.groupAdmins?.some(
      (admin) => admin._id === user._id || admin === user._id
    );
    return isCreator || isInAdminList;
  };

  // Check if current user is the creator
  const isCurrentUserCreator = () => {
    return selectedChat?.groupAdmin?._id === user._id;
  };

  // Check if a member is an admin
  const isMemberAdmin = (memberId) => {
    if (!selectedChat) return false;
    const isCreator = selectedChat.groupAdmin?._id === memberId;
    const isInAdminList = selectedChat.groupAdmins?.some(
      (admin) => admin._id === memberId || admin === memberId
    );
    return isCreator || isInAdminList;
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) {
      setSearchResult([]);
      return;
    }

    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      toast({
        title: "Error loading users",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!groupChatName) return;

    try {
      setRenameLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.put(
        `/api/chat/rename`,
        {
          chatId: selectedChat._id,
          chatName: groupChatName,
        },
        config
      );

      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      setRenameLoading(false);
      toast({
        title: "Group renamed! ✨",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error renaming group",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setRenameLoading(false);
    }
    setGroupChatName("");
  };

  const handleAddUser = async (user1) => {
    if (selectedChat.users.find((u) => u._id === user1._id)) {
      toast({
        title: "User already in group",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    if (!isCurrentUserAdmin()) {
      toast({
        title: "Only admins can add members",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
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
      const { data } = await axios.put(
        `/api/chat/groupadd`,
        {
          chatId: selectedChat._id,
          userId: user1._id,
        },
        config
      );

      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      setLoading(false);
      toast({
        title: `${user1.name} added! 🎉`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error adding user",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
    }
    setSearch("");
    setSearchResult([]);
  };

  const handleRemove = async (user1) => {
    const isSelf = user1._id === user._id;
    
    if (!isSelf && !isCurrentUserAdmin()) {
      toast({
        title: "Only admins can remove members",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    // Prevent removing the creator
    if (user1._id === selectedChat.groupAdmin?._id && !isSelf) {
      toast({
        title: "Cannot remove the group creator",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.put(
        `/api/chat/groupremove`,
        {
          chatId: selectedChat._id,
          userId: user1._id,
        },
        config
      );

      if (isSelf) {
        setSelectedChat();
        onClose();
      } else {
        setSelectedChat(data);
      }
      setFetchAgain(!fetchAgain);
      fetchMessages();
      setActionLoading(false);
      
      if (!isSelf) {
        toast({
          title: `${user1.name} removed from group`,
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "bottom",
        });
      }
    } catch (error) {
      toast({
        title: "Error removing user",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoading(false);
    }
  };

  const handleMakeAdmin = async (member) => {
    if (!isCurrentUserCreator() && !isCurrentUserAdmin()) {
      toast({
        title: "Only admins can promote members",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.put(
        `/api/chat/makeadmin`,
        {
          chatId: selectedChat._id,
          userId: member._id,
        },
        config
      );

      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      setActionLoading(false);
      toast({
        title: `${member.name} is now an admin! ⭐`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error making admin",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (member) => {
    if (!isCurrentUserCreator()) {
      toast({
        title: "Only the creator can remove admins",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.put(
        `/api/chat/removeadmin`,
        {
          chatId: selectedChat._id,
          userId: member._id,
        },
        config
      );

      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      setActionLoading(false);
      toast({
        title: `${member.name} is no longer an admin`,
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error removing admin",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoading(false);
    }
  };

  return (
    <>
      <IconButton
        display="flex"
        icon={<ViewIcon />}
        onClick={onOpen}
        size={{ base: "sm", md: "md" }}
        variant="ghost"
        color="white"
        _hover={{ bg: "whiteAlpha.200" }}
        borderRadius="full"
      />

      <Modal
        onClose={onClose}
        isOpen={isOpen}
        isCentered
        size={{ base: "sm", md: "lg" }}
        scrollBehavior="inside"
      >
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
        <ModalContent
          bg="rgba(15, 15, 35, 0.98)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          borderRadius="2xl"
          mx={{ base: 4, md: 0 }}
          overflow="hidden"
          maxH="90vh"
        >
          <ModalHeader
            bgGradient="linear(to-r, #a855f7, #ec4899)"
            color="white"
            fontFamily="Poppins, sans-serif"
            fontSize={{ base: "lg", md: "xl" }}
            textAlign="center"
          >
            👥 {selectedChat?.chatName}
          </ModalHeader>

          <ModalCloseButton color="white" />
          
          <ModalBody py={6} overflowY="auto">
            <VStack spacing={5} align="stretch">
              {/* Admin Status */}
              <Box
                p={3}
                bg="rgba(168, 85, 247, 0.1)"
                borderRadius="xl"
                border="1px solid rgba(168, 85, 247, 0.3)"
              >
                <Flex align="center" gap={2}>
                  <Text fontSize="sm" color="purple.300">
                    {isCurrentUserCreator() 
                      ? "👑 You are the creator of this group"
                      : isCurrentUserAdmin()
                      ? "⭐ You are an admin"
                      : "👤 You are a member"}
                  </Text>
                </Flex>
            </Box>

              {/* Rename Group - Only for admins */}
              {isCurrentUserAdmin() && (
                <Box>
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    ✏️ Rename Group:
                  </Text>
                  <Flex gap={2}>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <EditIcon color="gray.500" />
                      </InputLeftElement>
              <Input
                        placeholder="New group name..."
                value={groupChatName}
                onChange={(e) => setGroupChatName(e.target.value)}
                        size="lg"
                        borderRadius="xl"
                        bg="rgba(255, 255, 255, 0.05)"
                        border="1px solid rgba(255, 255, 255, 0.15)"
                        color="white"
                        _placeholder={{ color: "gray.500" }}
                        _hover={{ borderColor: "purple.400" }}
                        _focus={{
                          borderColor: "purple.500",
                          boxShadow: "0 0 0 1px #a855f7",
                          bg: "rgba(255, 255, 255, 0.08)",
                        }}
              />
                    </InputGroup>
              <Button
                      bgGradient="linear(to-r, #a855f7, #ec4899)"
                      color="white"
                isLoading={renameloading}
                onClick={handleRename}
                      size="lg"
                      borderRadius="xl"
                      _hover={{
                        bgGradient: "linear(to-r, #9333ea, #db2777)",
                      }}
                      px={6}
                    >
                      Save
              </Button>
                  </Flex>
                </Box>
              )}

              <Divider borderColor="rgba(255, 255, 255, 0.1)" />

              {/* Group Members */}
              <Box>
                <Flex align="center" justify="space-between" mb={3}>
                  <Text fontSize="sm" color="gray.500">
                    👥 Members ({selectedChat?.users?.length}):
                  </Text>
                  <Badge
                    bg="rgba(72, 187, 120, 0.15)"
                    color="green.400"
                    borderRadius="full"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                  >
                    🟢 {selectedChat?.users?.filter((u) => onlineUsers.includes(u._id)).length || 0} online
                  </Badge>
                </Flex>
                <VStack spacing={2} align="stretch" maxH="250px" overflowY="auto">
                  {selectedChat?.users?.map((member) => (
                    <MemberCard
                      key={member._id}
                      member={member}
                      isAdmin={isMemberAdmin(member._id)}
                      isCreator={isCurrentUserCreator()}
                      currentUserId={user._id}
                      creatorId={selectedChat.groupAdmin?._id}
                      onRemove={handleRemove}
                      onMakeAdmin={handleMakeAdmin}
                      onRemoveAdmin={handleRemoveAdmin}
                      loading={actionLoading}
                      isOnline={onlineUsers.includes(member._id)}
                    />
                  ))}
                </VStack>
              </Box>

              {/* Add Members - Only for admins */}
              {isCurrentUserAdmin() && (
                <>
                  <Divider borderColor="rgba(255, 255, 255, 0.1)" />
                  
                  <Box>
                    <Text fontSize="sm" color="gray.500" mb={2}>
                      ➕ Add Members:
                    </Text>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <SearchIcon color="gray.500" />
                      </InputLeftElement>
              <Input
                        placeholder="Search users by name or email..."
                        value={search}
                onChange={(e) => handleSearch(e.target.value)}
                        size="lg"
                        borderRadius="xl"
                        bg="rgba(255, 255, 255, 0.05)"
                        border="1px solid rgba(255, 255, 255, 0.15)"
                        color="white"
                        _placeholder={{ color: "gray.500" }}
                        _hover={{ borderColor: "purple.400" }}
                        _focus={{
                          borderColor: "purple.500",
                          boxShadow: "0 0 0 1px #a855f7",
                          bg: "rgba(255, 255, 255, 0.08)",
                        }}
              />
                    </InputGroup>
                  </Box>

                  {/* Search Results */}
                  <Box maxH="150px" overflowY="auto">
            {loading ? (
                      <Flex justify="center" py={4}>
                        <Spinner color="purple.500" size="md" />
                      </Flex>
                    ) : searchResult.length > 0 ? (
                      <VStack spacing={2} align="stretch">
                        {searchResult.slice(0, 4).map((searchUser) => (
                <UserListItem
                            key={searchUser._id}
                            user={searchUser}
                            handleFunction={() => handleAddUser(searchUser)}
                />
                        ))}
                      </VStack>
                    ) : null}
                  </Box>
                </>
            )}
            </VStack>
          </ModalBody>

          <ModalFooter
            bg="rgba(0, 0, 0, 0.3)"
            borderTop="1px solid rgba(255, 255, 255, 0.1)"
          >
            <Button
              onClick={() => handleRemove(user)}
              variant="outline"
              borderColor="red.500"
              color="red.400"
              borderRadius="xl"
              _hover={{ bg: "red.500", color: "white" }}
              isLoading={actionLoading}
            >
              🚪 Leave Group
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateGroupChatModal;
