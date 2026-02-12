import {
  Box,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Flex,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  keyframes,
} from "@chakra-ui/react";
import { useEffect, useState, memo, useCallback } from "react";
import { useHistory } from "react-router";
import Login from "../components/Authentication/Login";
import Signup from "../components/Authentication/Signup";
import ForgotPassword from "../components/Authentication/ForgotPassword";

// ─── Minimal Keyframe Animations (performance-friendly) ─────
const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const gradientMove = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// ─── Feature data ───────────────────────────────────────────
const features = [
  { icon: "⚡", title: "Lightning Fast", short: "Real-time messaging", full: "Messages delivered instantly with WebSocket technology. No delays, no refreshing.", color: "#fbbf24" },
  { icon: "📎", title: "File Sharing", short: "Share any file type", full: "Send images, documents, videos, and audio files seamlessly with cloud storage.", color: "#60a5fa" },
  { icon: "📍", title: "Live Location", short: "Share your location", full: "Share real-time location with friends on an interactive map inside the chat.", color: "#34d399" },
  { icon: "👥", title: "Group Chats", short: "Create communities", full: "Create groups, assign admins, and manage members for teams and communities.", color: "#c084fc" },
  { icon: "📹", title: "Video Calls", short: "HD video calling", full: "Crystal-clear video calls with WebRTC, screen sharing and group conferencing.", color: "#f472b6" },
  { icon: "😀", title: "Emoji Support", short: "Express yourself", full: "Rich emoji picker with search. Hundreds of emojis right at your fingertips.", color: "#fb923c" },
  { icon: "🔔", title: "Notifications", short: "Never miss a message", full: "Smart push notifications with badge counts, sound alerts and message indicators.", color: "#38bdf8" },
  { icon: "🔒", title: "Secure", short: "End-to-end encrypted", full: "Conversations protected with encryption. Secure authentication and data handling.", color: "#4ade80" },
];

