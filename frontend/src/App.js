import "./App.css";
import React, { Suspense, lazy } from "react";
import { Route, Switch } from "react-router-dom";
import { Box, Spinner, Flex, Text, keyframes } from "@chakra-ui/react";

// Lazy load pages for better performance
const Homepage = lazy(() => import("./Pages/Homepage"));
const Chatpage = lazy(() => import("./Pages/Chatpage"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));

// Loading animation
const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
`;

// Beautiful loading component
const LoadingScreen = () => (
  <Flex
    w="100vw"
    h="100vh"
    align="center"
    justify="center"
    bg="#0a0a1a"
    direction="column"
    gap={4}
  >
    {/* Animated background orbs */}
    <Box
      position="absolute"
      top="20%"
      left="30%"
      w="200px"
      h="200px"
      bg="purple.500"
      filter="blur(100px)"
      borderRadius="full"
      opacity="0.3"
      animation={`${pulse} 3s ease-in-out infinite`}
    />
    <Box
      position="absolute"
      bottom="30%"
      right="20%"
      w="150px"
      h="150px"
      bg="pink.500"
      filter="blur(80px)"
      borderRadius="full"
      opacity="0.3"
      animation={`${pulse} 3s ease-in-out infinite 1s`}
    />
    
    {/* Logo/Brand */}
    <Text fontSize="4xl" mb={2}>
      💬
    </Text>
    <Text
      fontSize="2xl"
      fontWeight="bold"
      bgGradient="linear(to-r, #a855f7, #ec4899)"
      bgClip="text"
      fontFamily="Poppins, sans-serif"
    >
      Connect Hub
    </Text>
    
    {/* Spinner */}
    <Spinner
      size="lg"
      color="purple.400"
      thickness="3px"
      speed="0.8s"
      mt={4}
    />
    
    <Text color="gray.500" fontSize="sm" mt={2}>
      Loading...
    </Text>
  </Flex>
);

function App() {
  return (
    <div className="App">
      <Suspense fallback={<LoadingScreen />}>
        <Switch>
          <Route path="/" component={Homepage} exact />
          <Route path="/chats" component={Chatpage} />
          <Route path="/reset-password/:token" component={ResetPassword} />
        </Switch>
      </Suspense>
    </div>
  );
}

export default App;
