"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import styles from "./YouTubePlayer.module.css";
import { isMobileDevice } from "@/lib/mobileUtils";

// YouTube API types
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
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data?: number;
}

interface YouTubeSearchResult {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high?: {
        url: string;
      };
    };
  };
}

interface YouTubeAPI {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: number;
      playerVars: Record<string, number>;
      events: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
    CUED: number;
  };
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
  onVideoChange: (id: string | null) => void;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
}

export default function YouTubePlayer({
  videoId,
  isPlaying,
  syncTime,
  onVideoChange,
  onPlayStateChange,
  onTimeUpdate,
}: Props) {
  // DOM refs
  const ytHolderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);

  // Audio unlock ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const didGesture = useRef(false);

  // Polling
  const pollRef = useRef<number | null>(null);

  // UI State
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Track info
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Metadata
  const [nowTitle, setNowTitle] = useState<string | null>(null);
  const [nowChannel, setNowChannel] = useState<string | null>(null);
  const [nowThumb, setNowThumb] = useState<string | null>(null);

  const format = (s: number) => {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // --------------------------------------------------------------------
  // AUDIO UNLOCK
  // --------------------------------------------------------------------
  const unlockAudio = async () => {
    try {
      const Ctx = (window as WindowWithYouTube).AudioContext || (window as WindowWithYouTube).webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }

      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      console.log("🔊 AudioContext:", audioCtxRef.current.state);
    } catch {}
  };

  // --------------------------------------------------------------------
  // YOUTUBE API LOADER (CORRECT AND GUARANTEED)
  // --------------------------------------------------------------------
  const loadYouTubeAPI = (): Promise<void> => {
    return new Promise((resolve) => {
      // Already available?
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      // Create script tag only once
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }

      // YouTube calls this when ready
      (window as WindowWithYouTube).onYouTubeIframeAPIReady = () => {
        resolve();
      };
    });
  };

  // --------------------------------------------------------------------
  // CREATE PLAYER (ONLY AFTER API READY)
  // --------------------------------------------------------------------
  const createPlayer = useCallback(() => {
    if (!ytHolderRef.current) return;

    const height = isMobileDevice() ? 260 : 360;

    playerRef.current = new window.YT.Player(ytHolderRef.current, {
      width: "100%",
      height,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: (e: YouTubePlayerEvent) => {
          setPlayerReady(true);
          e.target.setVolume(100);
          e.target.unMute();
          setMuted(false);
        },
        onStateChange: (e: YouTubePlayerEvent) => {
          const S = window.YT.PlayerState;
          if (e.data === S.PLAYING) onPlayStateChange(true);
          if (e.data === S.PAUSED || e.data === S.ENDED) onPlayStateChange(false);
          if (e.data === S.CUED) updateDuration();
        },
        onError: () => {
          setPlayerError("Video not playable.");
          setFallback(true);
        },
      },
    });

    startPolling();
  }, [onPlayStateChange, updateDuration, startPolling]);

  // --------------------------------------------------------------------
  // GESTURE INITIALIZER (audio unlock → load YT → create player)
  // --------------------------------------------------------------------
  const initOnGesture = useCallback(() => {
    if (didGesture.current) return;

    const handler = async () => {
      didGesture.current = true;
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);

      await unlockAudio(); // 1️⃣ unlock audio
      await loadYouTubeAPI(); // 2️⃣ load YT API
      createPlayer(); // 3️⃣ create player
    };

    window.addEventListener("click", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
  }, [createPlayer]);

  // --------------------------------------------------------------------
  // POLLING
  // --------------------------------------------------------------------
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      if (!playerReady || !playerRef.current) return;

      const t = playerRef.current.getCurrentTime?.();
      const d = playerRef.current.getDuration?.();

      if (typeof t === "number") {
        setCurrentTime(t);
        onTimeUpdate(t);
      }

      if (typeof d === "number" && d > 0) {
        setDuration(d);
      }
    }, 700);
  }, [playerReady, onTimeUpdate, stopPolling]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // --------------------------------------------------------------------
  // PLAYER ACTIONS (correct order)
  // --------------------------------------------------------------------
  const safePlay = useCallback(async () => {
    await unlockAudio();

    try {
      playerRef.current?.unMute();
      playerRef.current?.setVolume(100);
      setMuted(false);

      playerRef.current?.playVideo();
    } catch {}
  }, []);

  const safePause = () => {
    playerRef.current?.pauseVideo?.();
  };

  const safeSeek = useCallback((sec: number) => {
    playerRef.current?.seekTo?.(Math.max(0, sec), true);
  }, []);

  const updateDuration = useCallback(() => {
    try {
      const d = playerRef.current?.getDuration?.();
      if (d && d > 0) setDuration(d);
    } catch {}
  }, []);

  const safeLoad = useCallback((id: string) => {
    if (!playerReady || !playerRef.current) return;

    playerRef.current.loadVideoById(id);

    setTimeout(() => {
      try {
        playerRef.current.pauseVideo();
      } catch {}
    }, 150);
  }, [playerReady]);

  // --------------------------------------------------------------------
  // SEARCH
  // --------------------------------------------------------------------
  const searchYouTube = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";
      if (!KEY) {
        alert("NEXT_PUBLIC_YOUTUBE_API_KEY missing");
        return;
      }

      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${KEY}`;

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
    setNowThumb(item.snippet.thumbnails?.high?.url);

    onVideoChange(id);
    setSearchResults([]);
    setSearchQuery("");

    setTimeout(() => safeLoad(id), 200);
  };

  // --------------------------------------------------------------------
  // EFFECTS
  // --------------------------------------------------------------------
  useEffect(() => {
    initOnGesture();
    return () => playerRef.current?.destroy?.();
  }, [initOnGesture]);

  useEffect(() => {
    if (videoId && playerReady) safeLoad(videoId);
  }, [videoId, playerReady, safeLoad]);

  useEffect(() => {
    if (!playerReady) return;
    if (isPlaying) safePlay();
    else safePause();
  }, [isPlaying, playerReady, safePlay]);

  useEffect(() => {
    if (playerReady && syncTime > 0) safeSeek(syncTime);
  }, [syncTime, playerReady, safeSeek]);

  const thumb =
    nowThumb || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  return (
    <div className={styles.container}>
      {/* NOW PLAYING */}
      <div className={styles.nowPlayingCard}>
        <div className={styles.artwork}>
          {thumb ? (
            <Image
              src={thumb}
              alt={title || "Album artwork"}
              width={80}
              height={80}
              className={styles.artImg}
            />
          ) : (
            <div className={styles.artPlaceholder}>🎵</div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.title}>{nowTitle || "No track selected"}</div>
          <div className={styles.channel}>{nowChannel || "Search YouTube Music"}</div>

          <div className={styles.controlsRow}>
            <button
              disabled={!playerReady}
              className={styles.playPauseBtn}
              onClick={() => onPlayStateChange(!isPlaying)}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <div className={styles.seekGroup}>
              <button disabled={!playerReady} onClick={() => safeSeek(currentTime - 10)}>
                -10s
              </button>
              <button disabled={!playerReady} onClick={() => safeSeek(currentTime + 10)}>
                +10s
              </button>
            </div>

            <div className={styles.timeText}>
              {format(currentTime)} / {format(duration)}
            </div>
          </div>

          <div className={styles.volumeRow}>
            <button disabled={!playerReady} onClick={() => {
              if (muted) {
                playerRef.current?.unMute();
                setMuted(false);
              } else {
                playerRef.current?.mute();
                setMuted(true);
              }
            }}>
              {muted ? "🔇" : "🔊"}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              disabled={!playerReady}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                playerRef.current?.setVolume(v);
                if (v > 0) {
                  playerRef.current?.unMute();
                  setMuted(false);
                }
              }}
            />
            <span>{volume}%</span>
          </div>
        </div>
      </div>

      {/* SEARCH */}
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

      {/* RESULTS */}
      {searchResults.length > 0 && (
        <div className={styles.results}>
          {searchResults.map((item) => (
            <div
              key={item.id.videoId}
              className={styles.resultItem}
              onClick={() => selectResult(item)}
            >
              <Image
                src={item.snippet.thumbnails?.medium?.url || ""}
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

      {/* PLAYER */}
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
