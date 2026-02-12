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
  Grid,
  Badge,
  useToast,
  Tooltip,
  keyframes,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

// Control Button Component
const ControlButton = ({ icon, label, isActive, onClick, isDanger = false }) => (
  <Tooltip label={label} placement="top">
    <IconButton
      icon={<Text fontSize={{ base: "lg", md: "xl" }}>{icon}</Text>}
      onClick={onClick}
      size={{ base: "md", md: "lg" }}
      borderRadius="full"
      bg={isDanger ? "red.500" : isActive ? "whiteAlpha.200" : "red.500"}
      color="white"
      _hover={{
        transform: "scale(1.1)",
        bg: isDanger ? "red.600" : isActive ? "whiteAlpha.300" : "red.600",
      }}
      w={{ base: "44px", md: "56px" }}
      h={{ base: "44px", md: "56px" }}
      aria-label={label}
      transition="all 0.2s"
    />
  </Tooltip>
);

// Participant Video Component
const ParticipantVideo = ({ stream, name, pic, isLocal, isAudioOn, isVideoOn, isScreenSharing }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Box
      position="relative"
      bg="gray.900"
      borderRadius="xl"
      overflow="hidden"
      border="2px solid"
      borderColor={isLocal ? "purple.500" : "transparent"}
      h="100%"
      minH={{ base: "120px", md: "150px" }}
    >
      {stream && isVideoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <Flex
          h="100%"
          align="center"
          justify="center"
          bg="linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.9))"
          direction="column"
          gap={2}
        >
          <Avatar size="lg" name={name} src={pic} />
          <Text color="white" fontSize="sm" fontWeight="500">
            {isLocal ? "You" : name}
          </Text>
        </Flex>
      )}

      {/* Name badge */}
      <Flex
        position="absolute"
        bottom="8px"
        left="8px"
        right="8px"
        justify="space-between"
        align="center"
      >
        <Badge
          bg="blackAlpha.700"
          color="white"
          px={2}
          py={1}
          borderRadius="md"
          fontSize="xs"
        >
          {isLocal ? "You" : name}
        </Badge>
        <HStack spacing={1}>
          {!isAudioOn && (
            <Badge bg="red.500" color="white" px={2} py={1} borderRadius="md">
              🔇
            </Badge>
          )}
          {isScreenSharing && (
            <Badge bg="green.500" color="white" px={2} py={1} borderRadius="md">
              📺
            </Badge>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};

// Hidden audio player for remote participant streams
const RemoteAudio = ({ stream }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = 1.0;

      let retries = 0;
      const tryPlay = () => {
        if (!audioRef.current) return;
        audioRef.current.play()
          .then(() => console.log("✅ Remote participant audio playing"))
          .catch((err) => {
            console.log("Audio play attempt failed:", err.message);
            if (retries < 5) {
              retries++;
              setTimeout(tryPlay, 500);
            }
          });
      };
      tryPlay();
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
};

// Voice-only participant component for group voice calls
const VoiceParticipant = ({ name, pic, isLocal, isAudioOn, isSpeaking }) => (
  <VStack
    p={4}
    bg={isSpeaking ? "rgba(72, 187, 120, 0.15)" : "rgba(255, 255, 255, 0.05)"}
    borderRadius="xl"
    border="2px solid"
    borderColor={isLocal ? "purple.500" : isSpeaking ? "green.400" : "transparent"}
    transition="all 0.3s"
    spacing={2}
  >
    <Box position="relative">
      <Avatar
        size="lg"
        name={name}
        src={pic}
        border="3px solid"
        borderColor={isSpeaking ? "green.400" : "transparent"}
      />
      {!isAudioOn && (
        <Badge
          position="absolute"
          bottom="-2px"
          right="-2px"
          bg="red.500"
          color="white"
          borderRadius="full"
          fontSize="xs"
          px={1}
        >
          🔇
        </Badge>
      )}
    </Box>
    <Text color="white" fontSize="sm" fontWeight="500" textAlign="center" isTruncated maxW="100px">
      {isLocal ? "You" : name}
    </Text>
  </VStack>
);

const MeetingRoom = ({
  isOpen,
  onClose,
  socket,
  meetingInfo,
  user,
  onCallEnded,
}) => {
  const [participants, setParticipants] = useState(new Map());
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const meetingTimerRef = useRef(null);

  const toast = useToast();

  // Determine meeting type from meetingInfo
  const meetingType = meetingInfo?.meetingType || "meeting";
  const isVoiceOnly = meetingType === "group-voice";
  const isVideoCall = meetingType === "group-video";
  const isFullMeeting = meetingType === "meeting";

  const remoteAudioRefs = useRef(new Map());

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

  // Get title based on meeting type
  const getMeetingTitle = () => {
    if (isVoiceOnly) return "📞 Group Voice Call";
    if (isVideoCall) return "📹 Group Video Call";
    return "👥 Group Meeting";
  };

  // Initialize local media
  const initializeMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: !isVoiceOnly, // No video for voice-only calls
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Initially mute audio
      stream.getAudioTracks().forEach(track => track.enabled = false);
      
      // For video calls, auto-enable video; for meetings, start with video off
      if (isVideoCall) {
        stream.getVideoTracks().forEach(track => track.enabled = true);
        setIsVideoOn(true);
      } else {
        stream.getVideoTracks().forEach(track => track.enabled = false);
      }

      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media:", error);
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach(track => track.enabled = false);
        setLocalStream(audioStream);
        return audioStream;
      } catch (audioError) {
        console.error("Error accessing audio:", audioError);
        toast({
          title: "Media Error",
          description: "Could not access camera/microphone",
          status: "error",
          duration: 5000,
        });
        return null;
      }
    }
  }, [toast, isVoiceOnly, isVideoCall]);

  // Create peer connection for a participant
  const createPeerConnection = useCallback((participantSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("meeting:ice-candidate", {
          meetingId: meetingInfo?.meetingId,
          to: participantSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(participantSocketId);
        if (participant) {
          updated.set(participantSocketId, {
            ...participant,
            stream: event.streams[0],
          });
        }
        return updated;
      });
    };

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    peerConnectionsRef.current.set(participantSocketId, pc);
    return pc;
  }, [socket, meetingInfo, localStream]);

  // Join meeting
  const joinMeeting = useCallback(async () => {
    await initializeMedia();

    if (socket && meetingInfo) {
      socket.emit("meeting:join", {
        meetingId: meetingInfo.meetingId,
        userInfo: {
          name: user.name,
          pic: user.pic,
        },
      });
    }

    // Start timer
    meetingTimerRef.current = setInterval(() => {
      setMeetingDuration(prev => prev + 1);
    }, 1000);
  }, [initializeMedia, socket, meetingInfo, user]);

  // Save call record
  const saveCallRecord = useCallback(async (duration) => {
    if (!meetingInfo?.chatId || !user?.token) return;
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.post(
        "/api/message/call",
        {
          chatId: meetingInfo.chatId,
          callType: meetingType,
          duration,
          status: "ended",
        },
        config
      );
      if (socket) {
        socket.emit("new message", data);
      }
      if (onCallEnded) onCallEnded(data);
    } catch (err) {
      console.error("Failed to save call record:", err);
    }
  }, [meetingInfo, user, meetingType, socket, onCallEnded]);

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    const finalDuration = meetingDuration;

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
    }

    if (socket && meetingInfo) {
      socket.emit("meeting:leave", { meetingId: meetingInfo.meetingId });
    }

    // Save call record
    saveCallRecord(finalDuration);

    onClose();
  }, [localStream, screenStream, socket, meetingInfo, onClose, meetingDuration, saveCallRecord]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);

        socket?.emit("meeting:toggle-media", {
          meetingId: meetingInfo?.meetingId,
          mediaType: "audio",
          isEnabled: audioTrack.enabled,
        });
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);

        socket?.emit("meeting:toggle-media", {
          meetingId: meetingInfo?.meetingId,
          mediaType: "video",
          isEnabled: videoTrack.enabled,
        });
      }
    }
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);

      socket?.emit("meeting:screen-share-stop", {
        meetingId: meetingInfo?.meetingId,
      });

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        setScreenStream(stream);
        setIsScreenSharing(true);

        socket?.emit("meeting:screen-share-start", {
          meetingId: meetingInfo?.meetingId,
        });

        const screenTrack = stream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error("Error sharing screen:", error);
        toast({
          title: "Screen Share Failed",
          description: "Could not share your screen",
          status: "error",
          duration: 3000,
        });
      }
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleMeetingJoined = async ({ participants: existingParticipants }) => {
      for (const participant of existingParticipants) {
        const pc = createPeerConnection(participant.socketId);

        setParticipants(prev => {
          const updated = new Map(prev);
          updated.set(participant.socketId, {
            ...participant,
            stream: null,
          });
          return updated;
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("meeting:offer", {
          meetingId: meetingInfo?.meetingId,
          to: participant.socketId,
          offer,
        });
      }
    };

    const handleUserJoined = async ({ oderId, userInfo }) => {
      setParticipants(prev => {
        const updated = new Map(prev);
        updated.set(oderId, {
          ...userInfo,
          socketId: oderId,
          stream: null,
          isAudioOn: false,
          isVideoOn: false,
        });
        return updated;
      });

      toast({
        title: `${userInfo.name} joined`,
        status: "info",
        duration: 3000,
        position: "top",
      });
    };

    const handleUserLeft = ({ oderId, userId }) => {
      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(oderId);
        if (participant) {
          toast({
            title: `${participant.name} left`,
            status: "info",
            duration: 3000,
            position: "top",
          });
        }
        updated.delete(oderId);
        return updated;
      });

      const pc = peerConnectionsRef.current.get(oderId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(oderId);
      }
    };

    const handleOffer = async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("meeting:answer", {
        meetingId: meetingInfo?.meetingId,
        to: from,
        answer,
      });
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleMediaToggled = ({ oderId, mediaType, isEnabled }) => {
      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(oderId);
        if (participant) {
          updated.set(oderId, {
            ...participant,
            isAudioOn: mediaType === "audio" ? isEnabled : participant.isAudioOn,
            isVideoOn: mediaType === "video" ? isEnabled : participant.isVideoOn,
          });
        }
        return updated;
      });
    };

    const handleScreenShareStarted = ({ oderId, userName }) => {
      toast({
        title: `${userName} started screen sharing`,
        status: "info",
        duration: 3000,
        position: "top",
      });

      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(oderId);
        if (participant) {
          updated.set(oderId, { ...participant, isScreenSharing: true });
        }
        return updated;
      });
    };

    const handleScreenShareStopped = ({ oderId }) => {
      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(oderId);
        if (participant) {
          updated.set(oderId, { ...participant, isScreenSharing: false });
        }
        return updated;
      });
    };

    socket.on("meeting:joined", handleMeetingJoined);
    socket.on("meeting:user-joined", handleUserJoined);
    socket.on("meeting:user-left", handleUserLeft);
    socket.on("meeting:offer", handleOffer);
    socket.on("meeting:answer", handleAnswer);
    socket.on("meeting:ice-candidate", handleIceCandidate);
    socket.on("meeting:media-toggled", handleMediaToggled);
    socket.on("meeting:screen-share-started", handleScreenShareStarted);
    socket.on("meeting:screen-share-stopped", handleScreenShareStopped);

    return () => {
      socket.off("meeting:joined", handleMeetingJoined);
      socket.off("meeting:user-joined", handleUserJoined);
      socket.off("meeting:user-left", handleUserLeft);
      socket.off("meeting:offer", handleOffer);
      socket.off("meeting:answer", handleAnswer);
      socket.off("meeting:ice-candidate", handleIceCandidate);
      socket.off("meeting:media-toggled", handleMediaToggled);
      socket.off("meeting:screen-share-started", handleScreenShareStarted);
      socket.off("meeting:screen-share-stopped", handleScreenShareStopped);
    };
  }, [socket, meetingInfo, createPeerConnection, toast]);

  // Initialize meeting
  useEffect(() => {
    if (isOpen) {
      joinMeeting();
    }

    return () => {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
      }
    };
  }, [isOpen, joinMeeting]);

  // Calculate grid layout - responsive based on screen size
  const participantCount = participants.size + 1;
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const gridCols = isMobileView
    ? (participantCount <= 1 ? 1 : 2)
    : (participantCount <= 1 ? 1 : participantCount <= 4 ? 2 : participantCount <= 9 ? 3 : 4);

  // End call label
  const endLabel = isVoiceOnly ? "End Call" : isVideoCall ? "End Call" : "Leave Meeting";

  return (
    <Modal isOpen={isOpen} onClose={leaveMeeting} size="full">
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="#0a0a1a" borderRadius="0" m={0}>
        <ModalBody p={0} display="flex" flexDirection="column" h="100vh">
          {/* Header */}
          <Flex
            p={{ base: 2, md: 4 }}
            bg="rgba(0,0,0,0.5)"
            justify="space-between"
            align="center"
            borderBottom="1px solid rgba(255,255,255,0.1)"
            flexWrap="nowrap"
            gap={2}
          >
            <Flex align="center" gap={{ base: 2, md: 3 }} minW={0} flex="1">
              <Text fontSize={{ base: "md", md: "xl" }} flexShrink={0}>
                {isVoiceOnly ? "📞" : isVideoCall ? "📹" : "👥"}
              </Text>
              <Box minW={0}>
                <Text color="white" fontWeight="bold" fontSize={{ base: "xs", md: "md" }} isTruncated>
                  {meetingInfo?.chatName || getMeetingTitle()}
                </Text>
                <Flex align="center" gap={2}>
                  <Box
                    w="6px"
                    h="6px"
                    borderRadius="full"
                    bg="green.400"
                    animation={`${pulse} 2s infinite`}
                    flexShrink={0}
                  />
                  <Text color="gray.400" fontSize={{ base: "2xs", md: "sm" }} isTruncated>
                    {formatDuration(meetingDuration)} • {participantCount} {participantCount !== 1 ? "users" : "user"}
                  </Text>
                </Flex>
              </Box>
            </Flex>

            <Button
              size={{ base: "xs", md: "sm" }}
              colorScheme="red"
              onClick={leaveMeeting}
              leftIcon={<Text fontSize={{ base: "xs", md: "sm" }}>📵</Text>}
              flexShrink={0}
            >
              <Text display={{ base: "none", sm: "inline" }}>{endLabel}</Text>
              <Text display={{ base: "inline", sm: "none" }}>End</Text>
            </Button>
          </Flex>

          {/* Hidden audio elements for all remote participants (ensures audio playback in voice-only mode) */}
          {Array.from(participants.values()).map((participant) => (
            participant.stream && (
              <RemoteAudio key={`audio-${participant.socketId}`} stream={participant.stream} />
            )
          ))}

          {/* Content Area */}
          <Box flex="1" p={{ base: 2, md: 4 }} overflow="hidden">
            {isVoiceOnly ? (
              // Voice-only: Show avatar grid
              <Flex
                h="100%"
                align="center"
                justify="center"
                wrap="wrap"
                gap={4}
                overflowY="auto"
              >
                <VoiceParticipant
                  name={user?.name}
                  pic={user?.pic}
                  isLocal={true}
                  isAudioOn={isAudioOn}
                  isSpeaking={isAudioOn}
                />
                {Array.from(participants.values()).map((participant) => (
                  <VoiceParticipant
                    key={participant.socketId}
                    name={participant.name}
                    pic={participant.pic}
                    isLocal={false}
                    isAudioOn={participant.isAudioOn}
                    isSpeaking={participant.isAudioOn}
                  />
                ))}
              </Flex>
            ) : (
              // Video/Meeting: Show video grid
              <Grid
                templateColumns={`repeat(${gridCols}, 1fr)`}
                gap={4}
                h="100%"
              >
                {/* Local video */}
                <ParticipantVideo
                  stream={isScreenSharing ? screenStream : localStream}
                  name={user?.name}
                  pic={user?.pic}
                  isLocal={true}
                  isAudioOn={isAudioOn}
                  isVideoOn={isVideoOn}
                  isScreenSharing={isScreenSharing}
                />

                {/* Remote participants */}
                {Array.from(participants.values()).map((participant) => (
                  <ParticipantVideo
                    key={participant.socketId}
                    stream={participant.stream}
                    name={participant.name}
                    pic={participant.pic}
                    isLocal={false}
                    isAudioOn={participant.isAudioOn}
                    isVideoOn={participant.isVideoOn}
                    isScreenSharing={participant.isScreenSharing}
                  />
                ))}
              </Grid>
            )}
          </Box>

          {/* Controls */}
          <Flex
            p={{ base: 3, md: 4 }}
            bg="rgba(0,0,0,0.5)"
            justify="center"
            align="center"
            gap={{ base: 2, md: 4 }}
            borderTop="1px solid rgba(255,255,255,0.1)"
          >
            <HStack spacing={{ base: 2, md: 4 }}>
              <ControlButton
                icon={isAudioOn ? "🎤" : "🔇"}
                label={isAudioOn ? "Mute" : "Unmute"}
                isActive={isAudioOn}
                onClick={toggleAudio}
              />

              {/* Video toggle - not available for voice-only calls */}
              {!isVoiceOnly && (
                <ControlButton
                  icon={isVideoOn ? "📹" : "📷"}
                  label={isVideoOn ? "Stop Video" : "Start Video"}
                  isActive={isVideoOn}
                  onClick={toggleVideo}
                />
              )}

              {/* Screen share - available for meetings and video calls */}
              {(isFullMeeting || isVideoCall) && (
                <ControlButton
                  icon={isScreenSharing ? "🖥️" : "📺"}
                  label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                  isActive={!isScreenSharing}
                  onClick={toggleScreenShare}
                />
              )}

              <ControlButton
                icon="📵"
                label={endLabel}
                onClick={leaveMeeting}
                isDanger={true}
              />
            </HStack>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default MeetingRoom;
