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
  const getMediaStream = async (audio, video) => {
    try {
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2, // Stereo for better quality
          latency: 0.01, // Ultra low latency audio (10ms)
        } : false,
        video: video ? {
          // High quality settings for local network
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 }, // 60fps for smooth video
          aspectRatio: { ideal: 16/9 },
          // Prefer hardware acceleration
          facingMode: "user",
        } : false,
      };

      log(`Requesting media: audio=${audio}, video=${video}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      log(`Creating peer with stream: ${streamToUse.getAudioTracks().length} audio, ${streamToUse.getVideoTracks().length} video tracks`);
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
        // Prefer direct connection (no relay) for local network
        iceTransportPolicy: "all",
        iceCandidatePoolSize: 0, // Don't pre-gather (faster for local)
        // Optimize for low latency
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      },
      // Optimize SDP for low latency
      sdpTransform: (sdp) => {
        // Remove buffering delays
        sdp = sdp.replace(/a=fmtp:\d+ .*\r\n/g, (match) => {
          return match.replace(/profile-level-id=[^\s]+/g, 'profile-level-id=42e01f'); // High profile
        });
        // Set low latency mode
        sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\na=x-google-flag:conference\r\n');
        return sdp;
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
      
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
      
      // Attach to video element immediately with low latency settings
      const attachStream = () => {
        if (remoteVideoRef.current) {
          log("Attaching stream to remote video element");
          const video = remoteVideoRef.current;
          
          // Configure for low latency playback
          video.srcObject = stream;
          video.muted = !audioEnabled;
          video.volume = audioVolume;
          
          // Low latency video settings
          video.playsInline = true;
          video.autoplay = true;
          
          // Ultra low latency: minimize buffering aggressively
          const reduceBuffer = () => {
            if (video.buffered.length > 0) {
              const bufferedEnd = video.buffered.end(video.buffered.length - 1);
              const currentTime = video.currentTime;
              const bufferSize = bufferedEnd - currentTime;
              
              // Keep buffer extremely small (50ms max)
              if (bufferSize > 0.05) {
                video.currentTime = bufferedEnd - 0.05;
                log(`Reduced buffer from ${bufferSize.toFixed(3)}s to 0.05s`);
              }
            }
          };
          
          video.addEventListener('loadedmetadata', reduceBuffer, { once: true });
          video.addEventListener('progress', reduceBuffer);
          video.addEventListener('timeupdate', reduceBuffer);
          
          // Force enable tracks
          stream.getAudioTracks().forEach(track => {
            track.enabled = true;
            log(`  🔊 Enabled audio track: ${track.id}`);
          });
          stream.getVideoTracks().forEach(track => {
            track.enabled = true;
            log(`  📹 Enabled video track: ${track.id}`);
          });
          
          // Play immediately for low latency
          video.play().then(() => {
            log("✅ Remote video playing");
            log(`  Video muted: ${video.muted}`);
            log(`  Video volume: ${video.volume}`);
            log(`  Video readyState: ${video.readyState}`);
            
            // Ensure audio and video are synchronized
            video.addEventListener('timeupdate', () => {
              // Keep audio and video in sync
              if (video.audioTracks && video.audioTracks.length > 0) {
                // Audio is part of video element, already synced
              }
            });
          }).catch(err => {
            logError("Remote video play failed:", err);
          });
        } else {
          logError("Remote video element not available, will retry");
          setTimeout(attachStream, 100); // Faster retry for lower latency
        }
      };
      
      attachStream();
    });

    // Handle connection - optimize for high quality and low latency
    peer.on("connect", () => {
      log(`✅ Connected to ${targetId}`);
      
      // Optimize connection for ultra low latency and high quality
      if (peer._pc) {
        const pc = peer._pc;
        
        // Set ultra low latency and high quality settings
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track && sender.track.kind === 'video') {
            sender.getParameters().then(params => {
              if (params.encodings && params.encodings.length > 0) {
                // Maximum quality for local network
                params.encodings.forEach(encoding => {
                  encoding.maxBitrate = 10000000; // 10 Mbps for high quality
                  encoding.maxFramerate = 60;
                  encoding.priority = 'very-high';
                  encoding.networkPriority = 'very-high';
                  // Low latency mode
                  encoding.scaleResolutionDownBy = 1; // No downscaling
                });
                sender.setParameters(params).catch(err => {
                  logError("Failed to set video encoding parameters:", err);
                });
              }
            }).catch(err => {
              logError("Failed to get sender parameters:", err);
            });
          } else if (sender.track && sender.track.kind === 'audio') {
            // Optimize audio for low latency
            sender.getParameters().then(params => {
              if (params.encodings && params.encodings.length > 0) {
                params.encodings.forEach(encoding => {
                  encoding.maxBitrate = 128000; // High quality audio
                  encoding.priority = 'very-high';
                });
                sender.setParameters(params).catch(() => {});
              }
            }).catch(() => {});
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
        
        // Add stream to all existing active peers, or recreate them if needed
        peersRef.current.forEach((peer, id) => {
          if (peer.destroyed) {
            log(`Peer ${id} is destroyed, recreating...`);
            // Recreate peer with new stream
            const newPeer = createPeer(id, false);
            peersRef.current.set(id, newPeer);
          } else if (localStreamRef.current) {
            try {
              peer.addStream(localStreamRef.current);
              log(`✅ Added audio stream to peer ${id}`);
            } catch (err) {
              logError(`Failed to add audio stream to peer ${id}:`, err);
              // Try recreating peer
              log(`Recreating peer ${id} due to addStream error`);
              const newPeer = createPeer(id, false);
              peersRef.current.set(id, newPeer);
            }
          }
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
        
        // Add stream to all existing active peers, or recreate them if needed
        peersRef.current.forEach((peer, id) => {
          if (peer.destroyed) {
            log(`Peer ${id} is destroyed, recreating...`);
            // Recreate peer with new stream
            const newPeer = createPeer(id, false);
            peersRef.current.set(id, newPeer);
          } else if (localStreamRef.current) {
            try {
              peer.addStream(localStreamRef.current);
              log(`✅ Added video stream to peer ${id}`);
            } catch (err) {
              logError(`Failed to add video stream to peer ${id}:`, err);
              // Try recreating peer
              log(`Recreating peer ${id} due to addStream error`);
              const newPeer = createPeer(id, false);
              peersRef.current.set(id, newPeer);
            }
          }
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
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = !newValue;
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
        
        // If peer doesn't exist or is destroyed, create a new one
        if (!peer || peer.destroyed) {
          log(`Creating new peer for host ${data.fromUserId} (existing: ${!!peer}, destroyed: ${peer?.destroyed})`);
          peer = createPeer(data.fromUserId, true);
        }
      }
      
      if (peer && !peer.destroyed) {
        try {
          peer.signal(data.signal);
          log(`✅ Processed signal from ${data.fromUserId}`);
        } catch (err) {
          logError("Error processing signal:", err);
          // Recreate peer and retry
          log(`Recreating peer for ${data.fromUserId} due to error`);
          const newPeer = createPeer(data.fromUserId, isHost ? false : true);
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
      
      log(`🎬 Host stream started - audio: ${data.audio}, video: ${data.video}, hostId: ${data.hostId}`);
      
      if (data.hostId) {
        hostIdRef.current = data.hostId;
      }
      
      const hostId = data.hostId || "host";
      
      // Destroy existing peer if it exists
      const existing = peersRef.current.get(hostId);
      if (existing && !existing.destroyed) {
        log(`Destroying existing peer for host`);
        try {
          existing.destroy();
        } catch (err) {
          logError("Error destroying existing peer:", err);
        }
        peersRef.current.delete(hostId);
      }
      
      // Create new peer as initiator (participant initiates connection)
      const peer = createPeer(hostId, true);
      log(`✅ Created peer connection to host`);
    };

    socket.on("webrtc:signal", handleSignal);
    socket.on("webrtc:host-stream-started", handleHostStreamStarted);

    return () => {
      socket.off("webrtc:signal", handleSignal);
      socket.off("webrtc:host-stream-started", handleHostStreamStarted);
    };
  }, [socket, partyId, isHost, userId, createPeer]);

  // Attach local video when camera is enabled (optimized for low latency)
  useEffect(() => {
    if (isHost && isCameraEnabled && localStreamRef.current && localVideoRef.current) {
      log("Attaching local stream to video preview");
      const video = localVideoRef.current;
      video.srcObject = localStreamRef.current;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = "none"; // No preloading for instant display
      
      // Minimize buffering
      const reduceBuffer = () => {
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          if (bufferedEnd - video.currentTime > 0.05) {
            video.currentTime = bufferedEnd - 0.05;
          }
        }
      };
      video.addEventListener('progress', reduceBuffer);
      
      video.play().catch(err => {
        logError("Local video play failed:", err);
      });
    }
  }, [isHost, isCameraEnabled, localStream]);

  // Attach remote video when stream is received
  useEffect(() => {
    if (!isHost && remoteStream && remoteVideoRef.current) {
      log("Updating remote video element");
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = !audioEnabled;
      remoteVideoRef.current.volume = audioVolume;
      remoteVideoRef.current.play().catch(err => {
        logError("Remote video play failed:", err);
      });
    }
  }, [isHost, remoteStream, audioEnabled, audioVolume]);

  // Sync host state
  useEffect(() => {
    if (isHost) {
      setIsMicEnabled(hostMicEnabled);
      setIsCameraEnabled(hostCameraEnabled);
    }
  }, [isHost, hostMicEnabled, hostCameraEnabled]);

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

