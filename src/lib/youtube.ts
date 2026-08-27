const ID = /^[A-Za-z0-9_-]{11}$/;

/** Extract a YouTube video id from watch, short, embed, or youtu.be URLs. */
export function youtubeId(url?: string | null): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && ID.test(id) ? id : undefined;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery && ID.test(fromQuery)) return fromQuery;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1] && ID.test(parts[1])) {
        return parts[1];
      }
    }
  } catch {
    const match = value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return match?.[1];
  }

  return undefined;
}

export function youtubeThumbnail(url?: string | null): string | undefined {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

export function youtubeEmbedUrl(url?: string | null): string | undefined {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
}

export function youtubeWatchUrl(url?: string | null): string | undefined {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}