// ─── Feature Card — fixed height, hover to expand ───────────
const FeatureCard = memo(({ icon, title, short, full, color, isExpanded, onEnter, onLeave, index }) => (
  <Box
    p={3}
    bg={isExpanded ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"}
    borderRadius="xl"
    border="1px solid"
    borderColor={isExpanded ? color : "rgba(255,255,255,0.08)"}
    transition="background 0.2s, border-color 0.2s, box-shadow 0.2s"
    cursor="pointer"
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    position="relative"
    overflow="hidden"
    animation={`${slideUp} 0.4s ease ${index * 0.05}s both`}
    _hover={{
      borderColor: color,
      boxShadow: `0 4px 20px ${color}30`,
    }}
  >
    {/* Row: icon + title/short + arrow */}
    <Flex align="center" gap={2} h={{ base: "36px", md: "40px" }}>
      <Text fontSize={{ base: "lg", md: "xl" }} flexShrink={0}>
        {icon}
      </Text>
      <Box flex="1" minW={0} overflow="hidden">
        <Text
          color="white"
          fontWeight="700"
          fontSize={{ base: "xs", md: "sm" }}
          lineHeight="1.2"
          isTruncated
        >
          {title}
        </Text>
        <Text
          color="gray.500"
          fontSize={{ base: "2xs", md: "xs" }}
          lineHeight="1.2"
          isTruncated
          opacity={isExpanded ? 0 : 1}
          h={isExpanded ? "0px" : "auto"}
          transition="opacity 0.15s"
          overflow="hidden"
        >
          {short}
        </Text>
      </Box>
      <Text
        fontSize="2xs"
        color={color}
        transition="transform 0.2s"
        transform={isExpanded ? "rotate(180deg)" : "rotate(0deg)"}
        flexShrink={0}
      >
        ▼
      </Text>
    </Flex>

    {/* Expanded description */}
    <Box
      maxH={isExpanded ? "70px" : "0px"}
      opacity={isExpanded ? 1 : 0}
      overflowY={isExpanded ? "auto" : "hidden"}
      transition="max-height 0.25s ease, opacity 0.2s ease"
      css={{
        '&::-webkit-scrollbar': { width: '2px' },
        '&::-webkit-scrollbar-thumb': { background: color, borderRadius: '10px' },
      }}
    >
      <Text
        color="gray.300"
        fontSize={{ base: "2xs", sm: "xs" }}
        lineHeight="1.5"
        mt={1.5}
        pl={{ base: 6, md: 7 }}
        pr={1}
      >
        {full}
      </Text>
    </Box>
  </Box>
));

// ─── Stat Card ──────────────────────────────────────────────
const StatCard = memo(({ value, label, index }) => (
  <Box
    textAlign="center"
    animation={`${slideUp} 0.4s ease ${0.4 + index * 0.08}s both`}
    cursor="default"
  >
    <Text
      fontSize={{ base: "lg", md: "2xl" }}
      fontWeight="800"
      bgGradient="linear(to-r, #a855f7, #ec4899)"
      bgClip="text"
    >
      {value}
    </Text>
    <Text color="gray.500" fontSize={{ base: "2xs", md: "xs" }}>{label}</Text>
  </Box>
));

// ─── Trust Badge ────────────────────────────────────────────
const TrustBadge = memo(({ emoji, text, index }) => (
  <HStack
    spacing={1.5}
    px={{ base: 2, md: 3 }}
    py={{ base: 1, md: 1.5 }}
    bg="rgba(255,255,255,0.03)"
    borderRadius="full"
    border="1px solid rgba(255,255,255,0.06)"
    animation={`${slideUp} 0.4s ease ${0.6 + index * 0.08}s both`}
    cursor="default"
  >
    <Text fontSize={{ base: "xs", md: "sm" }}>{emoji}</Text>
    <Text color="gray.500" fontSize={{ base: "2xs", md: "xs" }}>{text}</Text>
  </HStack>
));

// ═════════════════════════════════════════════════════════════
function Homepage() {
  const history = useHistory();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [expandedFeature, setExpandedFeature] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("userInfo"));
    if (user) history.push("/chats");
  }, [history]);

  const handleFeatureEnter = useCallback((i) => setExpandedFeature(i), []);
  const handleFeatureLeave = useCallback(() => setExpandedFeature(null), []);

  return (
    <Box minH="100vh" w="100%" position="relative" overflow="auto" bg="#050510">
      {/* Simple gradient background — no blur, no GPU cost */}
      <Box
        position="fixed"
        inset={0}
        bg="linear-gradient(135deg, #050510 0%, #0a0a20 40%, #10051a 70%, #050510 100%)"
        zIndex={0}
      />

      {/* Subtle static orbs — opacity only, no filter blur */}
      <Box
        position="fixed"
        top="-8%"
        left="-4%"
        w={{ base: "200px", md: "350px" }}
        h={{ base: "200px", md: "350px" }}
        borderRadius="full"
        bg="radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)"
        pointerEvents="none"
      />
      <Box
        position="fixed"
        bottom="-8%"
        right="-4%"
        w={{ base: "220px", md: "400px" }}
        h={{ base: "220px", md: "400px" }}
        borderRadius="full"
        bg="radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)"
        pointerEvents="none"
      />

      {/* Main Content */}
      <Flex
        position="relative"
        zIndex={1}
        minH="100vh"
        w="100%"
        maxW="1400px"
        mx="auto"
        direction={{ base: "column", lg: "row" }}
        px={{ base: 4, md: 6, lg: 8 }}
        py={{ base: 6, lg: 0 }}
        gap={{ base: 6, lg: 8 }}
      >
        {/* ─── Left Section ─────────────────────────────── */}
        <Box
          flex={{ base: "none", lg: "1.2" }}
          display="flex"
          flexDirection="column"
          justifyContent="center"
          minH={{ base: "auto", lg: "100vh" }}
        >
          <VStack
            align={{ base: "center", lg: "flex-start" }}
            spacing={{ base: 4, md: 5 }}
            w="100%"
          >
            {/* Logo */}
            <HStack spacing={{ base: 3, md: 4 }} animation={`${slideUp} 0.4s ease both`}>
              <Box
                p={{ base: 2, md: 3 }}
                bg="rgba(168,85,247,0.15)"
                borderRadius="xl"
                border="1px solid rgba(168,85,247,0.3)"
              >
                <Text fontSize={{ base: "xl", md: "3xl" }}>💬</Text>
              </Box>
              <VStack align="flex-start" spacing={0}>
                <Text
                  fontSize={{ base: "xl", sm: "2xl", md: "3xl" }}
                  fontWeight="800"
                  background="linear-gradient(90deg, #a855f7, #ec4899, #f97316, #a855f7)"
                  backgroundSize="200% auto"
                  bgClip="text"
                  animation={`${shimmer} 4s linear infinite`}
                  fontFamily="Poppins, sans-serif"
                  lineHeight="1.2"
                  css={{ WebkitTextFillColor: "transparent" }}
                >
                  Connect Hub
                </Text>
                <Badge colorScheme="purple" variant="subtle" fontSize="2xs" borderRadius="full" px={2}>
                  Real-time Chat
                </Badge>
              </VStack>
            </HStack>

            {/* Tagline */}
            <VStack
              align={{ base: "center", lg: "flex-start" }}
              spacing={2}
              animation={`${slideUp} 0.4s ease 0.1s both`}
            >
              <Text
                fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
                fontWeight="600"
                color="white"
                textAlign={{ base: "center", lg: "left" }}
              >
                The Future of{" "}
                <Text
                  as="span"
                  background="linear-gradient(90deg, #a855f7, #ec4899, #a855f7)"
                  backgroundSize="200% auto"
                  bgClip="text"
                  animation={`${shimmer} 3s linear infinite`}
                  css={{ WebkitTextFillColor: "transparent" }}
                >
                  Real-time Communication
                </Text>
              </Text>
              <Text
                color="gray.400"
                fontSize={{ base: "xs", sm: "sm", md: "md" }}
                textAlign={{ base: "center", lg: "left" }}
                lineHeight="1.7"
                maxW="480px"
              >
                Connect with friends, share files instantly, and experience seamless
                messaging with our next-generation chat platform.
              </Text>
            </VStack>

            {/* Features Grid — uniform fixed-height cards */}
            <SimpleGrid
              columns={{ base: 2, md: 4 }}
              spacing={{ base: 2, md: 3 }}
              w="100%"
              alignItems="start"
            >
              {features.map((f, i) => (
                <FeatureCard
                  key={i}
                  index={i}
                  icon={f.icon}
                  title={f.title}
                  short={f.short}
                  full={f.full}
                  color={f.color}
                  isExpanded={expandedFeature === i}
                  onEnter={() => handleFeatureEnter(i)}
                  onLeave={handleFeatureLeave}
                />
              ))}
            </SimpleGrid>

            {/* Stats */}
            <HStack
              spacing={{ base: 6, md: 10 }}
              pt={{ base: 1, md: 2 }}
              flexWrap="wrap"
              justify={{ base: "center", lg: "flex-start" }}
              w="100%"
            >
              {[
                { value: "10K+", label: "Active Users" },
                { value: "50M+", label: "Messages Sent" },
                { value: "99.9%", label: "Uptime" },
                { value: "24/7", label: "Support" },
              ].map((s, i) => (
                <StatCard key={i} index={i} value={s.value} label={s.label} />
              ))}
            </HStack>

            {/* Trust Badges */}
            <Flex
              w="100%"
              align="center"
              justify={{ base: "center", lg: "flex-start" }}
              gap={{ base: 2, md: 3 }}
              pt={1}
              flexWrap="wrap"
            >
              <TrustBadge emoji="🔒" text="End-to-End Encrypted" index={0} />
              <TrustBadge emoji="🌐" text="Global Access" index={1} />
              <TrustBadge emoji="📱" text="Cross Platform" index={2} />
            </Flex>
          </VStack>
        </Box>

        {/* ─── Right Section - Auth Form ──────────────── */}
        <Box
          flex={{ base: "none", lg: "0.8" }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          minH={{ base: "auto", lg: "100vh" }}
          pb={{ base: 6, lg: 0 }}
        >
          <Box
            w={{ base: "100%", sm: "380px", md: "400px" }}
            maxH={{ base: "none", lg: "92vh" }}
            overflowY="auto"
            bg="rgba(10,10,25,0.95)"
            backdropFilter="blur(20px)"
            borderRadius={{ base: "xl", md: "2xl" }}
            border="1px solid rgba(255,255,255,0.1)"
            boxShadow="0 25px 80px rgba(0,0,0,0.5)"
            animation={`${slideUp} 0.5s ease 0.15s both`}
            css={{
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'linear-gradient(180deg, #a855f7, #ec4899)',
                borderRadius: '10px',
              },
            }}
          >
            {/* Top gradient border */}
            <Box
              h="3px"
              background="linear-gradient(90deg, #a855f7, #ec4899, #f97316, #a855f7)"
              backgroundSize="300% 100%"
              animation={`${gradientMove} 4s ease infinite`}
              borderTopRadius={{ base: "xl", md: "2xl" }}
            />

            {/* Header */}
            <Box p={{ base: 4, md: 5 }} textAlign="center" borderBottom="1px solid rgba(255,255,255,0.08)">
              <HStack justify="center" spacing={2} mb={1}>
                <Text fontSize={{ base: "lg", md: "xl" }}>💬</Text>
                <Text
                  fontSize={{ base: "lg", md: "xl" }}
                  fontWeight="700"
                  bgGradient="linear(to-r, #a855f7, #ec4899)"
                  bgClip="text"
                  fontFamily="Poppins, sans-serif"
                >
                  Connect Hub
                </Text>
              </HStack>
              <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }}>
                {showForgotPassword
                  ? "Reset your password"
                  : tabIndex === 0
                  ? "Welcome back! Sign in to continue"
                  : "Create your account today"}
              </Text>
            </Box>

            {/* Auth Content */}
            <Box p={{ base: 4, md: 5 }}>
              {showForgotPassword ? (
                <ForgotPassword onBack={() => setShowForgotPassword(false)} />
              ) : (
                <Tabs isFitted variant="unstyled" index={tabIndex} onChange={setTabIndex}>
                  <TabList
                    mb={{ base: 4, md: 5 }}
                    bg="rgba(255,255,255,0.03)"
                    p={1}
                    borderRadius="xl"
                    border="1px solid rgba(255,255,255,0.08)"
                  >
                    <Tab
                      fontWeight="600"
                      fontFamily="Poppins, sans-serif"
                      fontSize={{ base: "xs", md: "sm" }}
                      color="gray.500"
                      borderRadius="lg"
                      py={{ base: 2, md: 2.5 }}
                      transition="all 0.2s"
                      _selected={{
                        bgGradient: "linear(to-r, #a855f7, #ec4899)",
                        color: "white",
                        boxShadow: "0 4px 20px rgba(168,85,247,0.4)",
                      }}
                      _hover={{ color: "gray.300" }}
                    >
                      🔐 Login
                    </Tab>
                    <Tab
                      fontWeight="600"
                      fontFamily="Poppins, sans-serif"
                      fontSize={{ base: "xs", md: "sm" }}
                      color="gray.500"
                      borderRadius="lg"
                      py={{ base: 2, md: 2.5 }}
                      transition="all 0.2s"
                      _selected={{
                        bgGradient: "linear(to-r, #ec4899, #f97316)",
                        color: "white",
                        boxShadow: "0 4px 20px rgba(236,72,153,0.4)",
                      }}
                      _hover={{ color: "gray.300" }}
                    >
                      ✨ Sign Up
                    </Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel p={0}>
                      <Login onForgotPassword={() => setShowForgotPassword(true)} />
                    </TabPanel>
                    <TabPanel p={0}>
                      <Signup />
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              )}
            </Box>

            {/* Footer */}
            <Box
              p={{ base: 3, md: 4 }}
              bg="rgba(0,0,0,0.3)"
              textAlign="center"
              borderTop="1px solid rgba(255,255,255,0.08)"
              borderBottomRadius={{ base: "xl", md: "2xl" }}
            >
              <Text color="gray.600" fontSize={{ base: "2xs", md: "xs" }}>
                Made with 💜 • Connect Hub © 2025
              </Text>
            </Box>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}

export default Homepage;
