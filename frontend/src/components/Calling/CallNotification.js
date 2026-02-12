import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Button,
  VStack,
  Text,
  Box,
  Flex,
  Avatar,
  keyframes,
} from "@chakra-ui/react";
import { PhoneIcon } from "@chakra-ui/icons";

// Ringing animation
const ring = keyframes`
  0% { transform: rotate(0deg); }
  25% { transform: rotate(20deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(-20deg); }
  100% { transform: rotate(0deg); }
`;

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

const ripple = keyframes`
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2); opacity: 0; }
`;

const CallNotification = ({ 
  isOpen, 
  onAccept, 
  onReject, 
  callerInfo, 
  callType = "video" 
}) => {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered size="sm" closeOnOverlayClick={false}>
      <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(10px)" />
      <ModalContent
        bg="rgba(15, 15, 35, 0.98)"
        border="1px solid rgba(255, 255, 255, 0.1)"
        borderRadius="3xl"
        mx={4}
        overflow="hidden"
        boxShadow="0 0 60px rgba(168, 85, 247, 0.3)"
      >
        <ModalBody p={8}>
          <VStack spacing={6}>
            {/* Caller Avatar with animations */}
            <Box position="relative">
              {/* Ripple effects */}
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="120px"
                h="120px"
                borderRadius="full"
                border="2px solid"
                borderColor="green.400"
                animation={`${ripple} 1.5s ease-out infinite`}
              />
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="120px"
                h="120px"
                borderRadius="full"
                border="2px solid"
                borderColor="green.400"
                animation={`${ripple} 1.5s ease-out infinite 0.5s`}
              />
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="120px"
                h="120px"
                borderRadius="full"
                border="2px solid"
                borderColor="green.400"
                animation={`${ripple} 1.5s ease-out infinite 1s`}
              />
              
              <Avatar
                size="2xl"
                name={callerInfo?.name || "Unknown"}
                src={callerInfo?.pic}
                animation={`${pulse} 2s ease-in-out infinite`}
                border="4px solid"
                borderColor="green.400"
                boxShadow="0 0 30px rgba(72, 187, 120, 0.5)"
              />
            </Box>

            {/* Caller info */}
            <VStack spacing={1}>
              <Text color="white" fontSize="xl" fontWeight="bold">
                {callerInfo?.name || "Unknown Caller"}
              </Text>
              <Flex align="center" gap={2}>
                <Text
                  fontSize="3xl"
                  animation={`${ring} 0.5s ease-in-out infinite`}
                >
                  {callType === "video" ? "📹" : "📞"}
                </Text>
                <Text color="gray.400" fontSize="md">
                  Incoming {callType === "video" ? "Video" : "Voice"} Call...
                </Text>
              </Flex>
            </VStack>

            {/* Action buttons */}
            <Flex w="100%" gap={4} mt={4}>
              {/* Reject button */}
              <Button
                flex="1"
                size="lg"
                bg="red.500"
                color="white"
                borderRadius="full"
                h="60px"
                onClick={onReject}
                _hover={{
                  bg: "red.600",
                  transform: "scale(1.05)",
                }}
                transition="all 0.2s"
                boxShadow="0 4px 20px rgba(239, 68, 68, 0.4)"
              >
                <Flex direction="column" align="center">
                  <Text fontSize="xl">❌</Text>
                  <Text fontSize="xs">Decline</Text>
                </Flex>
              </Button>

              {/* Accept button */}
              <Button
                flex="1"
                size="lg"
                bg="green.500"
                color="white"
                borderRadius="full"
                h="60px"
                onClick={onAccept}
                _hover={{
                  bg: "green.600",
                  transform: "scale(1.05)",
                }}
                transition="all 0.2s"
                boxShadow="0 4px 20px rgba(72, 187, 120, 0.4)"
                animation={`${pulse} 1s ease-in-out infinite`}
              >
                <Flex direction="column" align="center">
                  <PhoneIcon boxSize={5} />
                  <Text fontSize="xs">Accept</Text>
                </Flex>
              </Button>
            </Flex>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CallNotification;

