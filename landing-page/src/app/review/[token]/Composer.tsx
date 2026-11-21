"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizontal, Trash2 } from "lucide-react";
import { playChatSound } from "@/lib/chatSounds";

const MAX_SECONDS = 120;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The message bar under a post's comments, working like a chat app: type and
 * press send, or tap the microphone, speak, and press send. The bin cancels a
 * recording.
 */
export function Composer({
  busy,
  onSend,
  onError,
}: {
  busy: boolean;
  /** Resolves to true when the message was posted. */
  onSend: (body: string, audio: Blob | null) => Promise<boolean>;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** What to do with the recording once the recorder has stopped. */
  const keepRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Let go of the microphone if the dialog closes mid-recording.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  function finish(keep: boolean) {
    keepRef.current = keep;
    playChatSound(keep ? "send" : "record-cancel");
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    onError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return onError("Voice notes are not supported in this browser. Please type your comment.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Allow microphone access to record a voice note.");
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      if (keepRef.current && chunks.length) {
        void onSend("", new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    playChatSound("record-start");
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((current) => {
        // At the limit the note is sent as it is.
        if (current + 1 >= MAX_SECONDS) finish(true);
        return current + 1;
      });
    }, 1000);
  }

  async function sendText() {
    const body = draft.trim();
    if (!body || busy) return;
    playChatSound("send");
    if (await onSend(body, null)) {
      setDraft("");
      if (inputRef.current) inputRef.current.style.height = "auto";
    }
  }

  const roundButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50";

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label="Cancel voice note"
          className={`${roundButton} bg-foam text-red-600 ring-1 ring-mist hover:bg-red-50`}
        >
          <Trash2 size={18} aria-hidden />
        </button>
        <div
          role="status"
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-foam px-4 text-sm text-navy ring-1 ring-mist"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
          <span className="tabular-nums">{formatTime(seconds)}</span>
          <span className="truncate text-navy/50">Recording…</span>
        </div>
        <button
          type="button"
          onClick={() => finish(true)}
          aria-label="Send voice note"
          className={`${roundButton} bg-navy text-white`}
        >
          <SendHorizontal size={18} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          // Grows with the text, up to a few lines.
          event.target.style.height = "auto";
          event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void sendText();
          }
        }}
        placeholder="Message"
        aria-label="Message"
        dir="auto"
        className="min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-mist bg-foam px-4 py-2.5 text-sm outline-none ring-navy/30 focus:ring-2"
      />
      {draft.trim() ? (
        <button
          type="button"
          onClick={sendText}
          disabled={busy}
          aria-label="Send message"
          className={`${roundButton} bg-navy text-white`}
        >
          <SendHorizontal size={18} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={busy}
          aria-label="Record a voice note"
          className={`${roundButton} bg-navy text-white`}
        >
          <Mic size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}
