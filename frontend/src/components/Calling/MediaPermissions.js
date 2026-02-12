import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  Text,
  Box,
  Flex,
  Icon,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";

// Camera icon
const CameraIcon = (props) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
    />
  </Icon>
);

// Microphone icon
const MicIcon = (props) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
    />
  </Icon>
);

const MediaPermissions = ({ isOpen, onClose, onPermissionGranted, callType = "video" }) => {
  const [cameraPermission, setCameraPermission] = useState("pending"); // pending, granted, denied
  const [micPermission, setMicPermission] = useState("pending");
  const [requesting, setRequesting] = useState(false);
  const toast = useToast();

  const checkPermissions = async () => {
    try {
      // Check camera permission
      if (callType === "video") {
        const cameraResult = await navigator.permissions.query({ name: "camera" });
        setCameraPermission(cameraResult.state === "granted" ? "granted" : cameraResult.state);
        
        cameraResult.onchange = () => {
          setCameraPermission(cameraResult.state === "granted" ? "granted" : cameraResult.state);
        };
      }

      // Check microphone permission
      const micResult = await navigator.permissions.query({ name: "microphone" });
      setMicPermission(micResult.state === "granted" ? "granted" : micResult.state);
      
      micResult.onchange = () => {
        setMicPermission(micResult.state === "granted" ? "granted" : micResult.state);
      };
    } catch (error) {
      console.log("Permission API not supported, will request directly");
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkPermissions();
    }
  }, [isOpen, callType]);

  const requestPermissions = async () => {
    setRequesting(true);
    try {
      const constraints = {
        audio: true,
        video: callType === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop all tracks immediately after getting permission
      stream.getTracks().forEach(track => track.stop());

      setCameraPermission(callType === "video" ? "granted" : "not_needed");
      setMicPermission("granted");

      toast({
        title: "Permissions Granted! ✅",
        description: "You can now make calls",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });

      setTimeout(() => {
        onPermissionGranted && onPermissionGranted();
      }, 500);
    } catch (error) {
      console.error("Permission denied:", error);
      
      if (error.name === "NotAllowedError") {
        if (callType === "video") {
          setCameraPermission("denied");
        }
        setMicPermission("denied");
        
        toast({
          title: "Permission Denied",
          description: "Please enable camera/microphone in browser settings",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      } else if (error.name === "NotFoundError") {
        toast({
          title: "Device Not Found",
          description: "No camera or microphone detected",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    } finally {
      setRequesting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "granted":
        return <Text fontSize="xl">✅</Text>;
      case "denied":
        return <Text fontSize="xl">❌</Text>;
      case "not_needed":
        return <Text fontSize="xl">➖</Text>;
      default:
        return <Text fontSize="xl">❓</Text>;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "granted":
        return "green.400";
      case "denied":
        return "red.400";
      default:
        return "gray.400";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(8px)" />
      <ModalContent
        bg="rgba(15, 15, 35, 0.95)"
        border="1px solid rgba(255, 255, 255, 0.1)"
        borderRadius="2xl"
        mx={4}
      >
        <ModalHeader
          textAlign="center"
          bgGradient="linear(to-r, #a855f7, #ec4899)"
          bgClip="text"
          fontSize="xl"
          fontWeight="bold"
        >
          {callType === "video" ? "📹 Video Call Permissions" : "🎤 Voice Call Permissions"}
        </ModalHeader>

        <ModalBody>
          <VStack spacing={6} py={4}>
            <Text color="gray.300" textAlign="center" fontSize="sm">
              To make calls, Connect Hub needs access to your {callType === "video" ? "camera and microphone" : "microphone"}.
            </Text>

            {/* Permission Status */}
            <VStack spacing={3} w="100%">
              {callType === "video" && (
                <Flex
                  w="100%"
                  p={4}
                  bg="rgba(255, 255, 255, 0.05)"
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={getStatusColor(cameraPermission)}
                  align="center"
                  gap={4}
                >
                  <Box
                    p={3}
                    bg={getStatusColor(cameraPermission)}
                    borderRadius="lg"
                    opacity={0.2}
                  >
                    <CameraIcon boxSize={6} color="white" />
                  </Box>
                  <Box flex="1">
                    <Text color="white" fontWeight="600">Camera</Text>
                    <Text color="gray.400" fontSize="sm">
                      {cameraPermission === "granted" ? "Access granted" :
                       cameraPermission === "denied" ? "Access denied" : "Permission needed"}
                    </Text>
                  </Box>
                  {getStatusIcon(cameraPermission)}
                </Flex>
              )}

              <Flex
                w="100%"
                p={4}
                bg="rgba(255, 255, 255, 0.05)"
                borderRadius="xl"
                border="1px solid"
                borderColor={getStatusColor(micPermission)}
                align="center"
                gap={4}
              >
                <Box
                  p={3}
                  bg={getStatusColor(micPermission)}
                  borderRadius="lg"
                  opacity={0.2}
                >
                  <MicIcon boxSize={6} color="white" />
                </Box>
                <Box flex="1">
                  <Text color="white" fontWeight="600">Microphone</Text>
                  <Text color="gray.400" fontSize="sm">
                    {micPermission === "granted" ? "Access granted" :
                     micPermission === "denied" ? "Access denied" : "Permission needed"}
                  </Text>
                </Box>
                {getStatusIcon(micPermission)}
              </Flex>
            </VStack>

            {/* Info text */}
            <Box
              w="100%"
              p={3}
              bg="rgba(168, 85, 247, 0.1)"
              borderRadius="lg"
              border="1px solid rgba(168, 85, 247, 0.3)"
            >
              <Text color="purple.300" fontSize="xs" textAlign="center">
                💡 Your privacy matters! These permissions are only used during active calls.
              </Text>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Flex w="100%" gap={3}>
            <Button
              flex="1"
              variant="ghost"
              color="gray.400"
              onClick={onClose}
              _hover={{ bg: "whiteAlpha.100" }}
            >
              Cancel
            </Button>
            <Button
              flex="1"
              bgGradient="linear(to-r, #a855f7, #ec4899)"
              color="white"
              onClick={requestPermissions}
              isLoading={requesting}
              loadingText="Requesting..."
              _hover={{
                bgGradient: "linear(to-r, #9333ea, #db2777)",
                transform: "translateY(-2px)",
              }}
            >
              {(cameraPermission === "granted" || callType !== "video") && micPermission === "granted"
                ? "Continue"
                : "Allow Access"}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MediaPermissions;

