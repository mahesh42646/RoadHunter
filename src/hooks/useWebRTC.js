"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";

/**
 * WebRTC implementation using simple-peer library
 * Much more reliable than raw WebRTC API
 */
export default function useWebRTC(partyId, socket, isHost, hostMicEnabled, hostCameraEnabled, userId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [error, setError] = useState(null);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // Map of userId -> Peer instance
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const hostIdRef = useRef(null);

  const log = (message, ...args) => {
    const prefix = isHost ? "[HOST]" : "[PARTICIPANT]";
    console.log(`${prefix} ${message}`, ...args);
  };

  const logError = (message, ...args) => {
    const prefix = isHost ? "[HOST ERROR]" : "[PARTICIPANT ERROR]";
    console.error(`${prefix} ${message}`, ...args);
  };

  // Get media stream optimized for low latency and high quality
  // Use the same constraints for ALL screen sizes - no special handling
  const getMediaStream = async (audio, video) => {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error("MediaDevices API not available. Please use HTTPS or a supported browser.");
        logError("MediaDevices API not available");
        setError(error.message);
        throw error;
      }

      // Use the SAME high-quality constraints for ALL screen sizes
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2, // Stereo
          latency: 0.01, // Ultra low latency audio (10ms)
        } : false,
        video: video ? {
          // High quality settings - same for all screen sizes
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 }, // 60fps for smooth video
          aspectRatio: { ideal: 16/9 },
          facingMode: "user",
        } : false,
      };

      log(`Requesting media: audio=${audio}, video=${video}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints).catch((err) => {
        // Handle permission denied or other errors gracefully
        logError("getUserMedia failed:", err);
        setError(err.message || "Failed to access camera/microphone. Please check permissions.");
        throw err;
      });
      log(`✅ Got stream with ${stream.getTracks().length} tracks`);
      
      // Optimize video tracks for ultra low latency and high quality
      if (video) {
        stream.getVideoTracks().forEach(track => {
          const settings = track.getSettings();
          log(`Video track: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
          
          // Apply optimal constraints for low latency
          track.applyConstraints({
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }).catch(err => logError("Failed to apply video constraints:", err));
        });
      }
      
      return stream;
    } catch (err) {
      logError("Failed to get media:", err);
      throw err;
    }
  };

  // Create peer connection using simple-peer
  const createPeer = useCallback((targetId, initiator) => {
    // Destroy existing peer if any
    const existing = peersRef.current.get(targetId);
    if (existing && !existing.destroyed) {
      log(`Destroying existing peer for ${targetId}`);
      try {
        existing.destroy();
      } catch (err) {
        logError("Error destroying existing peer:", err);
      }
    }

    log(`Creating peer for ${targetId}, initiator: ${initiator}`);

    // Get current stream for host
    const streamToUse = isHost && localStreamRef.current ? localStreamRef.current : null;
    if (streamToUse) {
      const audioTracks = streamToUse.getAudioTracks();
      const videoTracks = streamToUse.getVideoTracks();
      log(`Creating peer with stream: ${audioTracks.length} audio, ${videoTracks.length} video tracks`);
      
      // Log track details for debugging
      audioTracks.forEach(track => {
        log(`  🔊 Audio track: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      videoTracks.forEach(track => {
        log(`  📹 Video track: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      
      // Ensure all tracks are enabled
      audioTracks.forEach(track => track.enabled = true);
      videoTracks.forEach(track => track.enabled = true);
    } else if (isHost) {
      logError(`⚠️ Host creating peer but no local stream available!`);
    }

    const peer = new Peer({
      initiator,
      trickle: true, // Enable trickle ICE for immediate candidate exchange
      stream: streamToUse,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        iceTransportPolicy: "all",
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      },
    });

    // Handle signal data (offer/answer/ICE) - simple-peer emits this
    peer.on("signal", (data) => {
      log(`Peer signal event for ${targetId}, type: ${data.type}`);
      if (socket) {
        // Send signal via socket
        socket.emit("webrtc:signal", {
          partyId,
          targetUserId: targetId,
          signal: data,
        });
      }
    });

    // Handle stream (participants receive host stream)
    peer.on("stream", (stream) => {
      log(`🎬 ===== STREAM RECEIVED =====`);
      log(`Stream from ${targetId}`);
      log(`  Stream ID: ${stream.id}`);
      log(`  Audio tracks: ${stream.getAudioTracks().length}`);
      log(`  Video tracks: ${stream.getVideoTracks().length}`);
      
      stream.getAudioTracks().forEach(track => {
        log(`  🔊 Audio: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`);
        track.enabled = true;
      });
      stream.getVideoTracks().forEach(track => {
        log(`  📹 Video: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`);
        track.enabled = true;
      });
      
      // Enable all tracks
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      log(`Stream has ${audioTracks.length} audio tracks and ${videoTracks.length} video tracks`);
      
      audioTracks.forEach(track => {
        track.enabled = true;
        log(`  🔊 Enabled audio track: ${track.id}, readyState: ${track.readyState}, muted: ${track.muted}`);
      });
      videoTracks.forEach(track => {
        track.enabled = true;
        log(`  📹 Enabled video track: ${track.id}, readyState: ${track.readyState}`);
      });
      
      // Warn if no audio tracks but expecting them
      if (audioTracks.length === 0) {
        logError(`⚠️ WARNING: Stream received with NO audio tracks! Host mic might not be enabled or stream doesn't include audio.`);
      }
      
      // Set stream - React useEffect will handle attaching to video element
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
      
      log("✅ Remote stream set, will be attached by React");
    });

    // Handle connection - optimize for high quality and low latency
    peer.on("connect", () => {
      log(`✅ Connected to ${targetId}`);
      
      // Optimize connection for high quality (removed invalid properties)
      if (peer._pc) {
        const pc = peer._pc;
        
        // Set high quality settings with valid enum values
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track && sender.track.kind === 'video') {
            try {
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                // High quality for local network
                params.encodings.forEach(encoding => {
                  encoding.maxBitrate = 5000000; // 5 Mbps for high quality
                  encoding.maxFramerate = 30;
                  encoding.priority = 'high'; // Valid: 'very-low', 'low', 'medium', 'high'
                  encoding.scaleResolutionDownBy = 1; // No downscaling
                });
                sender.setParameters(params).catch(err => {
                  log("Note: Could not optimize video encoding:", err.message);
                });
              }
            } catch (err) {
              log("Note: Video parameter optimization not supported");
            }
          } else if (sender.track && sender.track.kind === 'audio') {
            try {
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings.forEach(encoding => {
                  encoding.maxBitrate = 128000; // High quality audio
                  encoding.priority = 'high';
                });
                sender.setParameters(params).catch(() => {});
              }
            } catch (err) {
              // Silently fail for audio parameter optimization
            }
          }
        });
      }
    });

    // Handle errors
    peer.on("error", (err) => {
      logError(`Peer error for ${targetId}:`, err);
    });

    // Handle close
    peer.on("close", () => {
      log(`Peer closed for ${targetId}`);
      // Remove from map when closed
      if (peersRef.current.get(targetId) === peer) {
        peersRef.current.delete(targetId);
      }
    });

    peersRef.current.set(targetId, peer);
    return peer;
  }, [isHost, socket, partyId, audioEnabled, audioVolume]);

  // Host: Toggle mic
  const toggleMic = async () => {
    if (!isHost) return;
    
    try {
      if (isMicEnabled) {
        log("Turning OFF mic");
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
            track.stop();
            localStreamRef.current.removeTrack(track);
          });
        }
        setIsMicEnabled(false);
      } else {
        log("Turning ON mic");
        const stream = await getMediaStream(true, false);
        
        if (localStreamRef.current) {
          stream.getAudioTracks().forEach(track => {
            localStreamRef.current.addTrack(track);
          });
        } else {
          localStreamRef.current = stream;
          setLocalStream(stream);
        }
        
        // Recreate all peer connections with the new stream (includes audio now)
        log(`Mic turned ON - recreating ${peersRef.current.size} peer connections with audio`);
        peersRef.current.forEach((peer, id) => {
          log(`Recreating peer connection for ${id} with mic enabled`);
          // Destroy the old peer
          if (peer && !peer.destroyed) {
            try {
              peer.destroy();
            } catch (err) {
              log(`Error destroying old peer for ${id}:`, err);
            }
          }
          // Create new peer as initiator (host always initiates) with the new stream
          const newPeer = createPeer(id, true);
          log(`✅ New peer created for ${id} with audio tracks`);
        });
        
        setIsMicEnabled(true);
      }
    } catch (err) {
      logError("Toggle mic error:", err);
      throw err;
    }
  };

  // Host: Toggle camera
  const toggleCamera = async () => {
    if (!isHost) return;
    
    try {
      if (isCameraEnabled) {
        log("Turning OFF camera");
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
            localStreamRef.current.removeTrack(track);
          });
        }
        setIsCameraEnabled(false);
      } else {
        log("Turning ON camera");
        const stream = await getMediaStream(false, true);
        
        if (localStreamRef.current) {
          stream.getVideoTracks().forEach(track => {
            localStreamRef.current.addTrack(track);
          });
        } else {
          localStreamRef.current = stream;
          setLocalStream(stream);
        }
        
        // Recreate all peer connections with the new stream (includes video now)
        log(`Camera turned ON - recreating ${peersRef.current.size} peer connections with video`);
        peersRef.current.forEach((peer, id) => {
          log(`Recreating peer connection for ${id} with camera enabled`);
          // Destroy the old peer
          if (peer && !peer.destroyed) {
            try {
              peer.destroy();
            } catch (err) {
              log(`Error destroying old peer for ${id}:`, err);
            }
          }
          // Create new peer as initiator (host always initiates) with the new stream
          const newPeer = createPeer(id, true);
          log(`✅ New peer created for ${id} with video tracks`);
        });
        
        setIsCameraEnabled(true);
      }
    } catch (err) {
      logError("Toggle camera error:", err);
      throw err;
    }
  };

  // Participant: Set volume
  const setVolume = (volume) => {
    setAudioVolume(volume);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = volume;
    }
  };

  // Participant: Toggle audio
  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const newValue = !prev;
      const video = remoteVideoRef.current;
      if (video && video.srcObject) {
        log(`Toggling audio: ${prev} -> ${newValue}`);
        video.muted = !newValue;
        video.volume = audioVolume;
        
        // If unmuting and video is paused, try to play
        if (newValue && video.paused) {
          video.play().then(() => {
            log("✅ Video started playing after audio toggle");
          }).catch(err => {
            log("Play failed after audio toggle:", err.name);
          });
        }
      }
      return newValue;
    });
  };

  // WebRTC signaling handlers
  useEffect(() => {
    if (!socket) return;

    // Handle all signal types (offer/answer/ICE) from simple-peer
    const handleSignal = (data) => {
      if (data.partyId !== partyId) return;
      if (data.targetUserId !== userId) return;
      
      log(`📨 Received signal from ${data.fromUserId}, type: ${data.signal?.type}`);
      
      let peer;
      
      if (isHost) {
        // Host receives signals from participants
        peer = peersRef.current.get(data.fromUserId);
        
        // If peer doesn't exist or is destroyed, create a new one
        if (!peer || peer.destroyed) {
          log(`Creating new peer for ${data.fromUserId} (existing: ${!!peer}, destroyed: ${peer?.destroyed})`);
          peer = createPeer(data.fromUserId, false);
        }
      } else {
        // Participant receives signals from host
        if (!hostIdRef.current) {
          hostIdRef.current = data.fromUserId;
        }
        peer = peersRef.current.get(data.fromUserId) || 
                peersRef.current.get("host");
        
        // If signal is an offer and we already have a peer, destroy old one and create new
        // (This handles host toggling camera/mic which recreates connections)
        if (data.signal?.type === 'offer' && peer && !peer.destroyed) {
          log(`Received new offer from host - destroying old peer and creating new one`);
          try {
            peer.destroy();
          } catch (err) {
            log(`Error destroying old peer:`, err);
          }
          peer = createPeer(data.fromUserId, false);
        }
        
        // If peer doesn't exist or is destroyed, create a new one as NON-initiator
        // Host initiates, participant responds
        if (!peer || peer.destroyed) {
          log(`Creating new peer for host ${data.fromUserId} as responder (existing: ${!!peer}, destroyed: ${peer?.destroyed})`);
          peer = createPeer(data.fromUserId, false); // false = responder, host initiated
        }
      }
      
      if (peer && !peer.destroyed) {
        try {
          peer.signal(data.signal);
          log(`✅ Processed signal from ${data.fromUserId}`);
        } catch (err) {
          logError("Error processing signal:", err);
          // Recreate peer as responder and retry (whoever sent the signal is initiator)
          log(`Recreating peer for ${data.fromUserId} as responder due to signal error`);
          const newPeer = createPeer(data.fromUserId, false);
          try {
            newPeer.signal(data.signal);
            log(`✅ Retried signal after recreating peer`);
          } catch (retryErr) {
            logError("Retry signal failed:", retryErr);
          }
        }
      } else {
        logError(`Cannot process signal - peer is destroyed`);
      }
    };

    // Participant: Handle host stream started
    const handleHostStreamStarted = async (data) => {
      if (data.partyId !== partyId || isHost) return;
      
      log(`🎬 Host stream state changed - audio: ${data.audio}, video: ${data.video}, hostId: ${data.hostId}`);
      
      if (data.hostId) {
        hostIdRef.current = data.hostId;
      }
      
      const hostId = data.hostId || "host";
      const existing = peersRef.current.get(hostId);
      
      // If we already have a working connection, keep it
      if (existing && !existing.destroyed) {
        log(`Existing peer connection maintained - stream state updated`);
        return;
      }
      
      // If no connection exists and host has active stream, request it
      if ((data.audio || data.video) && !existing && socket) {
        log(`No existing connection - requesting stream from host ${hostId}`);
        log(`Emitting webrtc:request-stream for party ${partyId}`);
        // Request stream from host
        socket.emit('webrtc:request-stream', {
          partyId,
          hostId: hostId,
        });
        log(`✅ Stream request sent to host`);
      } else if (!data.audio && !data.video && existing) {
        log(`Host turned off all streams - maintaining connection for future use`);
      } else if (!socket) {
        logError(`Cannot request stream - socket not available`);
      }
    };

    // Host: Handle stream requests from participants
    const handleStreamRequested = (data) => {
      if (data.partyId !== partyId || !isHost) return;
      
      const participantId = data.requestedBy;
      log(`📞 Stream requested by participant ${participantId}`);
      log(`  Current stream:`, localStreamRef.current ? 'exists' : 'null');
      log(`  Mic enabled: ${isMicEnabled}, Camera enabled: ${isCameraEnabled}`);
      
      // Check if we already have a peer for this participant
      const existing = peersRef.current.get(participantId);
      if (existing && !existing.destroyed) {
        log(`Peer connection already exists for ${participantId}, skipping`);
        return;
      }
      
      // Check if we have an active stream
      if (localStreamRef.current && (isMicEnabled || isCameraEnabled)) {
        // Verify stream has the expected tracks
        const audioTracks = localStreamRef.current.getAudioTracks();
        const videoTracks = localStreamRef.current.getVideoTracks();
        log(`  Stream has ${audioTracks.length} audio tracks (expected: ${isMicEnabled ? 1 : 0})`);
        log(`  Stream has ${videoTracks.length} video tracks (expected: ${isCameraEnabled ? 1 : 0})`);
        
        // Warn if tracks don't match expected state
        if (isMicEnabled && audioTracks.length === 0) {
          logError(`⚠️ WARNING: Mic is enabled but stream has no audio tracks!`);
        }
        if (isCameraEnabled && videoTracks.length === 0) {
          logError(`⚠️ WARNING: Camera is enabled but stream has no video tracks!`);
        }
        
        log(`✅ Creating peer connection for participant ${participantId} as initiator`);
        // Create peer as initiator (host initiates to participant)
        const peer = createPeer(participantId, true);
        log(`Peer created and will send offer to ${participantId}`);
      } else {
        log(`❌ No active stream to share with ${participantId} - stream:${!!localStreamRef.current}, mic:${isMicEnabled}, cam:${isCameraEnabled}`);
      }
    };

    socket.on("webrtc:signal", handleSignal);
    socket.on("webrtc:host-stream-started", handleHostStreamStarted);
    socket.on("webrtc:stream-requested", handleStreamRequested);

    return () => {
      socket.off("webrtc:signal", handleSignal);
      socket.off("webrtc:host-stream-started", handleHostStreamStarted);
      socket.off("webrtc:stream-requested", handleStreamRequested);
    };
  }, [socket, partyId, isHost, userId, createPeer, isMicEnabled, isCameraEnabled]);

  // Comprehensive video debugging and monitoring function
  const debugVideoState = (video, label) => {
    if (!video) {
      log(`[DEBUG ${label}] Video element is null`);
      return;
    }
    
    const rect = video.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(video);
    const stream = video.srcObject;
    
    const debugInfo = {
      label,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      videoDimensions: {
        offsetWidth: video.offsetWidth,
        offsetHeight: video.offsetHeight,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        boundingRect: `${rect.width}x${rect.height}`,
      },
      styles: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
      },
      state: {
        paused: video.paused,
        muted: video.muted,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: video.currentTime,
        duration: video.duration,
      },
      stream: {
        hasStream: !!stream,
        active: stream ? stream.active : false,
        videoTracks: stream ? stream.getVideoTracks().length : 0,
        audioTracks: stream ? stream.getAudioTracks().length : 0,
      },
    };
    
    log(`[DEBUG ${label}]`, JSON.stringify(debugInfo, null, 2));
    
    // Check for issues
    if (video.offsetWidth === 0 || video.offsetHeight === 0) {
      log(`[DEBUG ${label}] ⚠️ VIDEO HAS ZERO DIMENSIONS!`);
    }
    if (video.paused && isCameraEnabled) {
      log(`[DEBUG ${label}] ⚠️ VIDEO IS PAUSED BUT CAMERA IS ENABLED!`);
    }
    if (!stream) {
      log(`[DEBUG ${label}] ⚠️ NO STREAM ATTACHED!`);
    }
    if (stream && !stream.active) {
      log(`[DEBUG ${label}] ⚠️ STREAM IS NOT ACTIVE!`);
    }
    if (computedStyle.display === 'none') {
      log(`[DEBUG ${label}] ⚠️ VIDEO IS HIDDEN (display: none)!`);
    }
    if (computedStyle.visibility === 'hidden') {
      log(`[DEBUG ${label}] ⚠️ VIDEO IS HIDDEN (visibility: hidden)!`);
    }
  };

  // Attach local video when camera is enabled
  useEffect(() => {
    if (isHost && localStream && localVideoRef.current) {
      const video = localVideoRef.current;
      
      log(`[VIDEO DEBUG] Local video setup - isCameraEnabled: ${isCameraEnabled}, hasStream: ${!!localStream}, hasVideoElement: ${!!video}`);
      debugVideoState(video, 'LOCAL_VIDEO_INIT');
      
      // Only attach if not already attached or stream changed
      if (video.srcObject !== localStream) {
        log("[VIDEO DEBUG] Attaching local stream to video preview");
        video.srcObject = localStream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Get parent dimensions first
        const parent = video.parentElement;
        const parentRect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 };
        
        // Force visibility
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        
        // Use explicit dimensions if parent has them, otherwise use percentages with minimums
        if (parentRect.width > 0 && parentRect.height > 0) {
          video.style.width = `${parentRect.width}px`;
          video.style.height = `${parentRect.height}px`;
          log(`[VIDEO DEBUG] Setting initial video dimensions from parent: ${parentRect.width}x${parentRect.height}`);
        } else {
          video.style.width = '100%';
          video.style.height = '100%';
          log(`[VIDEO DEBUG] Parent has no dimensions, using 100% with minimums`);
        }
        
        video.style.minWidth = '60px';
        video.style.minHeight = '60px';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        
        // Play the video - retry if needed
        const playVideo = () => {
          debugVideoState(video, 'LOCAL_VIDEO_BEFORE_PLAY');
          video.play().then(() => {
            log("[VIDEO DEBUG] ✅ Local video preview playing");
            debugVideoState(video, 'LOCAL_VIDEO_AFTER_PLAY_SUCCESS');
          }).catch(err => {
            log(`[VIDEO DEBUG] Local video play issue: ${err.name} - ${err.message}`);
            debugVideoState(video, 'LOCAL_VIDEO_PLAY_FAILED');
            // Retry after delay
            setTimeout(() => {
              video.play().then(() => {
                log("[VIDEO DEBUG] ✅ Local video playing after retry");
                debugVideoState(video, 'LOCAL_VIDEO_RETRY_SUCCESS');
              }).catch(e => {
                log(`[VIDEO DEBUG] Retry play failed: ${e.name}`);
                debugVideoState(video, 'LOCAL_VIDEO_RETRY_FAILED');
                // Add interaction handlers
                const handleInteraction = () => {
                  video.play().catch(() => {});
                  document.removeEventListener('click', handleInteraction);
                  document.removeEventListener('touchstart', handleInteraction);
                  if (video) {
                    video.removeEventListener('click', handleInteraction);
                    video.removeEventListener('touchstart', handleInteraction);
                  }
                };
                document.addEventListener('click', handleInteraction, { once: true });
                document.addEventListener('touchstart', handleInteraction, { once: true });
                if (video) {
                  video.addEventListener('click', handleInteraction, { once: true });
                  video.addEventListener('touchstart', handleInteraction, { once: true });
                }
              });
            }, 200);
          });
        };
        
        playVideo();
      } else if (video.srcObject === localStream && video.paused) {
        log("[VIDEO DEBUG] Stream already attached but paused - trying to play");
        debugVideoState(video, 'LOCAL_VIDEO_PAUSED');
        video.play().catch(err => {
          log(`[VIDEO DEBUG] Resume play failed: ${err.name}`);
        });
      }
      
      // Ensure video is always visible and playing when camera is enabled
      if (isCameraEnabled && video) {
        // Force visibility styles
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.minWidth = '60px';
        video.style.minHeight = '60px';
        
        // Continuously monitor and fix video state
        const checkAndPlay = () => {
          if (!video || video.srcObject !== localStream || !isCameraEnabled) return;
          
          const rect = video.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(video);
          const parent = video.parentElement;
          const parentRect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 };
          
          const needsFix = video.paused || 
                          video.offsetWidth === 0 || 
                          video.offsetHeight === 0 ||
                          rect.width === 0 ||
                          rect.height === 0 ||
                          computedStyle.display === 'none' ||
                          computedStyle.visibility === 'hidden';
          
          if (needsFix) {
            log(`[VIDEO DEBUG] Video needs fix - paused: ${video.paused}, dimensions: ${video.offsetWidth}x${video.offsetHeight}, rect: ${rect.width}x${rect.height}, parent: ${parentRect.width}x${parentRect.height}`);
            debugVideoState(video, 'LOCAL_VIDEO_NEEDS_FIX');
            
            // If parent has dimensions, use them
            if (parentRect.width > 0 && parentRect.height > 0) {
              log(`[VIDEO DEBUG] Parent has dimensions - forcing video to match: ${parentRect.width}x${parentRect.height}`);
              video.style.width = `${parentRect.width}px`;
              video.style.height = `${parentRect.height}px`;
              video.style.minWidth = '60px';
              video.style.minHeight = '60px';
            } else if (parent) {
              // Parent also collapsed - fix entire parent chain
              log(`[VIDEO DEBUG] ⚠️ Parent also collapsed (${parentRect.width}x${parentRect.height}) - fixing parent chain`);
              
              // Check grandparent (participant card)
              const grandParent = parent.parentElement;
              let cardWidth = 0;
              let cardHeight = 0;
              
              if (grandParent) {
                const grandParentRect = grandParent.getBoundingClientRect();
                const grandParentStyle = window.getComputedStyle(grandParent);
                log(`[VIDEO DEBUG] Grandparent (card) dimensions: ${grandParentRect.width}x${grandParentRect.height}, computed: ${grandParentStyle.width}x${grandParentStyle.height}`);
                
                if (grandParentRect.width > 0 && grandParentRect.height > 0) {
                  cardWidth = grandParentRect.width;
                  cardHeight = grandParentRect.height;
                } else {
                  // Card also collapsed - calculate from screen size
                  const screenWidth = window.innerWidth;
                  const cardCount = document.querySelectorAll('[data-participant-container]').length || 1;
                  const gap = 0.5 * 16; // 0.5rem in px
                  const totalGaps = (cardCount - 1) * gap;
                  cardWidth = Math.max((screenWidth - totalGaps) / cardCount, 60);
                  cardHeight = cardWidth; // Aspect ratio 1:1
                  
                  log(`[VIDEO DEBUG] Card collapsed - calculating from screen: ${screenWidth}px, cards: ${cardCount}, cardWidth: ${cardWidth}px`);
                  
                  // Fix card
                  grandParent.style.width = `${cardWidth}px`;
                  grandParent.style.minWidth = '60px';
                  grandParent.style.height = `${cardHeight}px`;
                  grandParent.style.minHeight = '60px';
                }
                
                // Now fix parent container (video container) to match card
                if (cardWidth > 0 && cardHeight > 0) {
                  // Force card to actually render with calculated dimensions
                  grandParent.style.width = `${cardWidth}px`;
                  grandParent.style.height = `${cardHeight}px`;
                  grandParent.style.minWidth = '60px';
                  grandParent.style.minHeight = '60px';
                  grandParent.style.display = 'flex';
                  grandParent.style.flexDirection = 'column';
                  
                  // Force parent container to fill card
                  parent.style.width = '100%';
                  parent.style.height = '100%';
                  parent.style.minWidth = '60px';
                  parent.style.minHeight = '60px';
                  parent.style.display = 'flex';
                  
                  // Force layout recalculation using requestAnimationFrame
                  requestAnimationFrame(() => {
                    // Force another frame to ensure layout is complete
                    requestAnimationFrame(() => {
                      // Get actual dimensions after layout
                      const cardRect = grandParent.getBoundingClientRect();
                      const parentRect = parent.getBoundingClientRect();
                      
                      log(`[VIDEO DEBUG] After layout - card: ${cardRect.width}x${cardRect.height}, parent: ${parentRect.width}x${parentRect.height}`);
                      
                      // Use actual rendered dimensions, fallback to calculated
                      const finalWidth = parentRect.width > 0 ? parentRect.width : cardRect.width > 0 ? cardRect.width : cardWidth;
                      const finalHeight = parentRect.height > 0 ? parentRect.height : cardRect.height > 0 ? cardRect.height : cardHeight;
                      
                      // Set video to explicit pixel dimensions
                      video.style.width = `${finalWidth}px`;
                      video.style.height = `${finalHeight}px`;
                      video.style.minWidth = '60px';
                      video.style.minHeight = '60px';
                      video.style.position = 'absolute';
                      video.style.top = '0';
                      video.style.left = '0';
                      
                      log(`[VIDEO DEBUG] Set video to explicit dimensions: ${finalWidth}x${finalHeight}px`);
                      
                      // Verify after a short delay
                      setTimeout(() => {
                        const videoRect = video.getBoundingClientRect();
                        log(`[VIDEO DEBUG] Video dimensions after explicit set: ${video.offsetWidth}x${video.offsetHeight}, rect: ${videoRect.width}x${videoRect.height}`);
                        if (videoRect.width === 0 || videoRect.height === 0) {
                          log(`[VIDEO DEBUG] ⚠️ Still zero - forcing minimum and triggering play`);
                          video.style.width = '60px';
                          video.style.height = '60px';
                          video.play().catch(() => {});
                        }
                      }, 50);
                    });
                  });
                  return; // Exit early, will be fixed in requestAnimationFrame
                }
              }
              
              // Fallback: force minimum dimensions
              log(`[VIDEO DEBUG] Using fallback minimum dimensions`);
              parent.style.width = '60px';
              parent.style.height = '60px';
              parent.style.minWidth = '60px';
              parent.style.minHeight = '60px';
              video.style.width = '60px';
              video.style.height = '60px';
              video.style.minWidth = '60px';
              video.style.minHeight = '60px';
            } else {
              // No parent - force minimum dimensions
              log(`[VIDEO DEBUG] No parent - forcing minimum dimensions`);
              video.style.width = '60px';
              video.style.height = '60px';
              video.style.minWidth = '60px';
              video.style.minHeight = '60px';
            }
            
            // Force visibility
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            video.style.position = 'absolute';
            video.style.top = '0';
            video.style.left = '0';
            
            // Try to play
            if (video.paused) {
              video.play().catch(() => {});
            }
            
            // Log after fix - wait longer to ensure dimensions are set
            setTimeout(() => {
              const newRect = video.getBoundingClientRect();
              const newParentRect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 };
              
              // If still zero, try one more aggressive fix
              if (newRect.width === 0 || newRect.height === 0) {
                log(`[VIDEO DEBUG] ⚠️ Still zero after fix - trying aggressive fix. Parent: ${newParentRect.width}x${newParentRect.height}`);
                
                // Calculate from screen if parent still zero
                if (newParentRect.width === 0 || newParentRect.height === 0) {
                  const screenWidth = window.innerWidth;
                  const cardCount = document.querySelectorAll('[data-participant-container]').length || 1;
                  const gap = 0.5 * 16;
                  const totalGaps = (cardCount - 1) * gap;
                  const calculatedWidth = Math.max((screenWidth - totalGaps) / cardCount, 60);
                  
                  log(`[VIDEO DEBUG] Calculating from screen: ${calculatedWidth}px`);
                  video.style.width = `${calculatedWidth}px`;
                  video.style.height = `${calculatedWidth}px`;
                  
                  // Also fix parent
                  if (parent) {
                    parent.style.width = `${calculatedWidth}px`;
                    parent.style.height = `${calculatedWidth}px`;
                    parent.style.minWidth = '60px';
                    parent.style.minHeight = '60px';
                  }
                } else {
                  // Parent has dimensions now - use them
                  video.style.width = `${newParentRect.width}px`;
                  video.style.height = `${newParentRect.height}px`;
                }
                
                video.style.minWidth = '60px';
                video.style.minHeight = '60px';
                
                // Check again after another delay
                setTimeout(() => {
                  const finalRect = video.getBoundingClientRect();
                  log(`[VIDEO DEBUG] Final check after aggressive fix - dimensions: ${video.offsetWidth}x${video.offsetHeight}, rect: ${finalRect.width}x${finalRect.height}`);
                  debugVideoState(video, 'LOCAL_VIDEO_AFTER_FIX');
                }, 100);
              } else {
                log(`[VIDEO DEBUG] After fix - dimensions: ${video.offsetWidth}x${video.offsetHeight}, rect: ${newRect.width}x${newRect.height}`);
                debugVideoState(video, 'LOCAL_VIDEO_AFTER_FIX');
              }
            }, 100);
          }
        };
        
        // Check every 500ms for more responsive fixes
        const playInterval = setInterval(() => {
          if (!isCameraEnabled || !video || video.srcObject !== localStream) {
            clearInterval(playInterval);
            return;
          }
          checkAndPlay();
        }, 500);
        
        // Debug every 2 seconds
        const debugInterval = setInterval(() => {
          if (isCameraEnabled && video && video.srcObject === localStream) {
            debugVideoState(video, 'LOCAL_VIDEO_MONITOR');
          }
        }, 2000);
        
        // Also check on video events
        const handlePause = () => {
          log("[VIDEO DEBUG] Video paused event");
          checkAndPlay();
        };
        const handleMetadata = () => {
          log("[VIDEO DEBUG] Video metadata loaded");
          debugVideoState(video, 'LOCAL_VIDEO_METADATA_LOADED');
          if (isCameraEnabled) {
            video.play().catch(() => {});
          }
        };
        const handleResize = () => {
          log("[VIDEO DEBUG] Video resize event");
          debugVideoState(video, 'LOCAL_VIDEO_RESIZE');
          checkAndPlay();
        };
        
        video.addEventListener('pause', handlePause);
        video.addEventListener('loadedmetadata', handleMetadata);
        video.addEventListener('resize', handleResize);
        
        // Cleanup function
        return () => {
          clearInterval(playInterval);
          clearInterval(debugInterval);
          if (video) {
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('loadedmetadata', handleMetadata);
            video.removeEventListener('resize', handleResize);
          }
        };
      }
    }
    
    // Add window resize handler to ensure video continues playing after resize
    let resizeTimeout;
    const handleWindowResize = () => {
      log(`[VIDEO DEBUG] Window resize detected - screen: ${window.innerWidth}x${window.innerHeight}`);
      
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Handle local video (host)
        if (isHost && localVideoRef.current && localStream && isCameraEnabled) {
          const video = localVideoRef.current;
          if (video) {
            log("[VIDEO DEBUG] Handling local video window resize");
            debugVideoState(video, 'LOCAL_VIDEO_WINDOW_RESIZE_START');
            
            // Check if stream is still attached
            if (video.srcObject !== localStream) {
              log("[VIDEO DEBUG] Stream detached on window resize - reattaching");
              video.srcObject = localStream;
            }
            
            // Force visibility and dimensions
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.minWidth = '60px';
            video.style.minHeight = '60px';
            video.style.position = 'absolute';
            video.style.top = '0';
            video.style.left = '0';
            
            // Force play on resize
            video.play().then(() => {
              log("[VIDEO DEBUG] ✅ Local video playing after window resize");
              debugVideoState(video, 'LOCAL_VIDEO_WINDOW_RESIZE_SUCCESS');
            }).catch((err) => {
              log(`[VIDEO DEBUG] Play failed on window resize: ${err.name}, retrying`);
              debugVideoState(video, 'LOCAL_VIDEO_WINDOW_RESIZE_PLAY_FAILED');
              // Retry after a short delay
              setTimeout(() => {
                if (video && video.srcObject === localStream) {
                  video.play().catch(() => {});
                }
              }, 100);
            });
            
            // Check dimensions and force layout if needed
            if (video.offsetWidth === 0 || video.offsetHeight === 0) {
              log("[VIDEO DEBUG] ⚠️ Local video has zero dimensions - forcing layout recalculation");
              const parent = video.parentElement;
              if (parent) {
                const parentDisplay = window.getComputedStyle(parent).display;
                const parentRect = parent.getBoundingClientRect();
                log(`[VIDEO DEBUG] Parent display: ${parentDisplay}, dimensions: ${parent.offsetWidth}x${parent.offsetHeight}, rect: ${parentRect.width}x${parentRect.height}`);
                
                // If parent also has zero dimensions, fix it first
                if (parent.offsetWidth === 0 || parent.offsetHeight === 0) {
                  log("[VIDEO DEBUG] ⚠️ Parent container also has zero dimensions - fixing parent first");
                  
                  // Force parent to have dimensions
                  const parentComputed = window.getComputedStyle(parent);
                  parent.style.width = parentComputed.width || '100%';
                  parent.style.height = parentComputed.height || 'auto';
                  parent.style.minWidth = '60px';
                  parent.style.minHeight = '60px';
                  
                  // If parent's parent exists, check it too
                  const grandParent = parent.parentElement;
                  if (grandParent) {
                    const grandParentRect = grandParent.getBoundingClientRect();
                    log(`[VIDEO DEBUG] Grandparent dimensions: ${grandParent.offsetWidth}x${grandParent.offsetHeight}, rect: ${grandParentRect.width}x${grandParentRect.height}`);
                    
                    if (grandParent.offsetWidth === 0 || grandParent.offsetHeight === 0) {
                      log("[VIDEO DEBUG] ⚠️ Grandparent also has zero dimensions - fixing grandparent");
                      const grandParentComputed = window.getComputedStyle(grandParent);
                      grandParent.style.width = grandParentComputed.width || '100%';
                      grandParent.style.minWidth = '60px';
                    }
                  }
                  
                  // Force reflow on parent
                  parent.style.display = 'none';
                  setTimeout(() => {
                    parent.style.display = parentDisplay || 'flex';
                    // Force dimensions again after reflow
                    if (parent.offsetWidth === 0) {
                      parent.style.width = '100%';
                      parent.style.minWidth = '60px';
                    }
                    if (parent.offsetHeight === 0) {
                      parent.style.height = parent.offsetWidth + 'px'; // Use aspect ratio
                      parent.style.minHeight = '60px';
                    }
                    
                    if (video) {
                      // Force video dimensions
                      video.style.width = '100%';
                      video.style.height = '100%';
                      video.style.minWidth = '60px';
                      video.style.minHeight = '60px';
                      video.play().catch(() => {});
                      debugVideoState(video, 'LOCAL_VIDEO_AFTER_PARENT_FIX');
                    }
                  }, 10);
                } else {
                  // Just force reflow on parent
                  parent.style.display = 'none';
                  setTimeout(() => {
                    parent.style.display = parentDisplay || 'flex';
                    if (video) {
                      video.play().catch(() => {});
                      debugVideoState(video, 'LOCAL_VIDEO_AFTER_WINDOW_REFLOW');
                    }
                  }, 10);
                }
              }
            }
            
            debugVideoState(video, 'LOCAL_VIDEO_WINDOW_RESIZE_END');
          }
        }
        
        // Handle remote video (participants)
        if (!isHost && remoteVideoRef.current && remoteStream) {
          const video = remoteVideoRef.current;
          if (video) {
            log("[VIDEO DEBUG] Handling remote video window resize");
            debugVideoState(video, 'REMOTE_VIDEO_WINDOW_RESIZE_START');
            
            // Check if stream is still attached
            if (video.srcObject !== remoteStream) {
              log("[VIDEO DEBUG] Remote stream detached on window resize - reattaching");
              video.srcObject = remoteStream;
            }
            
            // Force visibility and dimensions
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.minWidth = '60px';
            video.style.minHeight = '60px';
            video.style.position = 'absolute';
            video.style.top = '0';
            video.style.left = '0';
            
            // Force play on resize
            video.play().then(() => {
              log("[VIDEO DEBUG] ✅ Remote video playing after window resize");
              debugVideoState(video, 'REMOTE_VIDEO_WINDOW_RESIZE_SUCCESS');
            }).catch((err) => {
              log(`[VIDEO DEBUG] Remote video play failed on window resize: ${err.name}, retrying`);
              debugVideoState(video, 'REMOTE_VIDEO_WINDOW_RESIZE_PLAY_FAILED');
              // Retry after a short delay
              setTimeout(() => {
                if (video && video.srcObject === remoteStream) {
                  video.play().catch(() => {});
                }
              }, 100);
            });
            
            // Check dimensions and force layout if needed
            if (video.offsetWidth === 0 || video.offsetHeight === 0) {
              log("[VIDEO DEBUG] ⚠️ Remote video has zero dimensions - forcing layout recalculation");
              const parent = video.parentElement;
              if (parent) {
                const parentDisplay = window.getComputedStyle(parent).display;
                log(`[VIDEO DEBUG] Parent display: ${parentDisplay}, dimensions: ${parent.offsetWidth}x${parent.offsetHeight}`);
                // Force reflow
                parent.style.display = 'none';
                setTimeout(() => {
                  parent.style.display = parentDisplay || 'flex';
                  if (video) {
                    video.play().catch(() => {});
                    debugVideoState(video, 'REMOTE_VIDEO_AFTER_WINDOW_REFLOW');
                  }
                }, 10);
              }
            }
            
            debugVideoState(video, 'REMOTE_VIDEO_WINDOW_RESIZE_END');
          }
        }
      }, 150); // Debounce resize events
    };
    
    window.addEventListener('resize', handleWindowResize);
    // Also listen to orientation change
    window.addEventListener('orientationchange', () => {
      log("[VIDEO DEBUG] Orientation change detected");
      // Immediate handling for orientation change
      handleWindowResize();
      // Also handle after orientation change completes
      setTimeout(handleWindowResize, 500);
    });
    
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
    };
  }, [isHost, localStream, isCameraEnabled, remoteStream]);

  // Attach remote video when stream is received
  useEffect(() => {
    if (!isHost && remoteStream && remoteVideoRef.current) {
      const video = remoteVideoRef.current;
      
      // Only attach if not already attached or stream changed
      if (video.srcObject !== remoteStream) {
        log("Attaching remote stream to video element");
        video.srcObject = remoteStream;
        video.muted = true; // Start muted to allow autoplay
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Get parent dimensions and set explicit video dimensions
        const parent = video.parentElement;
        const parentRect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 };
        
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        
        if (parentRect.width > 0 && parentRect.height > 0) {
          video.style.width = `${parentRect.width}px`;
          video.style.height = `${parentRect.height}px`;
          log(`[VIDEO DEBUG] Setting initial remote video dimensions from parent: ${parentRect.width}x${parentRect.height}`);
        } else {
          video.style.width = '100%';
          video.style.height = '100%';
          log(`[VIDEO DEBUG] Parent has no dimensions, using 100% with minimums for initial remote video`);
        }
        
        video.style.minWidth = '60px';
        video.style.minHeight = '60px';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        
        // Play the video (muted, so should work)
        const playVideo = () => {
          video.play().then(() => {
            log("✅ Remote video playing (muted for autoplay)");
            video.volume = audioVolume;
          }).catch(err => {
            log("Remote video play failed, will retry:", err.name);
            
            // Retry after delay with multiple strategies (works for all screen sizes)
            setTimeout(() => {
              video.play().then(() => {
                log("✅ Remote video playing after retry");
                video.volume = audioVolume;
              }).catch(e => {
                log("Retry play failed:", e.name);
                // Strategy 1: Add touch/click handlers directly on video element
                const handleVideoInteraction = () => {
                  video.play().then(() => {
                    log("✅ Remote video playing after video interaction");
                    video.volume = audioVolume;
                  }).catch(() => {});
                  video.removeEventListener('click', handleVideoInteraction);
                  video.removeEventListener('touchstart', handleVideoInteraction);
                };
                video.addEventListener('click', handleVideoInteraction, { once: true });
                video.addEventListener('touchstart', handleVideoInteraction, { once: true });
                
                // Strategy 2: Also try document-level handlers
                const handleDocInteraction = () => {
                  video.play().then(() => {
                    log("✅ Remote video playing after document interaction");
                    video.volume = audioVolume;
                  }).catch(() => {});
                  document.removeEventListener('click', handleDocInteraction);
                  document.removeEventListener('touchstart', handleDocInteraction);
                };
                document.addEventListener('click', handleDocInteraction, { once: true });
                document.addEventListener('touchstart', handleDocInteraction, { once: true });
              });
            }, 200);
          });
        };
        
        playVideo();
      } else if (video.srcObject === remoteStream && video.paused) {
        // Stream already attached but paused - try to play
        video.play().catch(err => {
          log("Resume remote video play failed:", err.name);
          // Add interaction handlers (works for all screen sizes)
          const handleInteraction = () => {
            video.play().catch(() => {});
            video.removeEventListener('click', handleInteraction);
            video.removeEventListener('touchstart', handleInteraction);
          };
          video.addEventListener('click', handleInteraction, { once: true });
          video.addEventListener('touchstart', handleInteraction, { once: true });
        });
      } else {
        // Stream already attached, update mute state when audioEnabled changes
        log(`Updating video mute state - audioEnabled: ${audioEnabled}, paused: ${video.paused}`);
        
        if (audioEnabled) {
          // Unmute if video is playing
          if (!video.paused) {
            video.muted = false;
            video.volume = audioVolume;
            log("✅ Audio enabled by user - unmuted video");
            
            // Ensure video continues playing after unmuting
            if (video.paused) {
              video.play().catch(err => log("Play after unmute failed:", err.name));
            }
          } else {
            log("Video is paused, will unmute when it starts playing");
            // Set up to unmute when video starts
            const onPlay = () => {
              video.muted = false;
              video.volume = audioVolume;
              log("✅ Unmuted video when it started playing");
              video.removeEventListener('play', onPlay);
            };
            video.addEventListener('play', onPlay, { once: true });
          }
        } else {
          video.muted = true;
          log("Audio disabled by user - muted video");
        }
      }
    }
  }, [isHost, remoteStream, audioEnabled, audioVolume]);

  // Sync host state and initialize stream on refresh (but don't recreate on screen size changes)
  const prevHostStateRef = useRef({ hostMicEnabled: false, hostCameraEnabled: false });
  
  useEffect(() => {
    if (isHost) {
      const prevState = prevHostStateRef.current;
      const micChanged = prevState.hostMicEnabled !== hostMicEnabled;
      const cameraChanged = prevState.hostCameraEnabled !== hostCameraEnabled;
      
      // Only update state if it actually changed (not just screen resize)
      if (micChanged || cameraChanged) {
        setIsMicEnabled(hostMicEnabled);
        setIsCameraEnabled(hostCameraEnabled);
        prevHostStateRef.current = { hostMicEnabled, hostCameraEnabled };
      }
      
      // Initialize stream if host has mic/camera enabled but no stream exists (refresh scenario)
      // Only initialize if stream doesn't exist - don't recreate on screen size changes
      if ((hostMicEnabled || hostCameraEnabled) && !localStreamRef.current) {
        log("Host refresh detected - initializing stream with mic:", hostMicEnabled, "camera:", hostCameraEnabled);
        // Use async function to call getMediaStream
        (async () => {
          try {
            const stream = await getMediaStream(hostMicEnabled, hostCameraEnabled);
            localStreamRef.current = stream;
            setLocalStream(stream);
            log("✅ Stream initialized after refresh");
          } catch (err) {
            logError("Failed to initialize stream after refresh:", err);
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, hostMicEnabled, hostCameraEnabled]);

  // Participant: Sync audio enabled state with video element
  useEffect(() => {
    if (!isHost && remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      const video = remoteVideoRef.current;
      log(`Syncing audio state - audioEnabled: ${audioEnabled}, video.paused: ${video.paused}`);
      
      if (audioEnabled) {
        // Unmute the video
        if (!video.paused) {
          video.muted = false;
          video.volume = audioVolume;
          log("✅ Video unmuted (audio enabled)");
        } else {
          // Video is paused, try to play it
          video.muted = false;
          video.volume = audioVolume;
          video.play().then(() => {
            log("✅ Video started playing and unmuted");
          }).catch(err => {
            log("Failed to play video when enabling audio:", err.name);
            // Keep muted if play fails (autoplay policy)
            video.muted = true;
          });
        }
      } else {
        // Mute the video
        video.muted = true;
        log("Video muted (audio disabled)");
      }
    }
  }, [isHost, audioEnabled, audioVolume]);

  // Cleanup
  useEffect(() => {
    return () => {
      log("Cleaning up");
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(peer => peer.destroy());
      peersRef.current.clear();
    };
  }, []);

  return {
    localStream,
    remoteStream,
    isMicEnabled,
    isCameraEnabled,
    error,
    localVideoRef,
    remoteVideoRef,
    audioVolume,
    audioEnabled,
    toggleMic,
    toggleCamera,
    setVolume,
    toggleAudio,
  };
}

