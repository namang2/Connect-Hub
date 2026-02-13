import { useState } from "react";
import { Avatar } from "@chakra-ui/avatar";
import { Tooltip } from "@chakra-ui/tooltip";
import { Image, Link, Box, Text, Icon, Badge, Flex, IconButton, Spinner } from "@chakra-ui/react";
import { DownloadIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import ScrollableFeed from "react-scrollable-feed";
import {
  isLastMessage,
  isSameSender,
  isSameSenderMargin,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";

// Helper to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Helper: trigger download from a blob
const triggerBlobDownload = (blob, fileName) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }, 500);
};

// Download file — ALWAYS goes through backend proxy which uses
// Cloudinary private_download_url API (bypasses 401) and forces attachment download.
const downloadFile = async (url, fileName) => {
  const safeName = fileName || "download";

  const userInfo = JSON.parse(localStorage.getItem("userInfo"));
  if (!userInfo?.token) throw new Error("Not authenticated");

  const proxyUrl = `/api/message/download?url=${encodeURIComponent(
    url
  )}&name=${encodeURIComponent(safeName)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

  const response = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${userInfo.token}` },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Download failed (status ${response.status})`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  triggerBlobDownload(blob, safeName);
};

// Location Message Component with Map Preview
const LocationMessage = ({ location, isSender }) => {
  if (!location || !location.latitude || !location.longitude) return null;

  const { latitude, longitude, isLive, expiresAt } = location;
  
  // Check if live location has expired
  const isExpired = isLive && expiresAt && new Date() > new Date(expiresAt);
  
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <Box
      maxW={{ base: "250px", md: "300px" }}
      borderRadius="xl"
      overflow="hidden"
      boxShadow="lg"
      bg="white"
    >
      {/* Map Preview */}
      <Box
        position="relative"
        h="150px"
        bgGradient="linear(to-br, blue.400, teal.300, purple.500)"
      >
        {/* Gradient map placeholder */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0,0,0,0.1)"
        />
        
        {/* Location Pin Icon */}
        <Flex
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -100%)"
          flexDir="column"
          alignItems="center"
        >
          <Text fontSize="3xl">📍</Text>
        </Flex>

        {/* Live Badge */}
        {isLive && !isExpired && (
          <Badge
            position="absolute"
            top={2}
            left={2}
            colorScheme="red"
            variant="solid"
            borderRadius="full"
            px={2}
            display="flex"
            alignItems="center"
            gap={1}
          >
            <Box
              w={2}
              h={2}
              bg="white"
              borderRadius="full"
              animation="pulse 1.5s infinite"
            />
            LIVE
          </Badge>
        )}

        {isExpired && (
          <Badge
            position="absolute"
            top={2}
            left={2}
            colorScheme="gray"
            variant="solid"
            borderRadius="full"
            px={2}
          >
            Expired
          </Badge>
        )}
      </Box>

      {/* Location Info */}
      <Box p={3}>
        <Text fontWeight="600" fontSize="sm" color="gray.700">
          {isLive ? "📍 Live Location" : "📍 Current Location"}
        </Text>
        <Text fontSize="xs" color="gray.500" mt={1}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
        
        {/* Open in Maps Button */}
        <Link
          href={directionsUrl}
          isExternal
          _hover={{ textDecoration: "none" }}
        >
          <Flex
            mt={2}
            p={2}
            bg={isSender ? "purple.500" : "pink.500"}
            color="white"
            borderRadius="lg"
            alignItems="center"
            justifyContent="center"
            gap={2}
            fontSize="sm"
            fontWeight="500"
            _hover={{ opacity: 0.9 }}
            transition="all 0.2s"
          >
            <ExternalLinkIcon />
            Open in Maps
          </Flex>
        </Link>
      </Box>
    </Box>
  );
};

// File message component — ALL files download through backend proxy
const FileMessage = ({ file, isSender }) => {
  const [downloading, setDownloading] = useState(false);

  if (!file || !file.url) return null;

  const [downloadError, setDownloadError] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadFile(file.url, file.name);
    } catch (err) {
      console.error("Download error:", err.message);
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 3000);
    } finally {
      setDownloading(false);
    }
  };

  // Download button used across all file types
  const DownloadBtn = ({ size = "sm", position, top, right, ...rest }) => (
    <IconButton
      icon={downloading ? <Spinner size="xs" /> : <DownloadIcon />}
      position={position}
      top={top}
      right={right}
      size={size}
      colorScheme="purple"
      borderRadius="full"
      onClick={handleDownload}
      isDisabled={downloading}
      aria-label="Download"
      {...rest}
    />
  );

  // Image files
  if (file.type === "image") {
    return (
      <Box maxW={{ base: "200px", md: "300px" }}>
        <Box position="relative">
          <Image
            src={file.url}
            alt={file.name || "Image"}
            borderRadius="xl"
            maxH="250px"
            objectFit="cover"
            cursor="pointer"
            onClick={handleDownload}
            _hover={{ transform: "scale(1.02)", transition: "all 0.2s" }}
            boxShadow="md"
            opacity={downloading ? 0.6 : 1}
          />
          <DownloadBtn position="absolute" top={2} right={2} />
        </Box>
        {file.name && (
          <Text fontSize="xs" mt={1} color="gray.500" isTruncated>
            {file.name}
          </Text>
        )}
      </Box>
    );
  }

  // Video files
  if (file.type === "video") {
    return (
      <Box maxW={{ base: "250px", md: "350px" }}>
        <Box position="relative">
          <video
            controls
            style={{
              borderRadius: "15px",
              maxHeight: "250px",
              width: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <source src={file.url} />
            Your browser does not support video.
          </video>
          <DownloadBtn position="absolute" top={2} right={2} />
        </Box>
        {file.name && (
          <Text fontSize="xs" mt={1} color="gray.500" isTruncated>
            {file.name}
          </Text>
        )}
      </Box>
    );
  }

  // Audio files
  if (file.type === "audio") {
    return (
      <Box
        bg={isSender ? "purple.50" : "pink.50"}
        p={3}
        borderRadius="xl"
        boxShadow="sm"
      >
        <Flex justify="space-between" align="center" mb={2}>
          <Text fontSize="xs" color="gray.600" fontWeight="500">
            🎵 Audio File
          </Text>
          <DownloadBtn size="xs" />
        </Flex>
        <audio controls style={{ maxWidth: "250px", width: "100%" }}>
          <source src={file.url} />
          Your browser does not support audio.
        </audio>
        {file.name && (
          <Text fontSize="xs" mt={1} color="gray.500" isTruncated>
            {file.name}
          </Text>
        )}
      </Box>
    );
  }

  // Document / Other files
  return (
    <Box
      bgGradient={isSender ? "linear(to-r, purple.100, blue.100)" : "linear(to-r, pink.100, orange.100)"}
      p={3}
      borderRadius="xl"
      display="flex"
      alignItems="center"
      gap={3}
      maxW={{ base: "220px", md: "300px" }}
      _hover={{ transform: "translateY(-2px)", boxShadow: "md" }}
      transition="all 0.2s"
      boxShadow="sm"
      cursor="pointer"
      onClick={handleDownload}
      opacity={downloading ? 0.7 : 1}
    >
      <Box
        bg={isSender ? "purple.500" : "pink.500"}
        p={2}
        borderRadius="lg"
        color="white"
        flexShrink={0}
      >
        {downloading ? <Spinner size="sm" color="white" /> : <Icon as={DownloadIcon} boxSize={5} />}
      </Box>
      <Box flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="600" isTruncated color="gray.700">
          {file.name || "File"}
        </Text>
        <Text fontSize="xs" color="gray.500">
          {formatFileSize(file.size)} • {downloading ? "Downloading..." : "Click to download"}
        </Text>
      </Box>
    </Box>
  );
};

const ScrollableChat = ({ messages }) => {
  const { user } = ChatState();

  // Get message bubble style based on sender - responsive
  const getBubbleStyle = (m, i) => {
    const isSender = m.sender._id === user._id;
    const isSpecial = m.isFile || m.isLocation;

    return {
      background: isSpecial
        ? "transparent"
        : isSender
        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      color: isSpecial ? "inherit" : "white",
      marginLeft: isSameSenderMargin(messages, m, i, user._id),
      marginTop: isSameUser(messages, m, i, user._id) ? 3 : 10,
      borderRadius: isSender ? "20px 20px 5px 20px" : "20px 20px 20px 5px",
      padding: isSpecial ? "4px" : "8px 12px",
      maxWidth: "min(85%, 500px)",
      boxShadow: isSpecial ? "none" : "0 2px 8px rgba(0,0,0,0.1)",
      fontSize: "clamp(13px, 2.5vw, 16px)",
      wordBreak: "break-word",
      overflowWrap: "break-word",
    };
  };

  return (
    <ScrollableFeed>
      {messages &&
        messages.map((m, i) => (
          <div style={{ display: "flex" }} key={m._id}>
            {(isSameSender(messages, m, i, user._id) ||
              isLastMessage(messages, i, user._id)) && (
              <Tooltip label={m.sender.name} placement="bottom-start" hasArrow>
                <Avatar
                  mt="7px"
                  mr={2}
                  size="sm"
                  cursor="pointer"
                  name={m.sender.name}
                  src={m.sender.pic}
                  border="2px solid"
                  borderColor="purple.200"
                />
              </Tooltip>
            )}
            <span style={getBubbleStyle(m, i)}>
              {m.isLocation && m.location ? (
                <LocationMessage
                  location={m.location}
                  isSender={m.sender._id === user._id}
                />
              ) : m.isFile && m.file ? (
                <FileMessage
                  file={m.file}
                  isSender={m.sender._id === user._id}
                />
              ) : (
                m.content
              )}
            </span>
          </div>
        ))}
    </ScrollableFeed>
  );
};

export default ScrollableChat;
