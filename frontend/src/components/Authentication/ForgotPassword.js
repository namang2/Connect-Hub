import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { VStack, Box, Text, HStack } from "@chakra-ui/layout";
import { useState } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/react";

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const handleSubmit = async () => {
    if (!email) {
      toast({
        title: "Please enter your email address",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post("/api/user/forgot-password", { email });
      setEmailSent(true);
      toast({
        title: "Email Sent!",
        description: "Check your inbox for password reset instructions",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Something went wrong";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (emailSent) {
    return (
      <VStack spacing={5} align="center" py={4}>
        <Box
          p={4}
          bg="rgba(72, 187, 120, 0.1)"
          borderRadius="full"
          border="2px solid"
          borderColor="green.400"
        >
          <Text fontSize="3xl">📧</Text>
        </Box>
        <Text
          fontSize="lg"
          fontWeight="700"
          bgGradient="linear(to-r, #48bb78, #38b2ac)"
          bgClip="text"
        >
          Check Your Email!
        </Text>
        <Text color="gray.400" textAlign="center" px={4} fontSize="sm">
          We've sent password reset instructions to{" "}
          <Text as="span" fontWeight="600" color="purple.400">
            {email}
          </Text>
        </Text>
        <Box
          p={3}
          bg="rgba(99, 179, 237, 0.1)"
          borderRadius="xl"
          border="1px solid"
          borderColor="blue.400"
        >
          <Text fontSize="xs" color="blue.300">
            💡 Don't forget to check your spam folder!
          </Text>
        </Box>
        <Button
          variant="ghost"
          color="purple.400"
          onClick={onBack}
          fontSize="sm"
          _hover={{ bg: "whiteAlpha.100" }}
        >
          ← Back to Login
        </Button>
      </VStack>
    );
  }

  return (
    <VStack spacing={4} w="100%">
      <Box textAlign="center" mb={1}>
        <Text fontSize="3xl" mb={2}>🔐</Text>
        <Text
          fontSize="lg"
          fontWeight="700"
          bgGradient="linear(to-r, #a855f7, #ec4899)"
          bgClip="text"
        >
          Forgot Password?
        </Text>
        <Text color="gray.500" fontSize="xs" mt={2}>
          No worries! Enter your email and we'll send you reset instructions.
        </Text>
      </Box>

      {error && (
        <Box
          w="100%"
          p={3}
          bg="rgba(245, 101, 101, 0.1)"
          border="1px solid"
          borderColor="red.400"
          borderRadius="xl"
        >
          <HStack spacing={2}>
            <Text color="red.400">⚠️</Text>
            <Text color="red.300" fontSize="xs">
              {error}
            </Text>
          </HStack>
          {error.includes("Email could not be sent") && (
            <Text color="gray.500" fontSize="xs" mt={2}>
              Please contact the administrator to configure email settings.
            </Text>
          )}
        </Box>
      )}

      <FormControl id="reset-email" isRequired>
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          📧 Email Address
        </FormLabel>
        <Input
          value={email}
          type="email"
          placeholder="Enter your registered email"
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          size="md"
          h="44px"
          fontSize="sm"
          borderRadius="xl"
          bg="rgba(255, 255, 255, 0.05)"
          border="1px solid rgba(255, 255, 255, 0.15)"
          color="white"
          _placeholder={{ color: "gray.500", fontSize: "sm" }}
          _hover={{ borderColor: "purple.400" }}
          _focus={{
            borderColor: "purple.500",
            boxShadow: "0 0 0 1px #a855f7",
            bg: "rgba(255, 255, 255, 0.08)",
          }}
        />
      </FormControl>

      <Button
        width="100%"
        mt={1}
        onClick={handleSubmit}
        isLoading={loading}
        loadingText="Sending..."
        size="md"
        h="44px"
        fontSize="sm"
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
      >
        📩 Send Reset Link
      </Button>

      <Button
        variant="ghost"
        width="100%"
        onClick={onBack}
        color="gray.500"
        fontSize="sm"
        _hover={{ color: "purple.400", bg: "whiteAlpha.100" }}
      >
        ← Back to Login
      </Button>
    </VStack>
  );
};

export default ForgotPassword;
