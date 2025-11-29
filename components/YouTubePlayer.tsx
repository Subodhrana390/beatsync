"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import styles from "./YouTubePlayer.module.css";
import { isMobileDevice } from "@/lib/mobileUtils";

interface YouTubePlayer {
  destroy: () => void;
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  unMute: () => void;
  mute: () => void;
  isMuted: () => boolean;
  getVolume: () => number;
  getIframe?: () => HTMLIFrameElement;
  addEventListener?: (event: string, callback: any) => void;
  removeEventListener?: (event: string, callback: any) => void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data?: number;
}

interface YouTubeSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { high?: { url: string }; medium?: { url: string } };
  };
}

interface YouTubeAPI {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
        onError?: (event: any) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; CUED: number };
}

interface WindowWithYouTube extends Window {
  YT?: YouTubeAPI;
  onYouTubeIframeAPIReady?: () => void;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

interface Props {
  videoId: string | null;
  isPlaying: boolean;
  syncTime: number;
  syncTimestamp?: number; // Optional timestamp for latency compensation
  duration?: number; // Optional synchronized duration
  onVideoChange: (id: string | null) => void;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
  onDurationUpdate?: (duration: number) => void; // Optional callback for duration sync
  onSeek?: (time: number) => void; // Optional callback for seek synchronization
  onPlayerReady?: (ready: boolean) => void; // Optional callback for player ready state
}

export default function YouTubePlayer({
  videoId,
  isPlaying,
  syncTime,
  syncTimestamp,
  duration: syncDuration,
  onVideoChange,
  onPlayStateChange,
  onTimeUpdate,
  onDurationUpdate,
  onSeek,
  onPlayerReady,
}: Props) {
  const ytHolderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const didGesture = useRef(false);
  const pollRef = useRef<number | null>(null);

  const [ytReallyReady, setYtReallyReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Queue for sync operations that should execute when player becomes ready
  const syncQueueRef = useRef<Array<{ type: 'seek' | 'load' | 'play' | 'pause', data: any }>>([]);

  // Persist last known sync state for recovery after player recreation
  const lastSyncStateRef = useRef<{
    videoId: string | null;
    currentTime: number;
    isPlaying: boolean;
    duration: number;
  } | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [nowTitle, setNowTitle] = useState<string | null>(null);
  const [nowChannel, setNowChannel] = useState<string | null>(null);
  const [nowThumb, setNowThumb] = useState<string | null>(null);

  const format = (s: number) => {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // --------------------------- AUDIO UNLOCK ---------------------------
  const unlockAudio = async () => {
    try {
      const Ctx = (window as WindowWithYouTube).AudioContext || (window as WindowWithYouTube).webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();

      console.log("🔊 AudioContext:", audioCtxRef.current.state);
    } catch {}
  };

  // --------------------------- LOAD YT API ----------------------------
  const loadYouTubeAPI = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }

      (window as WindowWithYouTube).onYouTubeIframeAPIReady = () => resolve();
    });
  };

  // --------------------------- CREATE PLAYER --------------------------
  const createPlayer = useCallback(() => {
    if (!ytHolderRef.current) return;
    const height = isMobileDevice() ? 260 : 360;

    playerRef.current = new window.YT!.Player(ytHolderRef.current, {
      width: "100%",
      height,
      playerVars: { autoplay: 0, controls: 1, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (e) => {
          console.log(`✅ YouTubePlayer: Player ready, processing queued operations`);
          setYtReallyReady(true);
          e.target.setVolume(100);
          e.target.unMute();
          setMuted(false);

          // Notify parent component that player is ready
          if (onPlayerReady) {
            onPlayerReady(true);
          }

          // Process any queued sync operations
          setTimeout(() => processSyncQueue(), 100); // Small delay to ensure player is fully ready
        },
        onStateChange: (e) => {
          const S = window.YT!.PlayerState;
          if (e.data === S.PLAYING) onPlayStateChange(true);
          if (e.data === S.PAUSED || e.data === S.ENDED) onPlayStateChange(false);
          if (e.data === S.CUED) updateDuration();
        },
        onError: () => setPlayerError("Video not playable."),
      },
    });

    startPolling();
  }, [onPlayStateChange]);

  // --------------------------- GESTURE INIT --------------------------
  const initOnGesture = useCallback(() => {
    if (didGesture.current) return;

    const handler = async () => {
      didGesture.current = true;
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);

      await unlockAudio();
      await loadYouTubeAPI();
      createPlayer();
    };

    window.addEventListener("click", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
  }, [createPlayer]);


  // --------------------------- POLLING -------------------------------
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      if (!ytReallyReady || !playerRef.current) return;

      const t = playerRef.current.getCurrentTime?.();
      const d = playerRef.current.getDuration?.();

      if (typeof t === "number") {
        const prevTime = currentTime;
        setCurrentTime(t);
        onTimeUpdate(t);
        if (Math.abs(t - prevTime) > 1) { // Log significant time changes
          console.log(`⏱️ YouTubePlayer: Time updated from ${prevTime.toFixed(1)}s to ${t.toFixed(1)}s`);
        }
      }
      if (typeof d === "number" && d > 0) {
        setDuration(d);
        // If we have a duration update callback and this is a significant change, notify
        if (onDurationUpdate && Math.abs(d - (syncDuration || 0)) > 1) {
          onDurationUpdate(d);
        }
      }
    }, 100);
  }, [ytReallyReady, onTimeUpdate]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // --------------------------- SAFE PLAYER CALLS ---------------------
  const safePlay = useCallback(() => {
    const player = playerRef.current;

    // If player is ready, execute immediately
    if (ytReallyReady && player) {
      try {
        const iframe = player.getIframe?.();
        if (iframe?.src) {
          console.log(`▶️ YouTubePlayer: Playing video`);
          player.unMute?.();
          player.setVolume?.(100);
          setMuted(false);
          player.playVideo?.();
          return;
        }
      } catch (e) {
        console.warn("safePlay failed; iframe not ready.", e);
      }
    }

    // If player isn't ready, queue the operation
    console.log(`⏳ YouTubePlayer: Player not ready, queuing play`);
    syncQueueRef.current.push({
      type: 'play',
      data: {}
    });
  }, [ytReallyReady]);

  const safePause = useCallback(() => {
    const player = playerRef.current;

    // If player is ready, execute immediately
    if (ytReallyReady && player) {
      try {
        const iframe = player.getIframe?.();
        if (iframe?.src) {
          console.log(`⏸️ YouTubePlayer: Pausing video`);
          player.pauseVideo?.();
          return;
        }
      } catch (e) {
        console.warn("safePause failed; iframe not ready.", e);
      }
    }

    // If player isn't ready, queue the operation
    console.log(`⏳ YouTubePlayer: Player not ready, queuing pause`);
    syncQueueRef.current.push({
      type: 'pause',
      data: {}
    });
  }, [ytReallyReady]);

  const safeSeek = useCallback((sec: number, isSyncSeek = false) => {
    const player = playerRef.current;
    const targetTime = Math.max(0, sec);

    console.log(`🎯 YouTubePlayer: safeSeek called with ${sec}s, target: ${targetTime}s, isSyncSeek: ${isSyncSeek}`);

    // If player is ready, execute immediately
    if (ytReallyReady && player) {
      try {
        console.log(`✅ YouTubePlayer: Player is ready, attempting seek`);
        const iframe = player.getIframe?.();
        console.log(`📺 YouTubePlayer: iframe exists: ${!!iframe}, src: ${iframe?.src ? 'present' : 'missing'}`);

        if (iframe?.src) {
          console.log(`🎯 YouTubePlayer: Executing seekTo(${targetTime}, true)`);
          player.seekTo?.(targetTime, true);
          console.log(`📡 YouTubePlayer: seekTo called successfully`);

          // Only notify about seeks if it's not a sync operation (to avoid loops)
          if (!isSyncSeek && onSeek) {
            console.log(`📤 YouTubePlayer: Triggering onSeek callback with ${targetTime}s`);
            onSeek(targetTime);
          }
          return;
        } else {
          console.warn("❌ YouTubePlayer: iframe not ready (no src)");
        }
      } catch (e) {
        console.warn("❌ YouTubePlayer: safeSeek failed with exception:", e);
      }
    } else {
      console.log(`⏳ YouTubePlayer: Player not ready - ytReallyReady: ${ytReallyReady}, player exists: ${!!player}`);
    }

    // If player isn't ready, queue the operation
    console.log(`📋 YouTubePlayer: Queuing seek operation for ${targetTime}s`);
    syncQueueRef.current.push({
      type: 'seek',
      data: { time: targetTime, isSyncSeek }
    });
  }, [ytReallyReady, onSeek]);

  const updateDuration = useCallback(() => {
    try {
      const d = playerRef.current?.getDuration?.();
      if (d && d > 0) setDuration(d);
    } catch {}
  }, []);

  const safeLoad = useCallback(
    (id: string) => {
      const player = playerRef.current;

      // If player is ready, execute immediately
      if (ytReallyReady && player) {
        try {
          console.log(`📺 YouTubePlayer: Loading video ${id}`);
          player.loadVideoById(id);

          // Listen for CUED state to pause safely
          const handleStateChange = (event: any) => {
            if (event.data === window.YT!.PlayerState.CUED) {
              player.pauseVideo?.();
              player.removeEventListener?.("onStateChange", handleStateChange);
            }
          };
          player.addEventListener?.("onStateChange", handleStateChange);
          return;
        } catch (e) {
          console.warn("safeLoad failed; player not ready.", e);
        }
      }

      // If player isn't ready, queue the operation
      console.log(`⏳ YouTubePlayer: Player not ready, queuing load for ${id}`);
      syncQueueRef.current.push({
        type: 'load',
        data: { videoId: id }
      });
    },
    [ytReallyReady]
  );

  // --------------------------- SYNC QUEUE PROCESSING -----------------
  const processSyncQueue = useCallback(() => {
    if (!ytReallyReady || !playerRef.current) return;

    console.log(`🔄 YouTubePlayer: Processing ${syncQueueRef.current.length} queued sync operations`);

    // First, process any explicit queued operations
    while (syncQueueRef.current.length > 0) {
      const operation = syncQueueRef.current.shift();
      if (!operation) break;

      try {
        switch (operation.type) {
          case 'seek':
            console.log(`🎯 YouTubePlayer: Executing queued seek to ${operation.data.time}s`);
            safeSeek(operation.data.time, operation.data.isSyncSeek);
            break;
          case 'load':
            console.log(`📺 YouTubePlayer: Executing queued load for ${operation.data.videoId}`);
            safeLoad(operation.data.videoId);
            break;
          case 'play':
            console.log(`▶️ YouTubePlayer: Executing queued play`);
            safePlay();
            break;
          case 'pause':
            console.log(`⏸️ YouTubePlayer: Executing queued pause`);
            safePause();
            break;
        }
      } catch (error) {
        console.warn(`⚠️ YouTubePlayer: Failed to execute queued operation:`, operation, error);
      }
    }

    // Then, if we have a last known sync state and no video is loaded, restore it
    const lastState = lastSyncStateRef.current;
    if (lastState && lastState.videoId && !videoId) {
      console.log(`🔄 YouTubePlayer: Restoring last sync state:`, lastState);
      // Load the video first, then seek and play/pause as needed
      setTimeout(() => {
        if (lastState.videoId) safeLoad(lastState.videoId);
        setTimeout(() => {
          if (lastState.currentTime > 0) safeSeek(lastState.currentTime, true);
          if (lastState.isPlaying) safePlay();
          else safePause();
        }, 500); // Give time for video to load
      }, 100);
    }
  }, [ytReallyReady, safeSeek, safeLoad, safePlay, safePause, videoId]);

  // --------------------------- SEARCH -------------------------------
  const searchYouTube = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);

    try {
      const KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";
      if (!KEY) return alert("NEXT_PUBLIC_YOUTUBE_API_KEY missing");

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
        q
      )}&key=${KEY}`;

      const r = await fetch(url);
      const data = await r.json();
      setSearchResults(data.items || []);
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (item: YouTubeSearchResult) => {
    const id = item?.id?.videoId;
    if (!id) return;

    setNowTitle(item.snippet.title);
    setNowChannel(item.snippet.channelTitle);
    setNowThumb(item.snippet.thumbnails?.high?.url ?? null);

    onVideoChange(id);
    setSearchResults([]);
    setSearchQuery("");

    setTimeout(() => safeLoad(id), 200);
  };

  // --------------------------- EFFECTS -------------------------------
  useEffect(() => {
    initOnGesture();
    return () => {
      playerRef.current?.destroy?.();
      // Clear sync queue on cleanup
      syncQueueRef.current = [];
      // Notify that player is no longer ready
      if (onPlayerReady) {
        onPlayerReady(false);
      }
    };
  }, [initOnGesture, onPlayerReady]);

  // Process sync queue when player becomes ready
  useEffect(() => {
    if (ytReallyReady) {
      processSyncQueue();
    }
  }, [ytReallyReady, processSyncQueue]);

  useEffect(() => {
    if (videoId && ytReallyReady) safeLoad(videoId);
  }, [videoId, ytReallyReady, safeLoad]);

  useEffect(() => {
    // Save sync state for recovery
    lastSyncStateRef.current = {
      videoId,
      currentTime: syncTime,
      isPlaying,
      duration: syncDuration || 0
    };

    if (!ytReallyReady) return;
    if (isPlaying) safePlay();
    else safePause();
  }, [isPlaying, ytReallyReady, safePlay, safePause, videoId, syncTime, syncDuration]);

  useEffect(() => {
    // Save sync state for recovery
    lastSyncStateRef.current = {
      videoId,
      currentTime: syncTime,
      isPlaying,
      duration: syncDuration || 0
    };

    if (ytReallyReady && syncTime > 0) {
      console.log(`🔄 YouTubePlayer: syncTime changed to ${syncTime}s, player ready: ${ytReallyReady}`)
      // If we have a timestamp, calculate latency-compensated time
      let adjustedTime = syncTime;
      if (syncTimestamp) {
        const now = Date.now();
        const latencyMs = now - syncTimestamp;
        const latencySeconds = latencyMs / 1000;
        adjustedTime = Math.max(0, syncTime + latencySeconds);
        console.log(`⏰ Latency compensation: ${latencyMs}ms (${latencySeconds.toFixed(2)}s), seeking to ${adjustedTime.toFixed(2)}s instead of ${syncTime.toFixed(2)}s`);
      } else {
        console.log(`🎯 YouTubePlayer: No timestamp, seeking directly to ${syncTime}s`)
      }
      safeSeek(adjustedTime, true); // true = this is a sync operation
    } else {
      console.log(`🚫 YouTubePlayer: Not seeking - ready: ${ytReallyReady}, syncTime: ${syncTime}`)
    }
  }, [syncTime, syncTimestamp, ytReallyReady, safeSeek, videoId, isPlaying, syncDuration]);

  const thumb =
    nowThumb || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  // --------------------------- RENDER -------------------------------
  return (
    <div className={styles.container}>
      <div className={styles.nowPlayingCard}>
        <div className={styles.artwork}>
          {thumb ? (
            <Image src={thumb} alt={nowTitle || "Artwork"} width={80} height={80} className={styles.artImg} />
          ) : (
            <div className={styles.artPlaceholder}>🎵</div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.title}>{nowTitle || "No track selected"}</div>
          <div className={styles.channel}>{nowChannel || "Search YouTube Music"}</div>

          <div className={styles.controlsRow}>
            <button disabled={!ytReallyReady} className={styles.playPauseBtn} onClick={() => onPlayStateChange(!isPlaying)}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            <div className={styles.seekGroup}>
              <button
                disabled={!ytReallyReady}
                onClick={() => {
                  console.log(`🔘 YouTubePlayer: -10s button clicked, currentTime: ${currentTime}, ytReady: ${ytReallyReady}`);
                  safeSeek(currentTime - 10);
                }}
                title={ytReallyReady ? `-10s (current: ${currentTime.toFixed(1)}s)` : "Player not ready"}
              >
                -10s
              </button>
              <button
                disabled={!ytReallyReady}
                onClick={() => {
                  console.log(`🔘 YouTubePlayer: +10s button clicked, currentTime: ${currentTime}, ytReady: ${ytReallyReady}`);
                  safeSeek(currentTime + 10);
                }}
                title={ytReallyReady ? `+10s (current: ${currentTime.toFixed(1)}s)` : "Player not ready"}
              >
                +10s
              </button>
            </div>

            <div className={styles.timeText}>
              {format(currentTime)} / {format(syncDuration || duration)}
            </div>
          </div>

          <div className={styles.volumeRow}>
            <button
              disabled={!ytReallyReady}
              onClick={() => {
                if (muted) {
                  playerRef.current?.unMute?.();
                  setMuted(false);
                } else {
                  playerRef.current?.mute?.();
                  setMuted(true);
                }
              }}
            >
              {muted ? "🔇" : "🔊"}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              disabled={!ytReallyReady}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                playerRef.current?.setVolume?.(v);
                if (v > 0) {
                  playerRef.current?.unMute?.();
                  setMuted(false);
                }
              }}
            />
            <span>{volume}%</span>
          </div>
        </div>
      </div>

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="Search YouTube Music…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchYouTube()}
        />
        <button className={styles.searchBtn} onClick={searchYouTube}>
          {searching ? "…" : "Search"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className={styles.results}>
          {searchResults.map((item) => (
            <div key={item.id.videoId} className={styles.resultItem} onClick={() => selectResult(item)}>
              <Image
                src={item.snippet.thumbnails?.medium?.url ?? ""}
                alt={item.snippet.title}
                width={120}
                height={90}
                className={styles.resultThumb}
              />
              <div>
                <div className={styles.resultTitle}>{item.snippet.title}</div>
                <div className={styles.resultChannel}>{item.snippet.channelTitle}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.playerArea}>
        <div ref={ytHolderRef} className={styles.iframeHolder} />
        {playerError && (
          <div className={styles.playerError}>
            ⚠ {playerError}
            <button onClick={() => setPlayerError(null)}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
