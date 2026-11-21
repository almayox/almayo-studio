"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A voice note in a chat bubble: play button, progress bar and length. */
export function VoiceNote({ src, onDark }: { src: string; onDark: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  function readDuration() {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration)) return setDuration(audio.duration);
    // Browser recordings carry no length. Jumping to the end makes the browser work it out.
    const onSeeked = () => {
      audio.removeEventListener("timeupdate", onSeeked);
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      audio.currentTime = 0;
      setPosition(0);
    };
    audio.addEventListener("timeupdate", onSeeked);
    audio.currentTime = 1e9;
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const tone = onDark
    ? { button: "bg-white text-navy", track: "bg-white/30", fill: "bg-white", text: "text-white/75" }
    : { button: "bg-navy text-white", track: "bg-navy/15", fill: "bg-navy", text: "text-navy/60" };

  return (
    <div className="flex w-56 max-w-full items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={readDuration}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.button}`}
      >
        {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-label="Jump within the voice note"
          onClick={(event) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const box = event.currentTarget.getBoundingClientRect();
            audio.currentTime = ((event.clientX - box.left) / box.width) * duration;
          }}
          className="block w-full py-2"
        >
          <span className={`block h-1 w-full overflow-hidden rounded-full ${tone.track}`}>
            <span
              className={`block h-full rounded-full ${tone.fill}`}
              style={{ width: `${fraction * 100}%` }}
            />
          </span>
        </button>
        <p className={`text-[11px] tabular-nums ${tone.text}`}>
          {formatTime(playing || position > 0 ? position : duration)}
        </p>
      </div>
    </div>
  );
}
