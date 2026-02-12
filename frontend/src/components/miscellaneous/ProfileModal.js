import { ViewIcon } from "@chakra-ui/icons";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalFooter,
  Button,
  useDisclosure,
  IconButton,
  Text,
  Image,
  Box,
  VStack,
  Flex,
} from "@chakra-ui/react";
import { ChatState } from "../../Context/ChatProvider";

const ProfileModal = ({ user, children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { onlineUsers } = ChatState();

  const isOnline = onlineUsers?.includes(user?._id);

  return (
    <>
      {children ? (
        <span onClick={onOpen}>{children}</span>
      ) : (
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
      )}
      <Modal
        size={{ base: "sm", md: "md" }}
        onClose={onClose}
        isOpen={isOpen}
        isCentered
      >
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
        <ModalContent
          bg="rgba(15, 15, 35, 0.98)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          borderRadius="3xl"
          mx={{ base: 4, md: 0 }}
          overflow="hidden"
          >
          {/* Gradient Header Background */}
          <Box
            h="100px"
            bgGradient="linear(to-r, #a855f7, #ec4899, #f97316)"
            position="relative"
          />

          <VStack
            spacing={4}
            pb={6}
            mt="-60px"
            position="relative"
            zIndex={1}
          >
            {/* Profile Picture with online indicator */}
            <Box position="relative">
              <Box
                p={1}
                bgGradient="linear(to-r, #a855f7, #ec4899)"
                borderRadius="full"
                boxShadow="0 10px 40px rgba(168, 85, 247, 0.4)"
          >
            <Image
              borderRadius="full"
                  boxSize={{ base: "100px", md: "120px" }}
                  src={user?.pic}
                  alt={user?.name}
                  objectFit="cover"
                  border="4px solid rgba(15, 15, 35, 1)"
                />
              </Box>
              {/* Online status dot */}
              <Box
                position="absolute"
                bottom={{ base: "6px", md: "8px" }}
                right={{ base: "6px", md: "8px" }}
                w={{ base: "16px", md: "18px" }}
                h={{ base: "16px", md: "18px" }}
                bg={isOnline ? "green.400" : "gray.500"}
                borderRadius="full"
                border="3px solid rgba(15, 15, 35, 1)"
                boxShadow={isOnline ? "0 0 10px rgba(72, 187, 120, 0.6)" : "none"}
              />
            </Box>

            {/* User Info */}
            <VStack spacing={1}>
              <Text
                fontSize={{ base: "xl", md: "2xl" }}
                fontFamily="Poppins, sans-serif"
                fontWeight="700"
                bgGradient="linear(to-r, #a855f7, #ec4899)"
                bgClip="text"
              >
                {user?.name}
              </Text>
              {/* Online status text */}
              <Flex align="center" gap={1.5}>
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg={isOnline ? "green.400" : "gray.500"}
                  boxShadow={isOnline ? "0 0 8px rgba(72, 187, 120, 0.5)" : "none"}
                />
                <Text fontSize="sm" color={isOnline ? "green.400" : "gray.500"} fontWeight="500">
                  {isOnline ? "Online" : "Offline"}
                </Text>
              </Flex>
              <Flex align="center" gap={2}>
                <Text fontSize="lg">📧</Text>
            <Text
                  fontSize={{ base: "sm", md: "md" }}
                  color="gray.400"
                  wordBreak="break-all"
            >
                  {user?.email}
            </Text>
              </Flex>
            </VStack>
          </VStack>

          <ModalFooter
            bg="rgba(0, 0, 0, 0.3)"
            borderTop="1px solid rgba(255, 255, 255, 0.1)"
          >
            <Button
              onClick={onClose}
              bgGradient="linear(to-r, #a855f7, #ec4899)"
              color="white"
              borderRadius="full"
              px={6}
              _hover={{
                bgGradient: "linear(to-r, #9333ea, #db2777)",
                transform: "translateY(-2px)",
                boxShadow: "0 10px 30px rgba(168, 85, 247, 0.4)",
              }}
              transition="all 0.2s"
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProfileModal;
