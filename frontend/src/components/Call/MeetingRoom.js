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
  Grid,
  useToast,
  keyframes,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { ChatState } from "../../Context/ChatProvider";
import useMediaPermissions from "../../hooks/useMediaPermissions";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const MeetingRoom = ({
  isOpen,
  onClose,
  chatId,
  chatName,
  meetingId: existingMeetingId,
  socket,
}) => {
  const { user } = ChatState();
  const { getMediaStream, getScreenShareStream } = useMediaPermissions();
  const toast = useToast();

  const [meetingId, setMeetingId] = useState(existingMeetingId);
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const meetingTimerRef = useRef(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Create peer connection for a participant
  const createPeerConnection = useCallback((socketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("meeting:ice-candidate", {
          meetingId,
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamsRef.current.set(socketId, event.streams[0]);
      setParticipants((prev) => [...prev]); // Force re-render
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionsRef.current.set(socketId, pc);
    return pc;
  }, [meetingId, socket]);

  // Initialize local media
  const initializeMedia = useCallback(async (audio = false, video = false) => {
    if (!audio && !video) return;

    try {
      const stream = await getMediaStream({ audio, video });
      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsAudioMuted(!audio);
        setIsVideoOff(!video);

        // Add tracks to existing peer connections
        peerConnectionsRef.current.forEach((pc) => {
          stream.getTracks().forEach((track) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            } else {
              pc.addTrack(track, stream);
            }
          });
        });
      }
    } catch (error) {
      console.error("Error initializing media:", error);
    }
  }, [getMediaStream]);

  // Create/Join meeting
  useEffect(() => {
    if (!isOpen || !socket) return;

    if (existingMeetingId) {
      // Join existing meeting
      socket.emit("meeting:join", {
        meetingId: existingMeetingId,
        userInfo: { _id: user._id, name: user.name, pic: user.pic },
      });
    } else {
      // Create new meeting
      socket.emit("meeting:create", {
        chatId,
        creatorInfo: { _id: user._id, name: user.name, pic: user.pic },
      });
    }

    // Start meeting timer
    meetingTimerRef.current = setInterval(() => {
      setMeetingDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
      }
    };
  }, [isOpen, socket, existingMeetingId, chatId, user]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("meeting:created", ({ meetingId: newMeetingId }) => {
      setMeetingId(newMeetingId);
      toast({
        title: "🎥 Meeting Started",
        description: "Share the meeting link with others",
        status: "success",
        duration: 3000,
        position: "top",
      });
    });

    socket.on("meeting:joined", async ({ meetingId: joinedMeetingId, participants: existingParticipants }) => {
      setMeetingId(joinedMeetingId);
      setParticipants(existingParticipants);

      // Create peer connections for existing participants
      for (const participant of existingParticipants) {
        const pc = createPeerConnection(participant.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("meeting:offer", {
          meetingId: joinedMeetingId,
          to: participant.socketId,
          offer,
        });
      }
    });

    socket.on("meeting:user-joined", async ({ socketId, userInfo }) => {
      setParticipants((prev) => [...prev, { socketId, ...userInfo }]);
      toast({
        title: `${userInfo.name} joined`,
        status: "info",
        duration: 2000,
        position: "top",
      });
    });

    socket.on("meeting:user-left", ({ socketId, userId }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      peerConnectionsRef.current.get(socketId)?.close();
      peerConnectionsRef.current.delete(socketId);
      remoteStreamsRef.current.delete(socketId);
    });

    socket.on("meeting:offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("meeting:answer", {
        meetingId,
        to: from,
        answer,
      });
    });

    socket.on("meeting:answer", async ({ from, answer }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("meeting:ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("meeting:media-toggled", ({ socketId, mediaType, isEnabled }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === socketId
            ? { ...p, [mediaType === "audio" ? "isAudioOn" : "isVideoOn"]: isEnabled }
            : p
        )
      );
    });

    socket.on("meeting:screen-share-started", ({ socketId, userName }) => {
      toast({
        title: `${userName} is sharing their screen`,
        status: "info",
        duration: 3000,
        position: "top",
      });
    });

    socket.on("meeting:screen-share-stopped", ({ socketId }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === socketId ? { ...p, isScreenSharing: false } : p
        )
      );
    });

    return () => {
      socket.off("meeting:created");
      socket.off("meeting:joined");
      socket.off("meeting:user-joined");
      socket.off("meeting:user-left");
      socket.off("meeting:offer");
      socket.off("meeting:answer");
      socket.off("meeting:ice-candidate");
      socket.off("meeting:media-toggled");
      socket.off("meeting:screen-share-started");
      socket.off("meeting:screen-share-stopped");
    };
  }, [socket, meetingId, createPeerConnection, toast]);

  // Toggle audio
  const toggleAudio = async () => {
    if (isAudioMuted) {
      await initializeMedia(true, !isVideoOff);
    } else if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setIsAudioMuted(!isAudioMuted);
    socket?.emit("meeting:toggle-media", {
      meetingId,
      mediaType: "audio",
      isEnabled: isAudioMuted,
    });
  };

  // Toggle video
  const toggleVideo = async () => {
    if (isVideoOff) {
      await initializeMedia(!isAudioMuted, true);
    } else if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setIsVideoOff(!isVideoOff);
    socket?.emit("meeting:toggle-media", {
      meetingId,
      mediaType: "video",
      isEnabled: isVideoOff,
    });
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      socket?.emit("meeting:screen-share-stop", { meetingId });
    } else {
      // Start screen sharing
      const stream = await getScreenShareStream();
      if (stream) {
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        socket?.emit("meeting:screen-share-start", { meetingId });

        // Replace video track in peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(stream.getVideoTracks()[0]);
          }
        });

        // Handle screen share stop
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      }
    }
  };

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    socket?.emit("meeting:leave", { meetingId });
    onClose();
  }, [meetingId, socket, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
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
      bg="#0a0a1a"
      zIndex={9999}
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
      <Flex
        bg="rgba(255, 255, 255, 0.05)"
        backdropFilter="blur(10px)"
        px={6}
        py={3}
        alignItems="center"
        justifyContent="space-between"
        borderBottom="1px solid rgba(255, 255, 255, 0.1)"
      >
        <HStack spacing={4}>
          <Text color="white" fontSize="lg" fontWeight="600">
            👥 {chatName || "Meeting"}
          </Text>
          <Badge colorScheme="red" animation={`${pulse} 2s infinite`}>
            🔴 LIVE
          </Badge>
        </HStack>

        <HStack spacing={4}>
          <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
            ⏱️ {formatDuration(meetingDuration)}
          </Badge>
          <Badge colorScheme="blue" px={3} py={1} borderRadius="full">
            👥 {participants.length + 1} participants
          </Badge>
        </HStack>
      </Flex>

      {/* Video Grid */}
      <Box flex={1} p={4} overflow="auto">
        <Grid
          templateColumns={{
            base: "1fr",
            md: participants.length === 0 ? "1fr" : "repeat(2, 1fr)",
            lg: participants.length <= 1 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
            xl: participants.length <= 3 ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          }}
          gap={4}
          h="100%"
        >
          {/* Local Video */}
          <Box
            bg="rgba(255, 255, 255, 0.05)"
            borderRadius="xl"
            overflow="hidden"
            position="relative"
            minH="200px"
            border="2px solid"
            borderColor="purple.500"
          >
            {!isVideoOff ? (
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
            ) : (
              <Flex
                h="100%"
                alignItems="center"
                justifyContent="center"
                bg="gray.800"
              >
                <Avatar size="2xl" name={user?.name} src={user?.pic} />
              </Flex>
            )}

            {/* User info overlay */}
            <Flex
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              p={3}
              bg="linear-gradient(transparent, rgba(0,0,0,0.8))"
              alignItems="center"
              justifyContent="space-between"
            >
              <HStack>
                <Text color="white" fontWeight="500" fontSize="sm">
                  {user?.name} (You)
                </Text>
                {isScreenSharing && (
                  <Badge colorScheme="green" fontSize="xs">
                    Sharing
                  </Badge>
                )}
              </HStack>
              <HStack>
                {isAudioMuted && <Text fontSize="lg">🔇</Text>}
                {isVideoOff && <Text fontSize="lg">📷</Text>}
              </HStack>
            </Flex>
          </Box>

          {/* Remote Participants */}
          {participants.map((participant) => (
            <Box
              key={participant.socketId}
              bg="rgba(255, 255, 255, 0.05)"
              borderRadius="xl"
              overflow="hidden"
              position="relative"
              minH="200px"
              border="1px solid rgba(255, 255, 255, 0.1)"
            >
              {participant.isVideoOn && remoteStreamsRef.current.get(participant.socketId) ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && remoteStreamsRef.current.get(participant.socketId)) {
                      el.srcObject = remoteStreamsRef.current.get(participant.socketId);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <Flex
                  h="100%"
                  alignItems="center"
                  justifyContent="center"
                  bg="gray.800"
                >
                  <Avatar size="2xl" name={participant.name} src={participant.pic} />
                </Flex>
              )}

              <Flex
                position="absolute"
                bottom={0}
                left={0}
                right={0}
                p={3}
                bg="linear-gradient(transparent, rgba(0,0,0,0.8))"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text color="white" fontWeight="500" fontSize="sm">
                  {participant.name}
                </Text>
                <HStack>
                  {!participant.isAudioOn && <Text fontSize="lg">🔇</Text>}
                  {!participant.isVideoOn && <Text fontSize="lg">📷</Text>}
                </HStack>
              </Flex>
            </Box>
          ))}
        </Grid>
      </Box>

      {/* Controls */}
      <Flex
        bg="rgba(255, 255, 255, 0.05)"
        backdropFilter="blur(10px)"
        px={6}
        py={4}
        alignItems="center"
        justifyContent="center"
        borderTop="1px solid rgba(255, 255, 255, 0.1)"
        gap={4}
      >
        <Tooltip label={isAudioMuted ? "Unmute" : "Mute"}>
          <IconButton
            icon={isAudioMuted ? <Text fontSize="xl">🔇</Text> : <Text fontSize="xl">🎤</Text>}
            bg={isAudioMuted ? "red.500" : "whiteAlpha.200"}
            color="white"
            size="lg"
            borderRadius="full"
            onClick={toggleAudio}
            aria-label="Toggle audio"
            _hover={{ bg: isAudioMuted ? "red.600" : "whiteAlpha.300" }}
          />
        </Tooltip>

        <Tooltip label={isVideoOff ? "Turn on camera" : "Turn off camera"}>
          <IconButton
            icon={isVideoOff ? <Text fontSize="xl">📷</Text> : <Text fontSize="xl">📹</Text>}
            bg={isVideoOff ? "red.500" : "whiteAlpha.200"}
            color="white"
            size="lg"
            borderRadius="full"
            onClick={toggleVideo}
            aria-label="Toggle video"
            _hover={{ bg: isVideoOff ? "red.600" : "whiteAlpha.300" }}
          />
        </Tooltip>

        <Tooltip label={isScreenSharing ? "Stop sharing" : "Share screen"}>
          <IconButton
            icon={<Text fontSize="xl">🖥️</Text>}
            bg={isScreenSharing ? "green.500" : "whiteAlpha.200"}
            color="white"
            size="lg"
            borderRadius="full"
            onClick={toggleScreenShare}
            aria-label="Toggle screen share"
            _hover={{ bg: isScreenSharing ? "green.600" : "whiteAlpha.300" }}
          />
        </Tooltip>

        <Tooltip label="Leave meeting">
          <IconButton
            icon={<CloseIcon />}
            colorScheme="red"
            size="lg"
            borderRadius="full"
            onClick={leaveMeeting}
            aria-label="Leave meeting"
          />
        </Tooltip>
      </Flex>
    </Box>
  );
};

export default MeetingRoom;

