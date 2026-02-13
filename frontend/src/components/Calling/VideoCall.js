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
  const [localStream, setLocalStream] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const callDurationRef = useRef(0);
  const endCallCalledRef = useRef(false);
  const iceCandidateBuffer = useRef([]);
  const remoteDescriptionSet = useRef(false);

  const toast = useToast();

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

  // ───── useEffect: Attach LOCAL stream to local video element ─────
  useEffect(() => {
    if (localVideoRef.current && localStream && callType === "video") {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  // ───── useEffect: Attach REMOTE stream to remote video + audio elements ─────
  // This is the KEY fix: instead of setting srcObject inside ontrack (which races
  // with React's conditional rendering), we set it here after React has rendered
  // the <video>/<audio> elements.
  useEffect(() => {
    if (!remoteStream) return;

    // Attach to the video element
    if (remoteVideoRef.current) {
      console.log("🎥 useEffect: attaching remoteStream to video element");
      remoteVideoRef.current.srcObject = remoteStream;
    }

    // Attach to the audio element and play
    if (remoteAudioRef.current) {
      console.log("🔊 useEffect: attaching remoteStream to audio element");
      const audioEl = remoteAudioRef.current;
      audioEl.srcObject = remoteStream;
      audioEl.volume = 1.0;
      audioEl.muted = false;

      let retries = 0;
      const maxRetries = 20;
      const tryPlay = () => {
        if (!audioEl.srcObject) return;
        audioEl.play()
          .then(() => {
            console.log("✅ Remote audio playing (attempt " + (retries + 1) + ")");
            setAudioBlocked(false);
          })
          .catch((err) => {
            console.log(`Audio play attempt ${retries + 1} failed:`, err.message);
            if (retries < maxRetries) {
              retries++;
              setTimeout(tryPlay, 300 * Math.min(retries, 5));
            } else {
              console.log("⚠️ Audio autoplay blocked. User must tap to enable.");
              setAudioBlocked(true);
            }
          });
      };
      tryPlay();

      // Also create a backup audio element (some browsers need this)
      try {
        const backup = new Audio();
        backup.srcObject = remoteStream;
        backup.volume = 1.0;
        backup.play().catch(() => {});
      } catch (e) {
        // Ignore
      }
    }

    // Enable all audio tracks on the remote stream
    remoteStream.getAudioTracks().forEach((t) => {
      t.enabled = true;
      console.log("  Remote audio track:", t.id, "enabled:", t.enabled, "readyState:", t.readyState);
    });
    remoteStream.getVideoTracks().forEach((t) => {
      t.enabled = true;
      console.log("  Remote video track:", t.id, "enabled:", t.enabled, "readyState:", t.readyState);
    });
  }, [remoteStream]);

  // Manual audio unlock (for browsers that block autoplay)
  const unlockAudio = useCallback(() => {
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play()
        .then(() => {
          console.log("✅ Audio unlocked by user gesture");
          setAudioBlocked(false);
        })
        .catch((err) => console.error("Audio unlock failed:", err));
    }
    if (remoteStream) {
      const fresh = new Audio();
      fresh.srcObject = remoteStream;
      fresh.volume = 1.0;
      fresh.play()
        .then(() => {
          console.log("✅ Audio unlocked via fresh element");
          setAudioBlocked(false);
        })
        .catch((err) => console.error("Fresh audio unlock failed:", err));
    }
  }, [remoteStream]);

  // ───── Initialize local media stream ─────
  const initializeMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
      };

      console.log("📷🎤 Requesting getUserMedia with constraints:", JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Ensure all tracks are enabled
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      stream.getVideoTracks().forEach((t) => { t.enabled = true; });

      console.log("✅ Got local stream:", stream.getTracks().map((t) => `${t.kind}:${t.enabled}`));
      return stream;
    } catch (error) {
      console.error("❌ Error accessing media devices:", error);
      // Fallback: try audio only if video+audio failed
      if (callType === "video") {
        try {
          console.log("🔄 Falling back to audio-only...");
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setIsVideoOn(false);
          return audioStream;
        } catch (audioErr) {
          console.error("❌ Audio-only fallback also failed:", audioErr);
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

  // ───── Flush buffered ICE candidates ─────
  const flushIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !remoteDescriptionSet.current) return;

    while (iceCandidateBuffer.current.length > 0) {
      const candidate = iceCandidateBuffer.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("✅ Buffered ICE candidate added");
      } catch (err) {
        console.error("Error adding buffered ICE candidate:", err);
      }
    }
  }, []);

  // ───── Start call timer ─────
  const startTimer = useCallback(() => {
    if (callTimerRef.current) return; // already running
    console.log("⏱️ Call timer started");
    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallDuration(callDurationRef.current);
    }, 1000);
  }, []);

  // ───── Create peer connection ─────
  const createPeerConnection = useCallback(async () => {
    console.log("🔗 Creating RTCPeerConnection...");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send ICE candidates to the other peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const to = callInfo?.recipientId || callInfo?.callerId;
        console.log("🧊 Sending ICE candidate to:", to);
        socket.emit("call:ice-candidate", {
          to,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
        startTimer();
      }
    };

    // ──── ontrack: receive remote media ────
    pc.ontrack = (event) => {
      console.log("📡 Remote track received:", event.track.kind, "readyState:", event.track.readyState);
      const stream = event.streams[0];
      if (stream) {
        // Set remoteStream state — the useEffect above will handle attaching
        // it to the video/audio DOM elements AFTER React renders them.
        setRemoteStream(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        startTimer();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        if (!endCallCalledRef.current) {
          endCallCalledRef.current = true;
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
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

    // Add local tracks to the peer connection
    const stream = localStreamRef.current || (await initializeMedia());
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log("➕ Adding local track:", track.kind, "enabled:", track.enabled);
        pc.addTrack(track, stream);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, callInfo, initializeMedia, onClose, startTimer]);

  // ───── Make outgoing call (caller side) ─────
  const makeCall = useCallback(async () => {
    try {
      setCallStatus("calling");
      console.log("📞 Making outgoing call...");
      await initializeMedia();
      const pc = await createPeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });
      await pc.setLocalDescription(offer);
      console.log("📤 Sending offer to:", callInfo.recipientId);

      socket.emit("call:initiate", {
        to: callInfo.recipientId,
        callType,
        offer,
        callerInfo: callInfo.callerInfo,
      });
    } catch (error) {
      console.error("❌ Error making call:", error);
      toast({
        title: "Call Failed",
        description: "Could not initiate the call. Check your network.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo, callType, toast]);

  // ───── Answer incoming call (receiver side) ─────
  const answerCall = useCallback(async () => {
    try {
      setCallStatus("connecting");
      console.log("📞 Answering incoming call...");
      await initializeMedia();
      const pc = await createPeerConnection();

      if (callInfo?.offer) {
        console.log("📥 Setting remote description (offer)...");
        await pc.setRemoteDescription(new RTCSessionDescription(callInfo.offer));
        remoteDescriptionSet.current = true;

        // Flush any ICE candidates that arrived before we set the remote description
        await flushIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("📤 Sending answer to:", callInfo.callerId);

        socket.emit("call:accept", {
          callId: callInfo.callId,
          answer,
          to: callInfo.callerId,
        });
      }
    } catch (error) {
      console.error("❌ Error answering call:", error);
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo, flushIceCandidates]);

  // ───── Save call record to chat ─────
  const saveCallRecord = useCallback(
    async (duration, status) => {
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
        if (socket) {
          socket.emit("new message", data);
        }
        if (onCallEnded) onCallEnded(data);
      } catch (err) {
        console.error("Failed to save call record:", err);
      }
    },
    [chatId, userToken, callType, socket, onCallEnded]
  );

  // ───── End call ─────
  const endCall = useCallback(
    (status) => {
      if (endCallCalledRef.current) return;
      endCallCalledRef.current = true;
      console.log("📵 Ending call, status:", status || "ended");

      const finalDuration = callDurationRef.current;

      // Stop all local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
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
    },
    [socket, callInfo, onClose, isIncoming, saveCallRecord]
  );

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

  // ───── Socket event handlers ─────
  useEffect(() => {
    if (!socket) return;

    const handleCallAccepted = async ({ answer }) => {
      try {
        console.log("✅ Call accepted — setting remote description (answer)...");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          remoteDescriptionSet.current = true;
          // Flush any ICE candidates that arrived before the answer
          while (iceCandidateBuffer.current.length > 0) {
            const candidate = iceCandidateBuffer.current.shift();
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
              console.log("✅ Buffered ICE candidate added (caller side)");
            } catch (err) {
              console.error("Error adding buffered ICE candidate:", err);
            }
          }
        }
      } catch (error) {
        console.error("Error handling call accepted:", error);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (!candidate) return;

        // If remote description is not yet set, buffer the candidate
        if (!remoteDescriptionSet.current || !peerConnectionRef.current) {
          console.log("🧊 Buffering ICE candidate (remote description not set yet)");
          iceCandidateBuffer.current.push(candidate);
          return;
        }

        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
        console.log("✅ ICE candidate added immediately");
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

  // ───── Initialize call when modal opens ─────
  useEffect(() => {
    if (isOpen) {
      endCallCalledRef.current = false;
      callDurationRef.current = 0;
      remoteDescriptionSet.current = false;
      iceCandidateBuffer.current = [];
      setCallDuration(0);
      setCallStatus("connecting");
      setRemoteStream(null);

      if (isIncoming) {
        answerCall();
      } else {
        makeCall();
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [isOpen, isIncoming, answerCall, makeCall]);

  const recipientInfo = callInfo?.recipientInfo || callInfo?.callerInfo;

  return (
    <Modal isOpen={isOpen} onClose={endCall} size="full">
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="#0a0a1a" borderRadius="0" m={0}>
        <ModalBody p={0} display="flex" flexDirection="column" h="100vh">
          {/* 
            Audio element — ALWAYS rendered, positioned off-screen.
            The useEffect above handles attaching remoteStream to it.
          */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
          />

          {/* Audio blocked overlay */}
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

          {/* Main video / avatar area */}
          <Box flex="1" position="relative" bg="black">
            {/* 
              Remote video — ALWAYS rendered (not conditional on remoteStream).
              Shown when we have a remote stream + video call; hidden otherwise.
              This avoids the ref-is-null race condition.
            */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display:
                  callType === "video" && remoteStream ? "block" : "none",
              }}
            />

            {/* Avatar fallback — shown during voice calls or before remote video arrives */}
            {(callType !== "video" || !remoteStream) && (
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
                <Text
                  color="white"
                  fontSize={{ base: "lg", md: "2xl" }}
                  fontWeight="bold"
                  textAlign="center"
                  isTruncated
                  maxW="80%"
                >
                  {recipientInfo?.name}
                </Text>
                <Text
                  color="gray.400"
                  fontSize={{ base: "sm", md: "md" }}
                  animation={
                    callStatus !== "connected"
                      ? `${pulse} 1.5s infinite`
                      : undefined
                  }
                >
                  {callStatus === "calling"
                    ? "Calling..."
                    : callStatus === "connected"
                    ? formatDuration(callDuration)
                    : "Connecting..."}
                </Text>
              </Flex>
            )}

            {/* Local video (picture-in-picture) — ALWAYS rendered for video calls */}
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

            {/* Call status overlay (top bar) */}
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
                animation={
                  callStatus !== "connected"
                    ? `${pulse} 1s infinite`
                    : undefined
                }
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
                icon={
                  <MicIcon
                    isOn={isAudioOn}
                    fontSize={{ base: "lg", md: "xl" }}
                  />
                }
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

              {/* Video toggle */}
              {callType === "video" && (
                <IconButton
                  icon={
                    <VideoIcon
                      isOn={isVideoOn}
                      fontSize={{ base: "lg", md: "xl" }}
                    />
                  }
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
                icon={
                  <EndCallIcon fontSize={{ base: "lg", md: "xl" }} />
                }
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
