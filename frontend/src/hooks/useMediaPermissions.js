import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";

const useMediaPermissions = () => {
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [hasVideoPermission, setHasVideoPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const toast = useToast();

  const checkPermissions = useCallback(async () => {
    setIsChecking(true);
    try {
      // Check if permissions API is available
      if (navigator.permissions) {
        const [micPermission, cameraPermission] = await Promise.all([
          navigator.permissions.query({ name: "microphone" }).catch(() => ({ state: "prompt" })),
          navigator.permissions.query({ name: "camera" }).catch(() => ({ state: "prompt" })),
        ]);
        
        setHasAudioPermission(micPermission.state === "granted");
        setHasVideoPermission(cameraPermission.state === "granted");
        
        return {
          audio: micPermission.state === "granted",
          video: cameraPermission.state === "granted",
        };
      }
      return { audio: false, video: false };
    } catch (error) {
      console.error("Error checking permissions:", error);
      return { audio: false, video: false };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const requestAudioPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasAudioPermission(true);
      toast({
        title: "🎤 Microphone enabled",
        status: "success",
        duration: 2000,
        position: "bottom",
      });
      return true;
    } catch (error) {
      console.error("Audio permission denied:", error);
      setHasAudioPermission(false);
      toast({
        title: "Microphone access denied",
        description: "Please enable microphone access in your browser settings",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return false;
    }
  }, [toast]);

  const requestVideoPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasVideoPermission(true);
      toast({
        title: "📹 Camera enabled",
        status: "success",
        duration: 2000,
        position: "bottom",
      });
      return true;
    } catch (error) {
      console.error("Video permission denied:", error);
      setHasVideoPermission(false);
      toast({
        title: "Camera access denied",
        description: "Please enable camera access in your browser settings",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return false;
    }
  }, [toast]);

  const requestBothPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      stream.getTracks().forEach(track => track.stop());
      setHasAudioPermission(true);
      setHasVideoPermission(true);
      toast({
        title: "🎥 Camera & Microphone enabled",
        status: "success",
        duration: 2000,
        position: "bottom",
      });
      return { audio: true, video: true };
    } catch (error) {
      console.error("Media permission denied:", error);
      // Try to get at least audio
      const audioResult = await requestAudioPermission();
      return { audio: audioResult, video: false };
    }
  }, [toast, requestAudioPermission]);

  const getMediaStream = useCallback(async ({ audio = true, video = true }) => {
    try {
      const constraints = {};
      
      if (audio) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
      }
      
      if (video) {
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error("Error getting media stream:", error);
      toast({
        title: "Media Error",
        description: "Could not access camera/microphone",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return null;
    }
  }, [toast]);

  const getScreenShareStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        },
        audio: true,
      });
      return stream;
    } catch (error) {
      console.error("Error getting screen share:", error);
      if (error.name !== "NotAllowedError") {
        toast({
          title: "Screen Share Error",
          description: "Could not start screen sharing",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
      return null;
    }
  }, [toast]);

  return {
    hasAudioPermission,
    hasVideoPermission,
    isChecking,
    checkPermissions,
    requestAudioPermission,
    requestVideoPermission,
    requestBothPermissions,
    getMediaStream,
    getScreenShareStream,
  };
};

export default useMediaPermissions;

