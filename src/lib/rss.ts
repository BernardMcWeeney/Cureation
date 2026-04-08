// RSS feed parser using native fetch
// No dependencies - parses XML with regex

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  formattedDate: string;
  imageUrl?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle plain text
  const plainMatch = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (plainMatch) return plainMatch[1].trim();

  return '';
}

function extractImageFromContent(content: string): string | undefined {
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
  return imgMatch ? imgMatch[1] : undefined;
}

export async function fetchRSSFeed(url: string, limit = 5): Promise<RSSItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const xml = await res.text();

    // Split into <item> blocks
    const items: RSSItem[] = [];
    const itemBlocks = xml.split(/<item>/);

    // Skip the first split (everything before first <item>)
    for (let i = 1; i < itemBlocks.length && items.length < limit; i++) {
      const block = itemBlocks[i].split('</item>')[0];

      const title = stripHtml(extractTag(block, 'title'));
      const link = extractTag(block, 'link');
      const rawDescription = extractTag(block, 'description');
      const content = extractTag(block, 'content:encoded') || rawDescription;
      const pubDate = extractTag(block, 'pubDate');

      // Clean and truncate description
      let description = stripHtml(rawDescription);
      if (description.length > 150) {
        description = description.substring(0, 147) + '...';
      }

      // Format date
      let formattedDate = '';
      if (pubDate) {
        try {
          const date = new Date(pubDate);
          formattedDate = date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          formattedDate = pubDate;
        }
      }

      // Try to extract an image
      const imageUrl = extractImageFromContent(content) || undefined;

      if (title) {
        items.push({ title, link, description, pubDate, formattedDate, imageUrl });
      }
    }

    return items;
  } catch {
    return [];
  }
}
