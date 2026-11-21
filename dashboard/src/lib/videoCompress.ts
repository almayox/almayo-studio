/**
 * Shrinks a video in the browser so it fits the storage limit. Uses the
 * browser's own hardware video encoder, so nothing is sent anywhere first.
 */

/** Storage accepts files up to 25 MB; aim a little under it. */
const LIMIT_BYTES = 25 * 1024 * 1024;
const TARGET_BYTES = 23.5 * 1024 * 1024;
const AUDIO_BITRATE = 128_000;
const MAX_VIDEO_BITRATE = 6_000_000;
/** Below this the picture is too poor to send to a client. */
const MIN_VIDEO_BITRATE = 700_000;

const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

/** Some systems hand over a video with no type, so the name counts too. */
function isVideo(file: File) {
  return file.type.startsWith("video/") || (!file.type && VIDEO_EXTENSION.test(file.name));
}

export function needsVideoCompression(file: File) {
  return isVideo(file) && file.size > TARGET_BYTES;
}

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/** Short side: 1080 when there is bitrate to spare, 720 otherwise. Never upscale. */
function scaleFor(bitrate: number, shortSide: number) {
  return Math.min(1, (bitrate >= 2_500_000 ? 1080 : 720) / shortSide);
}

/** One encoding pass at the given video bitrate. */
async function encode(file: File, bitrate: number, onProgress?: (fraction: number) => void) {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } =
    await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This video could not be read. Export it as MP4 and try again.");
    const scale = scaleFor(bitrate, Math.min(track.displayWidth, track.displayHeight));
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: "avc",
        bitrate,
        width: even(track.displayWidth * scale),
        height: even(track.displayHeight * scale),
        fit: "contain",
        forceTranscode: true,
      },
      audio: { codec: "aac", bitrate: AUDIO_BITRATE },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      throw new Error(
        "This browser cannot compress this video. Use a current Chrome, Edge or Safari, or export a file under 25 MB.",
      );
    }
    if (onProgress) conversion.onProgress = (fraction) => onProgress(fraction);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("Compressing the video failed. Please try again.");
    return buffer;
  } finally {
    input.dispose();
  }
}

async function readDuration(file: File) {
  const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    return await input.computeDuration();
  } catch {
    return NaN;
  } finally {
    input.dispose();
  }
}

/**
 * Returns an MP4 (H.264) small enough to upload. The bitrate is chosen from
 * the video's length so the result lands just under the limit; long videos are
 * scaled down to 720p to keep them clean. Encoders do not hit a bitrate
 * exactly, so a result that is still too big is encoded again, lower. Throws
 * with a readable message when the browser cannot do it or the video is too long.
 */
export async function compressVideo(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const duration = await readDuration(file);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("This video could not be read. Export it as MP4 and try again.");
  }

  const tooLong = () => {
    const maxMinutes = Math.floor(
      (TARGET_BYTES * 8 * 0.95) / (MIN_VIDEO_BITRATE + AUDIO_BITRATE) / 60,
    );
    return new Error(
      `This video is too long to fit the 25 MB limit (about ${maxMinutes} minutes at most). Trim it or export a smaller file.`,
    );
  };

  const fitting = Math.floor((TARGET_BYTES * 8 * 0.95) / duration - AUDIO_BITRATE);
  if (fitting < MIN_VIDEO_BITRATE) throw tooLong();
  let bitrate = Math.min(MAX_VIDEO_BITRATE, fitting);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const buffer = await encode(file, bitrate, onProgress);
    if (buffer.byteLength <= LIMIT_BYTES - 256 * 1024) {
      const base = file.name.replace(/\.[^.]+$/, "") || "video";
      return new File([buffer], `${base}.mp4`, { type: "video/mp4" });
    }
    // Came out bigger than asked: lower the bitrate by how far it overshot.
    bitrate = Math.floor(bitrate * (TARGET_BYTES / buffer.byteLength) * 0.9);
    if (bitrate < MIN_VIDEO_BITRATE) throw tooLong();
  }
  throw new Error("This video could not be made small enough. Export a smaller file and try again.");
}
