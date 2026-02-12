import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input, InputGroup, InputRightElement } from "@chakra-ui/input";
import { VStack, Text, Flex } from "@chakra-ui/layout";
import { useState } from "react";
import axios from "axios";
import { useToast, Spinner } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { ChatState } from "../../Context/ChatProvider";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";

const Login = ({ onForgotPassword }) => {
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(null);

  const history = useHistory();
  const { setUser, refreshChats } = ChatState();

  const checkEmail = async (emailValue) => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setEmailExists(null);
      return;
    }
    setCheckingEmail(true);
    try {
      const { data } = await axios.post("/api/user/check-email", { email: emailValue });
      setEmailExists(data.exists);
    } catch (error) {
      setEmailExists(null);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    const timeoutId = setTimeout(() => checkEmail(value), 500);
    return () => clearTimeout(timeoutId);
  };

  const submitHandler = async () => {
    setLoading(true);
    if (!email || !password) {
      toast({
        title: "Please fill all fields",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };
      const { data } = await axios.post("/api/user/login", { email, password }, config);

      toast({
        title: "Welcome back! 🎉",
        description: `Good to see you, ${data.name}!`,
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      localStorage.setItem("userInfo", JSON.stringify(data));
      setUser(data);
      setLoading(false);
      setTimeout(() => {
        refreshChats && refreshChats();
        history.push("/chats");
      }, 100);
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error.response?.data?.message || "Invalid credentials",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") submitHandler();
  };

  return (
    <VStack spacing={4} w="100%">
      <FormControl id="login-email" isRequired>
        <FormLabel
          fontSize="sm"
          fontWeight="600"
          color="gray.300"
          mb={1.5}
        >
          📧 Email Address
        </FormLabel>
        <InputGroup size="md">
          <Input
            value={email}
            type="email"
            placeholder="Enter your email"
            onChange={handleEmailChange}
            onKeyPress={handleKeyPress}
            borderRadius="xl"
            bg="rgba(255, 255, 255, 0.05)"
            border="1px solid rgba(255, 255, 255, 0.15)"
            color="white"
            fontSize="sm"
            h="44px"
            _placeholder={{ color: "gray.500", fontSize: "sm" }}
            _hover={{ borderColor: "purple.400" }}
            _focus={{
              borderColor: emailExists === false ? "red.400" : "purple.500",
              boxShadow: emailExists === false
                ? "0 0 0 1px #f56565"
                : "0 0 0 1px #a855f7",
              bg: "rgba(255, 255, 255, 0.08)",
            }}
            pr="45px"
          />
          <InputRightElement h="44px" pr={2}>
            {checkingEmail ? (
              <Spinner size="xs" color="purple.500" />
            ) : emailExists === true ? (
              <Text color="green.400" fontSize="md">✓</Text>
            ) : emailExists === false ? (
              <Text color="red.400" fontSize="md">✗</Text>
            ) : null}
          </InputRightElement>
        </InputGroup>
        {emailExists === false && (
          <Text color="red.400" fontSize="xs" mt={1}>
            No account found with this email
          </Text>
        )}
      </FormControl>

      <FormControl id="login-password" isRequired>
        <FormLabel
          fontSize="sm"
          fontWeight="600"
          color="gray.300"
          mb={1.5}
        >
          🔒 Password
        </FormLabel>
        <InputGroup size="md">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            type={show ? "text" : "password"}
            placeholder="Enter your password"
            borderRadius="xl"
            bg="rgba(255, 255, 255, 0.05)"
            border="1px solid rgba(255, 255, 255, 0.15)"
            color="white"
            fontSize="sm"
            h="44px"
            _placeholder={{ color: "gray.500", fontSize: "sm" }}
            _hover={{ borderColor: "purple.400" }}
            _focus={{
              borderColor: "purple.500",
              boxShadow: "0 0 0 1px #a855f7",
              bg: "rgba(255, 255, 255, 0.08)",
            }}
            pr="60px"
          />
          <InputRightElement h="44px" width="3.5rem">
            <Button
              h="1.5rem"
              size="xs"
              onClick={handleClick}
              variant="ghost"
              color="gray.400"
              _hover={{ color: "white", bg: "whiteAlpha.200" }}
            >
              {show ? <ViewOffIcon /> : <ViewIcon />}
            </Button>
          </InputRightElement>
        </InputGroup>
      </FormControl>

      <Flex w="100%" justify="flex-end">
        <Text
          fontSize="xs"
          color="purple.400"
          cursor="pointer"
          fontWeight="500"
          _hover={{ color: "purple.300", textDecoration: "underline" }}
          onClick={onForgotPassword}
        >
          Forgot Password? 🔑
        </Text>
      </Flex>

      <Button
        width="100%"
        onClick={submitHandler}
        isLoading={loading}
        loadingText="Signing in..."
        size="md"
        h="44px"
        bgGradient="linear(to-r, #a855f7, #ec4899)"
        color="white"
        borderRadius="xl"
        fontSize="sm"
        _hover={{
          bgGradient: "linear(to-r, #9333ea, #db2777)",
          transform: "translateY(-2px)",
          boxShadow: "0 10px 40px rgba(168, 85, 247, 0.4)",
        }}
        _active={{ transform: "translateY(0)" }}
        transition="all 0.2s"
        fontWeight="600"
      >
        🚀 Sign In
      </Button>

    </VStack>
  );
};

export default Login;
