/**
 * YouTube's own player for a pasted link, loaded from its privacy-friendly
 * address. It fills its parent, which sets the shape (wide, or tall for a Short).
 */
export function YouTubeEmbed({
  id,
  title,
  autoplay = false,
}: {
  id: string;
  title: string;
  autoplay?: boolean;
}) {
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="h-full w-full border-0"
    />
  );
}
