// Bluesky public API integration
// Fetches posts from a Bluesky account using the public AT Protocol API

const BSKY_API = 'https://public.api.bsky.app';

export interface BlueskyPost {
  uri: string;
  text: string;
  createdAt: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  url: string;
  images?: { thumb: string; alt: string }[];
}

export async function getBlueskyFeed(handle: string, limit = 5): Promise<BlueskyPost[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Resolve handle to DID
    const resolveRes = await fetch(
      `${BSKY_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { signal: controller.signal }
    );

    if (!resolveRes.ok) {
      clearTimeout(timeout);
      return [];
    }

    const { did } = await resolveRes.json() as { did: string };

    // Fetch author feed
    const feedRes = await fetch(
      `${BSKY_API}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=${limit}&filter=posts_no_replies`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!feedRes.ok) return [];

    const feedData = await feedRes.json() as any;
    const feed = feedData.feed || [];

    return feed.map((item: any) => {
      const post = item.post;
      const record = post.record || {};
      const author = post.author || {};

      // Extract rkey from URI for post URL
      const uriParts = (post.uri || '').split('/');
      const rkey = uriParts[uriParts.length - 1];

      // Extract images if present
      const images: { thumb: string; alt: string }[] = [];
      const embed = post.embed;
      if (embed?.images) {
        for (const img of embed.images) {
          images.push({ thumb: img.thumb || '', alt: img.alt || '' });
        }
      }

      return {
        uri: post.uri || '',
        text: record.text || '',
        createdAt: record.createdAt || '',
        authorName: author.displayName || handle,
        authorHandle: author.handle || handle,
        authorAvatar: author.avatar || undefined,
        likeCount: post.likeCount || 0,
        repostCount: post.repostCount || 0,
        replyCount: post.replyCount || 0,
        url: `https://bsky.app/profile/${author.handle || handle}/post/${rkey}`,
        images: images.length > 0 ? images : undefined,
      } as BlueskyPost;
    });
  } catch {
    return [];
  }
}
