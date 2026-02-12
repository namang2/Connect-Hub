import {
  Box,
  Container,
  Text,
  VStack,
  Button,
  Input,
  InputGroup,
  InputRightElement,
  InputLeftElement,
  FormControl,
  FormLabel,
  useToast,
  Flex,
} from "@chakra-ui/react";
import { useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import PasswordStrength from "../components/Authentication/PasswordStrength";
import { LockIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { token } = useParams();
  const history = useHistory();
  const toast = useToast();

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      toast({
        title: "Please fill all fields",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    setLoading(true);
    try {
      await axios.put(`/api/user/reset-password/${token}`, { password });
      setSuccess(true);
      toast({
        title: "Password Reset Successful!",
        description: "You can now login with your new password",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="#0a0a1a"
        position="relative"
        px={{ base: 4, sm: 6 }}
      >
        {/* Static Background Effects - No animations for better performance */}
        <Box
          position="fixed"
          top="-20%"
          right="-10%"
          w={{ base: "200px", md: "400px" }}
          h={{ base: "200px", md: "400px" }}
          borderRadius="full"
          bg="rgba(168, 85, 247, 0.12)"
          filter="blur(100px)"
          pointerEvents="none"
        />
        <Box
          position="fixed"
          bottom="-20%"
          left="-10%"
          w={{ base: "250px", md: "500px" }}
          h={{ base: "250px", md: "500px" }}
          borderRadius="full"
          bg="rgba(236, 72, 153, 0.1)"
          filter="blur(100px)"
          pointerEvents="none"
        />

        <Container maxW="md" position="relative" zIndex={1}>
          <Box
            bg="rgba(15, 15, 35, 0.9)"
            backdropFilter="blur(20px)"
            border="1px solid rgba(255, 255, 255, 0.15)"
            borderRadius={{ base: "2xl", md: "3xl" }}
            p={{ base: 6, sm: 8, md: 10 }}
            boxShadow="0 25px 80px rgba(0,0,0,0.5)"
            textAlign="center"
          >
            <Text fontSize={{ base: "4xl", md: "6xl" }} mb={4}>🎉</Text>
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="700"
              bgGradient="linear(to-r, #48bb78, #38b2ac)"
              bgClip="text"
              mb={4}
            >
              Password Reset Complete!
            </Text>
            <Text color="gray.400" mb={6} fontSize={{ base: "sm", md: "md" }}>
              Your password has been successfully updated. You can now login with your new password.
            </Text>
            <Button
              size={{ base: "md", md: "lg" }}
              bgGradient="linear(to-r, #a855f7, #ec4899)"
              color="white"
              borderRadius="xl"
              onClick={() => history.push("/")}
              w={{ base: "100%", sm: "auto" }}
              _hover={{
                bgGradient: "linear(to-r, #9333ea, #db2777)",
                transform: "translateY(-2px)",
                boxShadow: "0 10px 40px rgba(168, 85, 247, 0.4)",
              }}
            >
              🚀 Go to Login
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="#0a0a1a"
      position="relative"
      px={{ base: 3, sm: 4 }}
      py={{ base: 6, md: 0 }}
    >
      {/* Static Background Effects - No animations for better performance */}
      <Box
        position="fixed"
        top="-20%"
        right="-10%"
        w={{ base: "200px", md: "400px" }}
        h={{ base: "200px", md: "400px" }}
        borderRadius="full"
        bg="rgba(168, 85, 247, 0.12)"
        filter="blur(100px)"
        pointerEvents="none"
      />
      <Box
        position="fixed"
        bottom="-20%"
        left="-10%"
        w={{ base: "250px", md: "500px" }}
        h={{ base: "250px", md: "500px" }}
        borderRadius="full"
        bg="rgba(236, 72, 153, 0.1)"
        filter="blur(100px)"
        pointerEvents="none"
      />

      <Container maxW="md" position="relative" zIndex={1} px={{ base: 0, sm: 4 }}>
        <Box
          bg="rgba(15, 15, 35, 0.9)"
          backdropFilter="blur(20px)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          borderRadius={{ base: "xl", md: "3xl" }}
          p={{ base: 5, sm: 6, md: 10 }}
          boxShadow="0 25px 80px rgba(0,0,0,0.5)"
        >
          <VStack spacing={{ base: 4, md: 6 }}>
            <Box textAlign="center">
              <Text fontSize={{ base: "3xl", md: "5xl" }} mb={2}>🔑</Text>
              <Text
                fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
                fontWeight="700"
                bgGradient="linear(to-r, #a855f7, #ec4899)"
                bgClip="text"
              >
                Create New Password
              </Text>
              <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }} mt={2}>
                Enter a strong password for your account
              </Text>
            </Box>

            <FormControl isRequired>
              <FormLabel fontSize={{ base: "xs", md: "sm" }} fontWeight="600" color="gray.300">
                New Password
              </FormLabel>
              <InputGroup size={{ base: "md", md: "lg" }}>
                <InputLeftElement pointerEvents="none">
                  <LockIcon color="gray.500" />
                </InputLeftElement>
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  borderRadius="xl"
                  bg="rgba(255, 255, 255, 0.05)"
                  border="1px solid rgba(255, 255, 255, 0.15)"
                  color="white"
                  fontSize={{ base: "sm", md: "md" }}
                  _placeholder={{ color: "gray.500" }}
                  _hover={{ borderColor: "purple.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px #a855f7",
                    bg: "rgba(255, 255, 255, 0.08)",
                  }}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="2rem"
                    size="sm"
                    onClick={() => setShow(!show)}
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: "white", bg: "whiteAlpha.200" }}
                  >
                    {show ? <ViewOffIcon /> : <ViewIcon />}
                  </Button>
                </InputRightElement>
              </InputGroup>
              <PasswordStrength password={password} />
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize={{ base: "xs", md: "sm" }} fontWeight="600" color="gray.300">
                Confirm Password
              </FormLabel>
              <InputGroup size={{ base: "md", md: "lg" }}>
                <InputLeftElement pointerEvents="none">
                  <LockIcon color="gray.500" />
                </InputLeftElement>
                <Input
                  type={show ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  borderRadius="xl"
                  bg="rgba(255, 255, 255, 0.05)"
                  border="1px solid rgba(255, 255, 255, 0.15)"
                  color="white"
                  fontSize={{ base: "sm", md: "md" }}
                  _placeholder={{ color: "gray.500" }}
                  _hover={{ borderColor: "purple.400" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px #a855f7",
                    bg: "rgba(255, 255, 255, 0.08)",
                  }}
                />
              </InputGroup>
              {confirmPassword && (
                <Flex align="center" mt={2} gap={2}>
                  <Text fontSize={{ base: "xs", md: "sm" }}>
                    {password === confirmPassword ? "✅" : "❌"}
                  </Text>
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    color={password === confirmPassword ? "green.400" : "red.400"}
                  >
                    {password === confirmPassword
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </Text>
                </Flex>
              )}
            </FormControl>

            <Button
              width="100%"
              size={{ base: "md", md: "lg" }}
              onClick={handleSubmit}
              isLoading={loading}
              loadingText="Resetting..."
              bgGradient="linear(to-r, #a855f7, #ec4899)"
              color="white"
              borderRadius="xl"
              _hover={{
                bgGradient: "linear(to-r, #9333ea, #db2777)",
                transform: "translateY(-2px)",
                boxShadow: "0 10px 40px rgba(168, 85, 247, 0.4)",
              }}
              _active={{ transform: "translateY(0)" }}
              transition="all 0.2s"
              fontWeight="600"
              fontSize={{ base: "sm", md: "md" }}
            >
              🔐 Reset Password
            </Button>

            <Button
              variant="ghost"
              onClick={() => history.push("/")}
              color="gray.500"
              size={{ base: "sm", md: "md" }}
              _hover={{ color: "purple.400", bg: "whiteAlpha.100" }}
            >
              ← Back to Login
            </Button>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
};

export default ResetPassword;
