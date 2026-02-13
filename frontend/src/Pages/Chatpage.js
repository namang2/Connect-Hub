import { Box, Flex, useToast } from "@chakra-ui/react";
import { useState, useEffect, memo } from "react";
import Chatbox from "../components/Chatbox";
import MyChats from "../components/MyChats";
import SideDrawer from "../components/miscellaneous/SideDrawer";
import { ChatState } from "../Context/ChatProvider";

// Memoize components to prevent unnecessary re-renders
const MemoizedMyChats = memo(MyChats);
const MemoizedChatbox = memo(Chatbox);

const Chatpage = () => {
  const [fetchAgain, setFetchAgain] = useState(false);
  const { user } = ChatState();
  const toast = useToast();

  // ───── Request camera & mic permissions on first visit ─────
  // This ensures the browser prompt appears right after login so that
  // calls work without an extra permission step later.
  useEffect(() => {
    if (!user) return;

    const requestMediaPermissions = async () => {
      // Only ask if we haven't already been granted
      try {
        const micPerm = await navigator.permissions.query({ name: "microphone" });
        const camPerm = await navigator.permissions.query({ name: "camera" });

        if (micPerm.state === "granted" && camPerm.state === "granted") {
          console.log("✅ Media permissions already granted");
          return; // Already have permission, don't bother user
        }
      } catch (e) {
        // permissions.query not supported — proceed to request
      }

      try {
        console.log("📷🎤 Requesting media permissions on login...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        // Immediately stop tracks — we just needed the permission grant
        stream.getTracks().forEach((t) => t.stop());
        console.log("✅ Media permissions granted on login");
      } catch (err) {
        console.log("⚠️ Media permission request failed:", err.message);
        // Don't show an error toast — user can still grant later when making a call
        // But show a subtle info toast so they know
        if (err.name === "NotAllowedError") {
          toast({
            title: "Camera/Mic Access",
            description:
              "Enable camera & microphone permissions in your browser to make voice/video calls.",
            status: "info",
            duration: 6000,
            isClosable: true,
            position: "bottom",
          });
        }
      }
    };

    // Small delay so the chat page loads first, then ask
    const timer = setTimeout(requestMediaPermissions, 1500);
    return () => clearTimeout(timer);
  }, [user, toast]);

  return (
    <Box
      w="100%"
      h="100vh"
      maxH="100vh"
      position="relative"
      overflow="hidden"
      bg="#0a0a1a"
    >
      {/* Static Background Effects - No animations for better performance */}
      <Box
        position="fixed"
        top="-20%"
        right="-10%"
        w={{ base: "300px", md: "500px" }}
        h={{ base: "300px", md: "500px" }}
        borderRadius="full"
        bg="rgba(168, 85, 247, 0.1)"
        filter="blur(100px)"
        pointerEvents="none"
        zIndex={0}
      />
      <Box
        position="fixed"
        bottom="-20%"
        left="-10%"
        w={{ base: "350px", md: "600px" }}
        h={{ base: "350px", md: "600px" }}
        borderRadius="full"
        bg="rgba(236, 72, 153, 0.1)"
        filter="blur(100px)"
        pointerEvents="none"
        zIndex={0}
      />

      {/* Header - Full width, responsive */}
      {user && <SideDrawer />}

      {/* Main Content - Responsive layout */}
      <Flex
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        h={{
          base: "calc(100vh - 52px)",
          sm: "calc(100vh - 56px)",
          md: "calc(100vh - 60px)",
        }}
        p={{ base: 1.5, sm: 2, md: 3, lg: 4 }}
        gap={{ base: 1.5, sm: 2, md: 3, lg: 4 }}
        position="relative"
        zIndex={1}
        overflow="hidden"
      >
        {user && <MemoizedMyChats fetchAgain={fetchAgain} />}
        {user && (
          <MemoizedChatbox fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
        )}
      </Flex>
    </Box>
  );
};

export default Chatpage;
