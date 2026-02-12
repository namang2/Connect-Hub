import { Box, Flex } from "@chakra-ui/react";
import { useState, memo } from "react";
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
          md: "calc(100vh - 60px)" 
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
