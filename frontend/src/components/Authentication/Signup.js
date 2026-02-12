import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input, InputGroup, InputRightElement } from "@chakra-ui/input";
import { VStack, Text, Flex, Box } from "@chakra-ui/layout";
import { useToast, Spinner } from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import axios from "axios";
import { useState } from "react";
import { useHistory } from "react-router";
import PasswordStrength from "./PasswordStrength";
import { ChatState } from "../../Context/ChatProvider";

const Signup = () => {
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);
  const toast = useToast();
  const history = useHistory();
  const { setUser, refreshChats } = ChatState();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmpassword, setConfirmpassword] = useState("");
  const [password, setPassword] = useState("");
  const [pic, setPic] = useState();
  const [picLoading, setPicLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(null);

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

  const isPasswordStrong = () => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    );
  };

  const submitHandler = async () => {
    setPicLoading(true);
    if (!name || !email || !password || !confirmpassword) {
      toast({ title: "Please fill all required fields", status: "warning", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
      return;
    }
    if (emailExists) {
      toast({ title: "Email already registered", description: "Please use a different email or login", status: "error", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
      return;
    }
    if (!isPasswordStrong()) {
      toast({ title: "Password too weak", description: "Please create a stronger password", status: "warning", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
      return;
    }
    if (password !== confirmpassword) {
      toast({ title: "Passwords do not match", status: "warning", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };
      const { data } = await axios.post("/api/user", { name, email, password, pic: pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }, config);
      toast({ title: "Account Created! 🎉", description: `Welcome to Connect Hub, ${data.name}!`, status: "success", duration: 5000, isClosable: true, position: "bottom" });
      localStorage.setItem("userInfo", JSON.stringify(data));
      setUser(data);
      setPicLoading(false);
      setTimeout(() => {
        refreshChats && refreshChats();
        history.push("/chats");
      }, 100);
    } catch (error) {
      toast({ title: "Registration Failed", description: error.response?.data?.message || "Something went wrong", status: "error", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
    }
  };

  const postDetails = (pics) => {
    setPicLoading(true);
    if (pics === undefined) {
      toast({ title: "Please select an image", status: "warning", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
      return;
    }
    if (pics.type === "image/jpeg" || pics.type === "image/png") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "chat-app");
      data.append("cloud_name", "dejog9zgj");
      fetch("https://api.cloudinary.com/v1_1/dejog9zgj/image/upload", { method: "post", body: data })
        .then((res) => res.json())
        .then((data) => {
          setPic(data.url.toString());
          setPicLoading(false);
          toast({ title: "Photo uploaded! 📸", status: "success", duration: 2000, isClosable: true, position: "bottom" });
        })
        .catch((err) => { console.log(err); setPicLoading(false); });
    } else {
      toast({ title: "Please select a valid image (JPEG/PNG)", status: "warning", duration: 5000, isClosable: true, position: "bottom" });
      setPicLoading(false);
    }
  };

  const inputStyles = {
    bg: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "white",
    fontSize: "sm",
    h: "44px",
    _placeholder: { color: "gray.500", fontSize: "sm" },
    _hover: { borderColor: "pink.400" },
    _focus: {
      borderColor: "pink.500",
      boxShadow: "0 0 0 1px #ec4899",
      bg: "rgba(255, 255, 255, 0.08)",
    },
  };

  return (
    <VStack spacing={3} w="100%">
      <FormControl id="signup-name" isRequired>
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          👤 Full Name
        </FormLabel>
        <Input
          placeholder="Enter your full name"
          onChange={(e) => setName(e.target.value)}
          value={name}
          size="md"
          borderRadius="xl"
          {...inputStyles}
        />
      </FormControl>

      <FormControl id="signup-email" isRequired>
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          📧 Email Address
        </FormLabel>
        <InputGroup size="md">
          <Input
            type="email"
            placeholder="Enter your email"
            onChange={handleEmailChange}
            value={email}
            borderRadius="xl"
            {...inputStyles}
            borderColor={emailExists ? "red.400" : "rgba(255, 255, 255, 0.15)"}
            _focus={{
              borderColor: emailExists ? "red.500" : "pink.500",
              boxShadow: emailExists ? "0 0 0 1px #f56565" : "0 0 0 1px #ec4899",
              bg: "rgba(255, 255, 255, 0.08)",
            }}
            pr="45px"
          />
          <InputRightElement h="44px" pr={2}>
            {checkingEmail ? (
              <Spinner size="xs" color="pink.500" />
            ) : emailExists === false ? (
              <Text color="green.400" fontSize="md">✓</Text>
            ) : emailExists === true ? (
              <Text color="red.400" fontSize="md">✗</Text>
            ) : null}
          </InputRightElement>
        </InputGroup>
        {emailExists && (
          <Text color="red.400" fontSize="xs" mt={1}>
            This email is already registered
          </Text>
        )}
      </FormControl>

      <FormControl id="signup-password" isRequired>
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          🔒 Password
        </FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder="Create a strong password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            borderRadius="xl"
            {...inputStyles}
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
        <PasswordStrength password={password} />
      </FormControl>

      <FormControl id="confirm-password" isRequired>
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          🔐 Confirm Password
        </FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder="Confirm your password"
            onChange={(e) => setConfirmpassword(e.target.value)}
            value={confirmpassword}
            borderRadius="xl"
            {...inputStyles}
            borderColor={
              confirmpassword && password !== confirmpassword
                ? "red.400"
                : "rgba(255, 255, 255, 0.15)"
            }
          />
        </InputGroup>
        {confirmpassword && (
          <Flex align="center" mt={1.5} gap={1.5}>
            <Text fontSize="xs">
              {password === confirmpassword ? "✅" : "❌"}
            </Text>
            <Text fontSize="xs" color={password === confirmpassword ? "green.400" : "red.400"}>
              {password === confirmpassword ? "Passwords match" : "Passwords do not match"}
            </Text>
          </Flex>
        )}
      </FormControl>

      <FormControl id="pic">
        <FormLabel fontSize="sm" fontWeight="600" color="gray.300" mb={1.5}>
          📷 Profile Picture (Optional)
        </FormLabel>
        <Box position="relative">
          <Input
            type="file"
            p={2}
            accept="image/*"
            onChange={(e) => postDetails(e.target.files[0])}
            borderRadius="xl"
            bg="transparent"
            border="2px dashed"
            borderColor={pic ? "green.400" : "rgba(255, 255, 255, 0.2)"}
            color="white"
            _hover={{ borderColor: "pink.400" }}
            cursor="pointer"
            opacity={0}
            position="absolute"
            zIndex={1}
            h="100%"
            w="100%"
          />
          <Box
            p={3}
            borderRadius="xl"
            bg={pic ? "rgba(72, 187, 120, 0.1)" : "rgba(255, 255, 255, 0.05)"}
            border="2px dashed"
            borderColor={pic ? "green.400" : "rgba(255, 255, 255, 0.2)"}
            textAlign="center"
            transition="all 0.2s"
            _hover={{ borderColor: "pink.400", bg: "rgba(236, 72, 153, 0.1)" }}
          >
            {picLoading ? (
              <Spinner color="pink.500" size="sm" />
            ) : pic ? (
              <Text color="green.400" fontWeight="500" fontSize="xs">
                ✅ Photo uploaded!
              </Text>
            ) : (
              <Text color="gray.500" fontSize="xs">
                📸 Click to upload a photo
              </Text>
            )}
          </Box>
        </Box>
      </FormControl>

      <Button
        width="100%"
        mt={2}
        onClick={submitHandler}
        isLoading={picLoading}
        loadingText="Creating account..."
        size="md"
        h="44px"
        fontSize="sm"
        bgGradient="linear(to-r, #ec4899, #f97316)"
        color="white"
        borderRadius="xl"
        _hover={{
          bgGradient: "linear(to-r, #db2777, #ea580c)",
          transform: "translateY(-2px)",
          boxShadow: "0 10px 40px rgba(236, 72, 153, 0.4)",
        }}
        _active={{ transform: "translateY(0)" }}
        transition="all 0.2s"
        fontWeight="600"
        isDisabled={!isPasswordStrong() || emailExists || !name || !email}
      >
        ✨ Create Account
      </Button>
    </VStack>
  );
};

export default Signup;
