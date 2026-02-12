import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Flex,
  IconButton,
  Text,
  Avatar,
  VStack,
  HStack,
  Tooltip,
  Badge,
  keyframes,
} from "@chakra-ui/react";
import {
  PhoneIcon,
  CloseIcon,
} from "@chakra-ui/icons";
import { ChatState } from "../../Context/ChatProvider";
import useMediaPermissions from "../../hooks/useMediaPermissions";

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
`;

const VideoCall = ({
  isOpen,
  onClose,
  callType, // "audio" or "video"
  remoteUser,
  isIncoming,
  incomingOffer,
  socket,
}) => {
  const { user } = ChatState();
  const { getMediaStream } = useMediaPermissions();
  
  const [callStatus, setCallStatus] = useState(isIncoming ? "incoming" : "calling");
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const callIdRef = useRef(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // Initialize WebRTC
  const initializePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", {
          to: remoteUser._id,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        startCallTimer();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handleEndCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, remoteUser]);

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start the call (for caller)
  const startCall = useCallback(async () => {
    try {
      const stream = await getMediaStream({
        audio: true,
        video: callType === "video",
      });

      if (!stream) {
        onClose();
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = initializePeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:initiate", {
        to: remoteUser._id,
        callType,
        offer,
        callerInfo: {
          _id: user._id,
          name: user.name,
          pic: user.pic,
        },
      });

      setCallStatus("calling");
    } catch (error) {
      console.error("Error starting call:", error);
      onClose();
    }
  }, [callType, getMediaStream, initializePeerConnection, onClose, remoteUser, socket, user]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    try {
      const stream = await getMediaStream({
        audio: true,
        video: callType === "video",
      });

      if (!stream) {
        handleRejectCall();
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = initializePeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", {
        callId: callIdRef.current,
        answer,
        to: remoteUser._id,
      });

      setCallStatus("connecting");
    } catch (error) {
      console.error("Error accepting call:", error);
      handleRejectCall();
    }
  }, [callType, getMediaStream, initializePeerConnection, incomingOffer, remoteUser, socket]);

  // Reject call
  const handleRejectCall = useCallback(() => {
    socket.emit("call:reject", {
      callId: callIdRef.current,
      to: remoteUser._id,
      reason: "rejected",
    });
    onClose();
  }, [socket, remoteUser, onClose]);

  // End call
  const handleEndCall = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    socket.emit("call:end", {
      callId: callIdRef.current,
      to: remoteUser._id,
    });

    onClose();
  }, [socket, remoteUser, onClose]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("call:initiated", ({ callId }) => {
      callIdRef.current = callId;
    });

    socket.on("call:accepted", async ({ callId, answer }) => {
      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    });

    socket.on("call:rejected", ({ reason }) => {
      setCallStatus("rejected");
      setTimeout(onClose, 2000);
    });

    socket.on("call:ended", () => {
      handleEndCall();
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    return () => {
      socket.off("call:initiated");
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:ice-candidate");
    };
  }, [socket, handleEndCall, onClose]);

  // Start call on mount (for caller)
  useEffect(() => {
    if (!isIncoming && isOpen) {
      startCall();
    }
  }, [isOpen, isIncoming, startCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0, 0, 0, 0.95)"
      zIndex={9999}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      {/* Call Status Header */}
      <VStack position="absolute" top={8} spacing={2}>
        <Text color="gray.400" fontSize="sm">
          {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
        </Text>
        <Badge
          colorScheme={
            callStatus === "connected"
              ? "green"
              : callStatus === "rejected"
              ? "red"
              : "purple"
          }
          px={3}
          py={1}
          borderRadius="full"
        >
          {callStatus === "calling" && "Calling..."}
          {callStatus === "incoming" && "Incoming Call"}
          {callStatus === "connecting" && "Connecting..."}
          {callStatus === "connected" && formatDuration(callDuration)}
          {callStatus === "rejected" && "Call Rejected"}
        </Badge>
      </VStack>

      {/* Video/Avatar Display */}
      <Flex
        flex={1}
        width="100%"
        alignItems="center"
        justifyContent="center"
        position="relative"
        p={4}
      >
        {/* Remote Video/Avatar */}
        {callType === "video" && callStatus === "connected" ? (
          <Box
            width="100%"
            height="100%"
            maxW="800px"
            borderRadius="2xl"
            overflow="hidden"
            bg="gray.900"
          >
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
          </Box>
        ) : (
          <VStack spacing={4}>
            <Avatar
              size="2xl"
              name={remoteUser?.name}
              src={remoteUser?.pic}
              animation={callStatus === "calling" ? `${pulse} 2s infinite` : undefined}
            />
            <Text color="white" fontSize="2xl" fontWeight="bold">
              {remoteUser?.name}
            </Text>
          </VStack>
        )}

        {/* Local Video (PiP style) */}
        {callType === "video" && (
          <Box
            position="absolute"
            bottom={120}
            right={6}
            width="180px"
            height="240px"
            borderRadius="xl"
            overflow="hidden"
            border="3px solid"
            borderColor="purple.500"
            boxShadow="xl"
            bg="gray.800"
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
            {isVideoOff && (
              <Flex
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bg="gray.800"
                alignItems="center"
                justifyContent="center"
              >
                <Avatar size="lg" name={user?.name} src={user?.pic} />
              </Flex>
            )}
          </Box>
        )}
      </Flex>

      {/* Call Controls */}
      <HStack
        position="absolute"
        bottom={8}
        spacing={6}
        bg="rgba(255, 255, 255, 0.1)"
        backdropFilter="blur(10px)"
        borderRadius="full"
        p={4}
      >
        {/* For incoming calls - Accept/Reject */}
        {callStatus === "incoming" ? (
          <>
            <Tooltip label="Reject">
              <IconButton
                icon={<CloseIcon />}
                colorScheme="red"
                size="lg"
                borderRadius="full"
                onClick={handleRejectCall}
                aria-label="Reject call"
              />
            </Tooltip>
            <Tooltip label="Accept">
              <IconButton
                icon={<PhoneIcon />}
                colorScheme="green"
                size="lg"
                borderRadius="full"
                onClick={acceptCall}
                aria-label="Accept call"
              />
            </Tooltip>
          </>
        ) : (
          <>
            {/* Mute/Unmute */}
            <Tooltip label={isAudioMuted ? "Unmute" : "Mute"}>
              <IconButton
                icon={
                  isAudioMuted ? (
                    <Text fontSize="xl">🔇</Text>
                  ) : (
                    <Text fontSize="xl">🎤</Text>
                  )
                }
                bg={isAudioMuted ? "red.500" : "whiteAlpha.200"}
                color="white"
                size="lg"
                borderRadius="full"
                onClick={toggleAudio}
                aria-label="Toggle audio"
                _hover={{ bg: isAudioMuted ? "red.600" : "whiteAlpha.300" }}
              />
            </Tooltip>

            {/* Video Toggle */}
            {callType === "video" && (
              <Tooltip label={isVideoOff ? "Turn on camera" : "Turn off camera"}>
                <IconButton
                  icon={
                    isVideoOff ? (
                      <Text fontSize="xl">📷</Text>
                    ) : (
                      <Text fontSize="xl">📹</Text>
                    )
                  }
                  bg={isVideoOff ? "red.500" : "whiteAlpha.200"}
                  color="white"
                  size="lg"
                  borderRadius="full"
                  onClick={toggleVideo}
                  aria-label="Toggle video"
                  _hover={{ bg: isVideoOff ? "red.600" : "whiteAlpha.300" }}
                />
              </Tooltip>
            )}

            {/* End Call */}
            <Tooltip label="End Call">
              <IconButton
                icon={<PhoneIcon transform="rotate(135deg)" />}
                colorScheme="red"
                size="lg"
                borderRadius="full"
                onClick={handleEndCall}
                aria-label="End call"
              />
            </Tooltip>
          </>
        )}
      </HStack>
    </Box>
  );
};

export default VideoCall;

