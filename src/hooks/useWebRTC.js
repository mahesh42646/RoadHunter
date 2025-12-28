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
  // Use a ref to store the initial screen size to prevent stream recreation on resize
  const initialScreenSizeRef = useRef({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });
  
  const getMediaStream = async (audio, video) => {
    try {
      // Check if mediaDevices API is available (mobile safety check)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error("MediaDevices API not available. Please use HTTPS or a supported browser.");
        logError("MediaDevices API not available");
        setError(error.message);
        throw error;
      }

      // Use initial screen size (when stream was first created) instead of current screen size
      // This prevents stream recreation when screen size changes
      const isSmallScreen = initialScreenSizeRef.current.width < 768 || initialScreenSizeRef.current.height < 600;
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(isSmallScreen ? {
            sampleRate: 44100, // Lower sample rate for small screens
            channelCount: 1, // Mono for small screens
          } : {
            sampleRate: 48000,
            channelCount: 2, // Stereo for larger screens
            latency: 0.01, // Ultra low latency audio (10ms)
          }),
        } : false,
        video: video ? {
          ...(isSmallScreen ? {
            // Small screen-friendly video constraints
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }, // 30fps for small screens
            facingMode: "user",
          } : {
            // High quality settings for larger screens
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 60, max: 60 }, // 60fps for smooth video
            aspectRatio: { ideal: 16/9 },
            facingMode: "user",
          }),
        } : false,
      };

      log(`Requesting media: audio=${audio}, video=${video}, smallScreen=${isSmallScreen}`);
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

  // Attach local video when camera is enabled
  useEffect(() => {
    if (isHost && localStream && localVideoRef.current) {
      const video = localVideoRef.current;
      
      // Only attach if not already attached or stream changed
      if (video.srcObject !== localStream) {
        log("Attaching local stream to video preview");
        video.srcObject = localStream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Play the video - retry for small screens if needed
        const playVideo = () => {
          video.play().then(() => {
            log("✅ Local video preview playing");
          }).catch(err => {
            log("Local video play issue:", err.name);
            // Retry after delay (works for all screen sizes)
            setTimeout(() => {
              video.play().catch(e => {
                log("Retry play failed:", e.name);
                // Add interaction handlers (works for all screen sizes)
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
        // Stream already attached but paused - try to play (mobile scenario)
        video.play().catch(err => {
          log("Resume play failed:", err.name);
        });
      }
    }
    
    // Add resize handler to ensure video continues playing after resize
    const handleResize = () => {
      if (isHost && localVideoRef.current && localStream && isCameraEnabled) {
        const video = localVideoRef.current;
        if (video && video.paused && video.srcObject === localStream) {
          video.play().catch(() => {});
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isHost, localStream, isCameraEnabled]);

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
        // Stream already attached but paused - try to play (small screen scenario)
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

