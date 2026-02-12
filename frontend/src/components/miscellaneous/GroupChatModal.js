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
  Text,
  VStack,
  Spinner,
  Flex,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { SearchIcon, EditIcon } from "@chakra-ui/icons";
import axios from "axios";
import { useState } from "react";
import { ChatState } from "../../Context/ChatProvider";
import UserBadgeItem from "../userAvatar/UserBadgeItem";
import UserListItem from "../userAvatar/UserListItem";

const GroupChatModal = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const { user, chats, setChats } = ChatState();

  const handleGroup = (userToAdd) => {
    if (selectedUsers.find((u) => u._id === userToAdd._id)) {
      toast({
        title: "User already added",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setSelectedUsers([...selectedUsers, userToAdd]);
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

  const handleDelete = (delUser) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleSubmit = async () => {
    if (!groupChatName || selectedUsers.length === 0) {
      toast({
        title: "Please fill all fields",
        description: "Group name and at least one member required",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.post(
        `/api/chat/group`,
        {
          name: groupChatName,
          users: JSON.stringify(selectedUsers.map((u) => u._id)),
        },
        config
      );
      setChats([data, ...chats]);
      handleClose();
      toast({
        title: "🎉 Group Created!",
        description: `${groupChatName} is ready to use`,
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Failed to create group",
        description: error.response?.data || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  const handleClose = () => {
    setGroupChatName("");
    setSelectedUsers([]);
    setSearchResult([]);
    setSearch("");
    onClose();
  };

  return (
    <>
      <span onClick={onOpen}>{children}</span>

      <Modal
        onClose={handleClose}
        isOpen={isOpen}
        isCentered
        size={{ base: "sm", md: "md" }}
      >
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
        <ModalContent
          bg="rgba(15, 15, 35, 0.98)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          borderRadius="2xl"
          mx={{ base: 4, md: 0 }}
          overflow="hidden"
        >
          <ModalHeader
            bgGradient="linear(to-r, #a855f7, #ec4899)"
            color="white"
            fontFamily="Poppins, sans-serif"
            fontSize={{ base: "lg", md: "xl" }}
            textAlign="center"
          >
            👥 Create Group Chat
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody py={6}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <EditIcon color="gray.500" />
                  </InputLeftElement>
                  <Input
                    placeholder="Enter group name..."
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
              </FormControl>

              <FormControl>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.500" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search users to add..."
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
              </FormControl>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <Box>
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    Selected Members ({selectedUsers.length}):
                  </Text>
                  <Flex flexWrap="wrap" gap={2}>
                    {selectedUsers.map((u) => (
                      <UserBadgeItem
                        key={u._id}
                        user={u}
                        handleFunction={() => handleDelete(u)}
                      />
                    ))}
                  </Flex>
                </Box>
              )}

              {/* Search Results */}
              <Box maxH="200px" overflowY="auto">
                {loading ? (
                  <Flex justify="center" py={4}>
                    <Spinner color="purple.500" size="md" />
                  </Flex>
                ) : searchResult.length > 0 ? (
                  <VStack spacing={2} align="stretch">
                    <Text fontSize="xs" color="gray.500">
                      Search Results:
                    </Text>
                    {searchResult.slice(0, 4).map((searchUser) => (
                      <UserListItem
                        key={searchUser._id}
                        user={searchUser}
                        handleFunction={() => handleGroup(searchUser)}
                      />
                    ))}
                  </VStack>
                ) : search ? (
                  <Text color="gray.500" textAlign="center" py={4}>
                    No users found
                  </Text>
                ) : null}
              </Box>
            </VStack>
          </ModalBody>

          <ModalFooter
            bg="rgba(0, 0, 0, 0.3)"
            borderTop="1px solid rgba(255, 255, 255, 0.1)"
          >
            <Button
              variant="ghost"
              mr={3}
              onClick={handleClose}
              color="gray.400"
              _hover={{ bg: "whiteAlpha.100" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              bgGradient="linear(to-r, #a855f7, #ec4899)"
              color="white"
              borderRadius="xl"
              _hover={{
                bgGradient: "linear(to-r, #9333ea, #db2777)",
                transform: "translateY(-2px)",
                boxShadow: "0 10px 30px rgba(168, 85, 247, 0.4)",
              }}
              transition="all 0.2s"
              isDisabled={!groupChatName || selectedUsers.length === 0}
            >
              ✨ Create Group
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default GroupChatModal;
