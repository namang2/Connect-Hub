import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Button,
  VStack,
  Text,
  Box,
  Flex,
  Avatar,
  IconButton,
  HStack,
  keyframes,
  useToast,
} from "@chakra-ui/react";
import { PhoneIcon } from "@chakra-ui/icons";
import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

// Icons
const MicIcon = ({ isOn, ...props }) => (
  <Box as="span" {...props}>
    {isOn ? "🎤" : "🔇"}
  </Box>
);

const VideoIcon = ({ isOn, ...props }) => (
  <Box as="span" {...props}>
    {isOn ? "📹" : "📷"}
  </Box>
);

const EndCallIcon = (props) => (
  <Box as="span" {...props}>📵</Box>
);

const pulse = keyframes`
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
`;

const VideoCall = ({
  isOpen,
  onClose,
  socket,
  callInfo,
  isIncoming = false,
  callType = "video",
  chatId,
  userToken,
  onCallEnded,
}) => {
  const [callStatus, setCallStatus] = useState("connecting");
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const callDurationRef = useRef(0);
  const endCallCalledRef = useRef(false);

  const toast = useToast();

  const remoteAudioRef = useRef(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "b0bf4b2e0b812dea36db2664",
        credential: "mVT+xlBv8G2LFDeE",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "b0bf4b2e0b812dea36db2664",
        credential: "mVT+xlBv8G2LFDeE",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "b0bf4b2e0b812dea36db2664",
        credential: "mVT+xlBv8G2LFDeE",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "b0bf4b2e0b812dea36db2664",
        credential: "mVT+xlBv8G2LFDeE",
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Play remote audio reliably with retry and user gesture handling
  const playRemoteAudio = useCallback((stream) => {
    console.log("🔊 playRemoteAudio called, stream tracks:", stream.getAudioTracks().length);
    
    // Method 1: Use the dedicated audio ref
    if (remoteAudioRef.current) {
      const audioEl = remoteAudioRef.current;
      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
      audioEl.muted = false;
      audioEl.autoplay = true;
    }

    // Method 2: Also create a backup audio element (some browsers need this)
    const backupAudio = new Audio();
    backupAudio.srcObject = stream;
    backupAudio.volume = 1.0;
    backupAudio.autoplay = true;

    let retries = 0;
    const maxRetries = 15;
    const tryPlay = () => {
      const audioEl = remoteAudioRef.current || backupAudio;
      if (!audioEl || !audioEl.srcObject) return;
      
      // Ensure srcObject is still set
      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
      audioEl.muted = false;

      audioEl.play()
        .then(() => {
          console.log("✅ Remote audio playing successfully (attempt " + (retries + 1) + ")");
          setAudioBlocked(false);
        })
        .catch((err) => {
          console.log(`Audio play attempt ${retries + 1} failed:`, err.message);
          if (retries < maxRetries) {
            retries++;
            setTimeout(tryPlay, 200 * retries);
          } else {
            console.log("⚠️ Audio autoplay blocked. Showing unmute button.");
            setAudioBlocked(true);
          }
        });
      
      // Also try the backup
      if (audioEl !== backupAudio) {
        backupAudio.play().catch(() => {});
      }
    };
    
    // Start trying immediately
    tryPlay();
  }, []);

  // Manual audio unlock (for browsers that block autoplay)
  const unlockAudio = useCallback(() => {
    // Try playing the ref audio element
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play()
        .then(() => {
          console.log("✅ Audio unlocked by user gesture (ref)");
          setAudioBlocked(false);
        })
        .catch((err) => console.error("Audio unlock failed:", err));
    }
    
    // Also try creating a fresh audio element from the remote stream
    if (remoteStream) {
      const freshAudio = new Audio();
      freshAudio.srcObject = remoteStream;
      freshAudio.volume = 1.0;
      freshAudio.play()
        .then(() => {
          console.log("✅ Audio unlocked via fresh element");
          setAudioBlocked(false);
        })
        .catch((err) => console.error("Fresh audio unlock failed:", err));
    }
  }, [remoteStream]);

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });

      if (localVideoRef.current && callType === "video") {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      // Fallback: try audio only if video+audio failed
      if (callType === "video") {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          localStreamRef.current = audioStream;
          return audioStream;
        } catch (audioErr) {
          console.error("Audio-only fallback also failed:", audioErr);
        }
      }
      toast({
        title: "Media Error",
        description: "Could not access camera/microphone. Please check permissions.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return null;
    }
  }, [callType, toast]);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", {
          to: callInfo?.recipientId || callInfo?.callerId,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 Remote track received:", event.track.kind, "readyState:", event.track.readyState, "enabled:", event.track.enabled);
      const stream = event.streams[0];
      setRemoteStream(stream);

      if (remoteVideoRef.current && event.track.kind === "video") {
        remoteVideoRef.current.srcObject = stream;
      }

      // Always play audio via dedicated audio element for ANY track event
      // This ensures audio plays whether it arrives as audio track or combined stream
      if (stream && stream.getAudioTracks().length > 0) {
        console.log("🔊 Audio tracks available:", stream.getAudioTracks().length, "- attempting playback...");
        // Ensure audio tracks are enabled
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
          console.log("  Audio track:", track.id, "enabled:", track.enabled, "readyState:", track.readyState);
        });
        playRemoteAudio(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        // Start timer if not already started
        if (!callTimerRef.current) {
          callTimerRef.current = setInterval(() => {
            callDurationRef.current += 1;
            setCallDuration(callDurationRef.current);
          }, 1000);
        }
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        // Use ref-based endCall to avoid stale closure
        if (!endCallCalledRef.current) {
          endCallCalledRef.current = true;
          // Stop all local tracks
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
          }
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
          }
          onClose();
        }
      }
    };

    // Add local tracks
    const stream = localStreamRef.current || await initializeMedia();
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, callInfo, initializeMedia, playRemoteAudio, onClose]);

  // Make outgoing call
  const makeCall = useCallback(async () => {
    try {
      setCallStatus("calling");
      await initializeMedia();
      const pc = await createPeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });
      await pc.setLocalDescription(offer);

      socket.emit("call:initiate", {
        to: callInfo.recipientId,
        callType,
        offer,
        callerInfo: callInfo.callerInfo,
      });
    } catch (error) {
      console.error("Error making call:", error);
      toast({
        title: "Call Failed",
        description: "Could not initiate the call",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo, callType, toast]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      await initializeMedia();
      const pc = await createPeerConnection();

      if (callInfo?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callInfo.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("call:accept", {
          callId: callInfo.callId,
          answer,
          to: callInfo.callerId,
        });
      }
    } catch (error) {
      console.error("Error answering call:", error);
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo]);

  // Save call record to chat
  const saveCallRecord = useCallback(async (duration, status) => {
    if (!chatId || !userToken) return;
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      };
      const { data } = await axios.post(
        "/api/message/call",
        { chatId, callType, duration, status },
        config
      );
      // Emit the call record as a message so both sides see it
      if (socket) {
        socket.emit("new message", data);
      }
      if (onCallEnded) onCallEnded(data);
    } catch (err) {
      console.error("Failed to save call record:", err);
    }
  }, [chatId, userToken, callType, socket, onCallEnded]);

  // End call
  const endCall = useCallback((status) => {
    if (endCallCalledRef.current) return;
    endCallCalledRef.current = true;

    const finalDuration = callDurationRef.current;

    // Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    // Notify other party
    if (socket && callInfo) {
      socket.emit("call:end", {
        callId: callInfo.callId,
        to: callInfo?.recipientId || callInfo?.callerId,
      });
    }

    // Save call record (only caller saves to avoid duplicates)
    if (!isIncoming) {
      saveCallRecord(finalDuration, status || "ended");
    }

    onClose();
  }, [socket, callInfo, onClose, isIncoming, saveCallRecord]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleCallAccepted = async ({ answer }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        }
      } catch (error) {
        console.error("Error handling call accepted:", error);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    };

    const handleCallEnded = () => {
      toast({
        title: "Call Ended",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      endCall();
    };

    const handleCallRejected = ({ reason }) => {
      toast({
        title: "Call Rejected",
        description: reason || "The other party declined the call",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      endCall("declined");
    };

    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:rejected", handleCallRejected);

    return () => {
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:rejected", handleCallRejected);
    };
  }, [socket, endCall, toast]);

  // Initialize call
  useEffect(() => {
    if (isOpen) {
      endCallCalledRef.current = false;
      callDurationRef.current = 0;
      if (isIncoming) {
        answerCall();
      } else {
        makeCall();
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isOpen, isIncoming, answerCall, makeCall]);

  const recipientInfo = callInfo?.recipientInfo || callInfo?.callerInfo;

  return (
    <Modal isOpen={isOpen} onClose={endCall} size="full">
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="#0a0a1a" borderRadius="0" m={0}>
        <ModalBody p={0} display="flex" flexDirection="column" h="100vh">
          {/* Audio element for reliable remote audio playback - positioned off-screen (NOT display:none) */}
          <audio 
            ref={remoteAudioRef} 
            autoPlay 
            playsInline 
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }} 
          />
          
          {/* Audio blocked overlay - user needs to tap to enable audio */}
          {audioBlocked && callStatus === "connected" && (
            <Flex
              position="absolute"
              top="70px"
              left="50%"
              transform="translateX(-50%)"
              zIndex={10}
              bg="rgba(245, 87, 108, 0.9)"
              px={4}
              py={2}
              borderRadius="full"
              align="center"
              gap={2}
              cursor="pointer"
              onClick={unlockAudio}
              _hover={{ bg: "rgba(245, 87, 108, 1)" }}
              boxShadow="0 4px 20px rgba(245, 87, 108, 0.4)"
            >
              <Text color="white" fontSize="sm" fontWeight="600">
                🔊 Tap to enable audio
              </Text>
            </Flex>
          )}
          {/* Main video area */}
          <Box flex="1" position="relative" bg="black">
            {/* Remote video (full screen) */}
            {callType === "video" && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Flex
                h="100%"
                align="center"
                justify="center"
                direction="column"
                gap={{ base: 3, md: 4 }}
                px={4}
              >
                <Avatar
                  size={{ base: "xl", md: "2xl" }}
                  name={recipientInfo?.name}
                  src={recipientInfo?.pic}
                  border="4px solid"
                  borderColor="purple.500"
                />
                <Text color="white" fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" textAlign="center" isTruncated maxW="80%">
                  {recipientInfo?.name}
                </Text>
                <Text
                  color="gray.400"
                  fontSize={{ base: "sm", md: "md" }}
                  animation={callStatus === "calling" ? `${pulse} 1.5s infinite` : undefined}
                >
                  {callStatus === "calling"
                    ? "Calling..."
                    : callStatus === "connected"
                    ? formatDuration(callDuration)
                    : "Connecting..."}
                </Text>
              </Flex>
            )}

            {/* Local video (picture-in-picture) */}
            {callType === "video" && (
              <Box
                position="absolute"
                bottom={{ base: "120px", md: "100px" }}
                right={{ base: "10px", md: "20px" }}
                w={{ base: "100px", md: "200px" }}
                h={{ base: "140px", md: "150px" }}
                borderRadius="xl"
                overflow="hidden"
                border="2px solid rgba(255,255,255,0.2)"
                boxShadow="xl"
                bg="gray.900"
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
                {!isVideoOn && (
                  <Flex
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    align="center"
                    justify="center"
                    bg="gray.800"
                  >
                    <Text fontSize="2xl">📷</Text>
                  </Flex>
                )}
              </Box>
            )}

            {/* Call status overlay */}
            <Flex
              position="absolute"
              top="20px"
              left="50%"
              transform="translateX(-50%)"
              bg="rgba(0,0,0,0.6)"
              px={4}
              py={2}
              borderRadius="full"
              align="center"
              gap={2}
            >
              <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg={callStatus === "connected" ? "green.400" : "yellow.400"}
                animation={callStatus !== "connected" ? `${pulse} 1s infinite` : undefined}
              />
              <Text color="white" fontSize="sm" fontWeight="500">
                {callStatus === "connected"
                  ? formatDuration(callDuration)
                  : callStatus === "calling"
                  ? "Calling..."
                  : "Connecting..."}
              </Text>
            </Flex>
          </Box>

          {/* Call controls */}
          <Flex
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            justify="center"
            p={{ base: 4, md: 6 }}
            bg="linear-gradient(transparent, rgba(0,0,0,0.8))"
          >
            <HStack spacing={{ base: 4, md: 6 }}>
              {/* Mute button */}
              <IconButton
                icon={<MicIcon isOn={isAudioOn} fontSize={{ base: "lg", md: "xl" }} />}
                onClick={toggleAudio}
                size={{ base: "md", md: "lg" }}
                borderRadius="full"
                bg={isAudioOn ? "whiteAlpha.200" : "red.500"}
                color="white"
                _hover={{ transform: "scale(1.1)" }}
                w={{ base: "48px", md: "60px" }}
                h={{ base: "48px", md: "60px" }}
                aria-label={isAudioOn ? "Mute" : "Unmute"}
              />

              {/* Video toggle (only for video calls) */}
              {callType === "video" && (
                <IconButton
                  icon={<VideoIcon isOn={isVideoOn} fontSize={{ base: "lg", md: "xl" }} />}
                  onClick={toggleVideo}
                  size={{ base: "md", md: "lg" }}
                  borderRadius="full"
                  bg={isVideoOn ? "whiteAlpha.200" : "red.500"}
                  color="white"
                  _hover={{ transform: "scale(1.1)" }}
                  w={{ base: "48px", md: "60px" }}
                  h={{ base: "48px", md: "60px" }}
                  aria-label={isVideoOn ? "Turn off video" : "Turn on video"}
                />
              )}

              {/* End call button */}
              <IconButton
                icon={<EndCallIcon fontSize={{ base: "lg", md: "xl" }} />}
                onClick={endCall}
                size={{ base: "md", md: "lg" }}
                borderRadius="full"
                bg="red.500"
                color="white"
                _hover={{ bg: "red.600", transform: "scale(1.1)" }}
                w={{ base: "56px", md: "70px" }}
                h={{ base: "56px", md: "70px" }}
                aria-label="End call"
              />
            </HStack>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default VideoCall;

