import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Text,
  Box,
  Flex,
  Avatar,
  IconButton,
  HStack,
  keyframes,
  useToast,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

// Icons
const MicIcon = ({ isOn, ...props }) => (
  <Box as="span" {...props}>{isOn ? "🎤" : "🔇"}</Box>
);
const VideoIcon = ({ isOn, ...props }) => (
  <Box as="span" {...props}>{isOn ? "📹" : "📷"}</Box>
);
const EndCallIcon = (props) => (
  <Box as="span" {...props}>📵</Box>
);

const pulse = keyframes`
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
`;

// ──────────────────────────────────────────────
// Helper: wait until ICE gathering finishes or a timeout elapses.
// After this resolves, pc.localDescription contains the complete SDP
// with all gathered ICE candidates baked in — no separate trickle needed.
// ──────────────────────────────────────────────
const waitForIceGathering = (pc, timeout = 6000) =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      console.log("⏰ ICE gathering timed out — sending what we have");
      resolve();
    }, timeout);

    const check = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });

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
  iceCandidateBuffer, // ref from parent — buffered ICE candidates
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
  const remoteDescriptionSet = useRef(false);
  const initializedRef = useRef(false); // prevents double-init

  // ─── Stable refs for callbacks that change every parent render ───
  // This prevents the useEffect/useCallback chain from cascading re-runs.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

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
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ───── useEffect: attach LOCAL stream to video element ─────
  useEffect(() => {
    if (localVideoRef.current && localStream && callType === "video") {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  // ───── useEffect: attach REMOTE stream to video + audio elements ─────
  // KEY FIX: this runs AFTER React renders the <video>/<audio> elements,
  // avoiding the old race where ontrack set srcObject on a null ref.
  useEffect(() => {
    if (!remoteStream) return;

    // Video
    if (remoteVideoRef.current) {
      console.log("🎥 Attaching remote stream to video element");
      remoteVideoRef.current.srcObject = remoteStream;
      // Force play in case autoPlay doesn't trigger
      remoteVideoRef.current.play().catch(() => {});
    }

    // Audio
    if (remoteAudioRef.current) {
      console.log("🔊 Attaching remote stream to audio element");
      const el = remoteAudioRef.current;
      el.srcObject = remoteStream;
      el.volume = 1.0;
      el.muted = false;

      let retries = 0;
      const tryPlay = () => {
        el.play()
          .then(() => {
            console.log("✅ Remote audio playing (try " + (retries + 1) + ")");
            setAudioBlocked(false);
          })
          .catch(() => {
            if (retries++ < 20) setTimeout(tryPlay, 300);
            else setAudioBlocked(true);
          });
      };
      tryPlay();
    }

    // Ensure all remote tracks are enabled
    remoteStream.getAudioTracks().forEach((t) => { t.enabled = true; });
    remoteStream.getVideoTracks().forEach((t) => { t.enabled = true; });
  }, [remoteStream]);

  // Manual audio unlock
  const unlockAudio = useCallback(() => {
    [remoteAudioRef.current, remoteStream && new Audio()].forEach((el) => {
      if (!el) return;
      if (!el.srcObject && remoteStream) el.srcObject = remoteStream;
      el.volume = 1.0;
      el.muted = false;
      el.play()
        .then(() => setAudioBlocked(false))
        .catch(() => {});
    });
  }, [remoteStream]);

  // ───── Initialize local media ─────
  const initializeMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
      };
      console.log("📷🎤 getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      stream.getVideoTracks().forEach((t) => { t.enabled = true; });
      console.log("✅ Local stream:", stream.getTracks().map((t) => `${t.kind}:${t.enabled}`).join(", "));
      return stream;
    } catch (err) {
      console.error("❌ getUserMedia error:", err);
      if (callType === "video") {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = s;
          setLocalStream(s);
          setIsVideoOn(false);
          return s;
        } catch (_) { /* fall through */ }
      }
      toast({ title: "Media Error", description: "Enable camera/mic permissions.", status: "error", duration: 5000 });
      return null;
    }
  }, [callType, toast]);

  // ───── Start call timer ─────
  const startTimer = useCallback(() => {
    if (callTimerRef.current) return;
    console.log("⏱️ Timer started");
    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallDuration(callDurationRef.current);
    }, 1000);
  }, []);

  // ───── Save call record ─────
  const saveCallRecord = useCallback(async (duration, status) => {
    if (!chatId || !userToken) return;
    try {
      const { data } = await axios.post(
        "/api/message/call",
        { chatId, callType, duration, status },
        { headers: { "Content-type": "application/json", Authorization: `Bearer ${userToken}` } }
      );
      if (socket) socket.emit("new message", data);
      if (onCallEndedRef.current) onCallEndedRef.current(data);
    } catch (e) {
      console.error("Failed to save call record:", e);
    }
  }, [chatId, userToken, callType, socket]);

  // ───── End call ─────
  const endCall = useCallback((status) => {
    if (endCallCalledRef.current) return;
    endCallCalledRef.current = true;
    console.log("📵 Ending call, status:", status || "ended");
    const dur = callDurationRef.current;

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (callTimerRef.current) clearInterval(callTimerRef.current);

    if (socket && callInfo) {
      socket.emit("call:end", {
        callId: callInfo.callId,
        to: callInfo.recipientId || callInfo.callerId,
      });
    }
    if (!isIncoming) saveCallRecord(dur, status || "ended");
    onCloseRef.current();
  }, [socket, callInfo, isIncoming, saveCallRecord]);

  // ───── Create peer connection ─────
  const createPeerConnection = useCallback(async () => {
    console.log("🔗 Creating RTCPeerConnection");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send ICE candidates (trickle — supplementary to gathered-complete)
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("call:ice-candidate", {
          to: callInfo?.recipientId || callInfo?.callerId,
          candidate: e.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
        startTimer();
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 Remote track:", event.track.kind, event.track.readyState);
      if (event.streams[0]) setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        startTimer();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (!endCallCalledRef.current) {
          endCallCalledRef.current = true;
          if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
          if (peerConnectionRef.current) peerConnectionRef.current.close();
          if (callTimerRef.current) clearInterval(callTimerRef.current);
          onCloseRef.current();
        }
      }
    };

    // Add local tracks
    const stream = localStreamRef.current || (await initializeMedia());
    if (stream) {
      stream.getTracks().forEach((t) => {
        console.log("➕ Adding track:", t.kind);
        pc.addTrack(t, stream);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, callInfo, initializeMedia, startTimer]);

  // ───── Apply buffered ICE candidates from parent ─────
  const applyBufferedCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !remoteDescriptionSet.current) return;

    // Drain the buffer from SingleChat
    if (iceCandidateBuffer?.current?.length) {
      console.log(`🧊 Applying ${iceCandidateBuffer.current.length} buffered ICE candidates`);
      while (iceCandidateBuffer.current.length) {
        const c = iceCandidateBuffer.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          console.warn("Buffered ICE add error:", e.message);
        }
      }
    }
  }, [iceCandidateBuffer]);

  // ───── CALLER: make call ─────
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

      // CRITICAL: wait for ICE gathering so the SDP contains all candidates.
      // Without this, the offer has no candidates and the receiver can't connect.
      console.log("⏳ Waiting for ICE gathering to complete...");
      await waitForIceGathering(pc, 6000);
      console.log("✅ ICE gathering done — sending offer with",
        (pc.localDescription.sdp.match(/a=candidate/g) || []).length, "candidates");

      socket.emit("call:initiate", {
        to: callInfo.recipientId,
        callType,
        offer: pc.localDescription, // complete SDP with all candidates
        callerInfo: callInfo.callerInfo,
      });
    } catch (err) {
      console.error("❌ makeCall error:", err);
      toast({ title: "Call Failed", description: "Could not start the call.", status: "error", duration: 5000 });
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo, callType, toast]);

  // ───── RECEIVER: answer call ─────
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

        // Apply any ICE candidates that arrived while CallNotification was showing
        await applyBufferedCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Wait for ICE gathering so the answer SDP includes all candidates
        console.log("⏳ Waiting for ICE gathering...");
        await waitForIceGathering(pc, 6000);
        console.log("✅ Sending answer with",
          (pc.localDescription.sdp.match(/a=candidate/g) || []).length, "candidates");

        socket.emit("call:accept", {
          callId: callInfo.callId,
          answer: pc.localDescription, // complete SDP with all candidates
          to: callInfo.callerId,
        });
      }
    } catch (err) {
      console.error("❌ answerCall error:", err);
    }
  }, [initializeMedia, createPeerConnection, socket, callInfo, applyBufferedCandidates]);

  // ───── Toggle audio/video ─────
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsAudioOn(t.enabled); }
    }
  };
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getVideoTracks()[0];
      if (t) { t.enabled = !t.enabled; setIsVideoOn(t.enabled); }
    }
  };

  // ───── Socket listeners (STABLE — no recreations) ─────
  useEffect(() => {
    if (!socket) return;

    const handleCallAccepted = async ({ answer }) => {
      try {
        console.log("✅ call:accepted — setting remote description");
        const pc = peerConnectionRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        remoteDescriptionSet.current = true;
        // Apply any buffered trickle candidates
        if (iceCandidateBuffer?.current?.length) {
          while (iceCandidateBuffer.current.length) {
            const c = iceCandidateBuffer.current.shift();
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
          }
        }
      } catch (err) {
        console.error("handleCallAccepted error:", err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (!pc || !remoteDescriptionSet.current) {
        // Buffer — remote description not set yet
        if (iceCandidateBuffer?.current) iceCandidateBuffer.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("ICE add error:", e.message);
      }
    };

    const handleCallEnded = () => {
      toast({ title: "Call Ended", status: "info", duration: 3000 });
      // Use ref to avoid stale closure
      if (!endCallCalledRef.current) {
        endCallCalledRef.current = true;
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
        if (peerConnectionRef.current) peerConnectionRef.current.close();
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        onCloseRef.current();
      }
    };

    const handleCallRejected = ({ reason }) => {
      toast({ title: "Call Rejected", description: reason || "Declined", status: "warning", duration: 5000 });
      if (!endCallCalledRef.current) {
        endCallCalledRef.current = true;
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
        if (peerConnectionRef.current) peerConnectionRef.current.close();
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        if (!isIncoming) saveCallRecord(0, "declined");
        onCloseRef.current();
      }
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
    // Only depend on socket — all other values accessed via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ───── Initialize call ONCE when modal opens ─────
  useEffect(() => {
    if (!isOpen || initializedRef.current) return;
    initializedRef.current = true;

    endCallCalledRef.current = false;
    callDurationRef.current = 0;
    remoteDescriptionSet.current = false;
    setCallDuration(0);
    setCallStatus("connecting");
    setRemoteStream(null);

    if (isIncoming) {
      answerCall();
    } else {
      makeCall();
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only trigger on open — NOT on answerCall/makeCall (prevents re-init)

  const recipientInfo = callInfo?.recipientInfo || callInfo?.callerInfo;

  return (
    <Modal isOpen={isOpen} onClose={endCall} size="full">
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="#0a0a1a" borderRadius="0" m={0}>
        <ModalBody p={0} display="flex" flexDirection="column" h="100vh">
          {/* Audio — always rendered off-screen */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
          />

          {/* Audio blocked banner */}
          {audioBlocked && callStatus === "connected" && (
            <Flex
              position="absolute" top="70px" left="50%" transform="translateX(-50%)"
              zIndex={10} bg="rgba(245,87,108,0.9)" px={4} py={2} borderRadius="full"
              align="center" gap={2} cursor="pointer" onClick={unlockAudio}
              _hover={{ bg: "rgba(245,87,108,1)" }}
              boxShadow="0 4px 20px rgba(245,87,108,0.4)"
            >
              <Text color="white" fontSize="sm" fontWeight="600">🔊 Tap to enable audio</Text>
            </Flex>
          )}

          {/* Main area */}
          <Box flex="1" position="relative" bg="black">
            {/* Remote video — ALWAYS in DOM, toggled via display */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: callType === "video" && remoteStream ? "block" : "none",
              }}
            />

            {/* Avatar fallback (voice call or while connecting) */}
            {(callType !== "video" || !remoteStream) && (
              <Flex h="100%" align="center" justify="center" direction="column" gap={{ base: 3, md: 4 }} px={4}>
                <Avatar
                  size={{ base: "xl", md: "2xl" }}
                  name={recipientInfo?.name}
                  src={recipientInfo?.pic}
                  border="4px solid" borderColor="purple.500"
                />
                <Text color="white" fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" textAlign="center" isTruncated maxW="80%">
                  {recipientInfo?.name}
                </Text>
                <Text
                  color="gray.400" fontSize={{ base: "sm", md: "md" }}
                  animation={callStatus !== "connected" ? `${pulse} 1.5s infinite` : undefined}
                >
                  {callStatus === "calling" ? "Calling..." : callStatus === "connected" ? formatDuration(callDuration) : "Connecting..."}
                </Text>
              </Flex>
            )}

            {/* Local video PIP */}
            {callType === "video" && (
              <Box
                position="absolute"
                bottom={{ base: "120px", md: "100px" }}
                right={{ base: "10px", md: "20px" }}
                w={{ base: "100px", md: "200px" }}
                h={{ base: "140px", md: "150px" }}
                borderRadius="xl" overflow="hidden"
                border="2px solid rgba(255,255,255,0.2)" boxShadow="xl" bg="gray.900"
              >
                <video
                  ref={localVideoRef}
                  autoPlay playsInline muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                />
                {!isVideoOn && (
                  <Flex position="absolute" top="0" left="0" right="0" bottom="0" align="center" justify="center" bg="gray.800">
                    <Text fontSize="2xl">📷</Text>
                  </Flex>
                )}
              </Box>
            )}

            {/* Top status bar */}
            <Flex
              position="absolute" top="20px" left="50%" transform="translateX(-50%)"
              bg="rgba(0,0,0,0.6)" px={4} py={2} borderRadius="full" align="center" gap={2}
            >
              <Box
                w="8px" h="8px" borderRadius="full"
                bg={callStatus === "connected" ? "green.400" : "yellow.400"}
                animation={callStatus !== "connected" ? `${pulse} 1s infinite` : undefined}
              />
              <Text color="white" fontSize="sm" fontWeight="500">
                {callStatus === "connected" ? formatDuration(callDuration) : callStatus === "calling" ? "Calling..." : "Connecting..."}
              </Text>
            </Flex>
          </Box>

          {/* Controls */}
          <Flex
            position="absolute" bottom="0" left="0" right="0" justify="center"
            p={{ base: 4, md: 6 }} bg="linear-gradient(transparent, rgba(0,0,0,0.8))"
          >
            <HStack spacing={{ base: 4, md: 6 }}>
              <IconButton
                icon={<MicIcon isOn={isAudioOn} />}
                onClick={toggleAudio} borderRadius="full"
                bg={isAudioOn ? "whiteAlpha.200" : "red.500"} color="white"
                _hover={{ transform: "scale(1.1)" }}
                w={{ base: "48px", md: "60px" }} h={{ base: "48px", md: "60px" }}
                aria-label={isAudioOn ? "Mute" : "Unmute"}
              />
              {callType === "video" && (
                <IconButton
                  icon={<VideoIcon isOn={isVideoOn} />}
                  onClick={toggleVideo} borderRadius="full"
                  bg={isVideoOn ? "whiteAlpha.200" : "red.500"} color="white"
                  _hover={{ transform: "scale(1.1)" }}
                  w={{ base: "48px", md: "60px" }} h={{ base: "48px", md: "60px" }}
                  aria-label={isVideoOn ? "Turn off video" : "Turn on video"}
                />
              )}
              <IconButton
                icon={<EndCallIcon />}
                onClick={endCall} borderRadius="full"
                bg="red.500" color="white"
                _hover={{ bg: "red.600", transform: "scale(1.1)" }}
                w={{ base: "56px", md: "70px" }} h={{ base: "56px", md: "70px" }}
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
