import type { M3UChannel, M3UPlaylist } from '@/types';

interface ExtInfAttributes {
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  tvgLanguage?: string;
  tvgCountry?: string;
}

function parseExtInfAttributes(line: string): ExtInfAttributes {
  const attributes: ExtInfAttributes = {};

  // Parse tvg-id
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
  if (tvgIdMatch) attributes.tvgId = tvgIdMatch[1];

  // Parse tvg-name
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  if (tvgNameMatch) attributes.tvgName = tvgNameMatch[1];

  // Parse tvg-logo
  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
  if (tvgLogoMatch) attributes.tvgLogo = tvgLogoMatch[1];

  // Parse group-title
  const groupTitleMatch = line.match(/group-title="([^"]*)"/i);
  if (groupTitleMatch) attributes.groupTitle = groupTitleMatch[1];

  // Parse tvg-language
  const tvgLanguageMatch = line.match(/tvg-language="([^"]*)"/i);
  if (tvgLanguageMatch) attributes.tvgLanguage = tvgLanguageMatch[1];

  // Parse tvg-country
  const tvgCountryMatch = line.match(/tvg-country="([^"]*)"/i);
  if (tvgCountryMatch) attributes.tvgCountry = tvgCountryMatch[1];

  return attributes;
}

function parseChannelName(line: string): string {
  // Get the channel name after the last comma
  const commaIndex = line.lastIndexOf(',');
  if (commaIndex !== -1) {
    return line.substring(commaIndex + 1).trim();
  }
  return 'Unknown Channel';
}

function parseEpgUrl(headerLine: string): string | undefined {
  // Parse url-tvg attribute (most common)
  const urlTvgMatch = headerLine.match(/url-tvg="([^"]*)"/i);
  if (urlTvgMatch && urlTvgMatch[1]) return urlTvgMatch[1];

  // Parse x-tvg-url attribute (alternative format)
  const xTvgUrlMatch = headerLine.match(/x-tvg-url="([^"]*)"/i);
  if (xTvgUrlMatch && xTvgUrlMatch[1]) return xTvgUrlMatch[1];

  // Parse tvg-url attribute (another alternative)
  const tvgUrlMatch = headerLine.match(/tvg-url="([^"]*)"/i);
  if (tvgUrlMatch && tvgUrlMatch[1]) return tvgUrlMatch[1];

  return undefined;
}

export function parseM3U(content: string): M3UPlaylist {
  const lines = content.split('\n').map((line) => line.trim());
  const channels: M3UChannel[] = [];
  let playlistInfo: M3UPlaylist['info'] = {};
  let epgUrl: string | undefined;

  let currentExtInf: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Parse #EXTM3U header and extract EPG URL
    if (line.startsWith('#EXTM3U')) {
      epgUrl = parseEpgUrl(line);
      continue;
    }

    // Parse playlist info
    if (line.startsWith('#PLAYLIST:')) {
      playlistInfo.name = line.substring(10).trim();
      continue;
    }

    // Parse #EXTINF line
    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
      continue;
    }

    // Skip other # lines
    if (line.startsWith('#')) {
      continue;
    }

    // This should be a URL line
    if (currentExtInf && (line.startsWith('http://') || line.startsWith('https://'))) {
      const attributes = parseExtInfAttributes(currentExtInf);
      const name = parseChannelName(currentExtInf);

      channels.push({
        tvgId: attributes.tvgId,
        tvgName: attributes.tvgName || name,
        tvgLogo: attributes.tvgLogo,
        groupTitle: attributes.groupTitle || 'Uncategorized',
        name: name,
        url: line,
        language: attributes.tvgLanguage,
        country: attributes.tvgCountry,
      });

      currentExtInf = null;
    }
  }

  return {
    channels,
    info: playlistInfo,
    epgUrl,
  };
}

export function generateM3U(channels: M3UChannel[]): string {
  let content = '#EXTM3U\n';

  for (const channel of channels) {
    const attributes: string[] = [];

    if (channel.tvgId) attributes.push(`tvg-id="${channel.tvgId}"`);
    if (channel.tvgName) attributes.push(`tvg-name="${channel.tvgName}"`);
    if (channel.tvgLogo) attributes.push(`tvg-logo="${channel.tvgLogo}"`);
    if (channel.groupTitle) attributes.push(`group-title="${channel.groupTitle}"`);
    if (channel.language) attributes.push(`tvg-language="${channel.language}"`);
    if (channel.country) attributes.push(`tvg-country="${channel.country}"`);

    const attributeString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';

    content += `#EXTINF:-1${attributeString},${channel.name}\n`;
    content += `${channel.url}\n`;
  }

  return content;
}

export async function fetchAndParseM3U(url: string): Promise<M3UPlaylist> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U: ${response.statusText}`);
  }
  const content = await response.text();
  const result = parseM3U(content);

  // If no channels were found but it's a valid HLS stream, create a single channel
  if (result.channels.length === 0 && isHLSStream(content)) {
    // Extract a name from the URL
    const urlParts = url.split('/');
    let name = urlParts[urlParts.length - 1].replace(/\.m3u8?$/i, '');
    // Make the name more readable
    if (name.length < 3 || name === 'master' || name === 'playlist') {
      name = urlParts[urlParts.length - 2] || 'Live Stream';
    }

    result.channels.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      url: url,
      groupTitle: 'Live',
      tvgName: name,
    });
  }

  return result;
}

function isHLSStream(content: string): boolean {
  // Check if this is an HLS master/variant playlist
  return content.includes('#EXT-X-STREAM-INF') ||
         content.includes('#EXT-X-TARGETDURATION') ||
         content.includes('#EXT-X-MEDIA-SEQUENCE');
}

export function validateM3UUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (url.includes('.m3u') || url.includes('.m3u8') || url.includes('playlist'))
    );
  } catch {
    return false;
  }
}

export function getUniqueCategories(channels: M3UChannel[]): string[] {
  const categories = new Set<string>();
  channels.forEach((channel) => {
    if (channel.groupTitle) {
      categories.add(channel.groupTitle);
    }
  });
  return Array.from(categories).sort();
}

export function groupChannelsByCategory(
  channels: M3UChannel[]
): Record<string, M3UChannel[]> {
  return channels.reduce((acc, channel) => {
    const category = channel.groupTitle || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(channel);
    return acc;
  }, {} as Record<string, M3UChannel[]>);
}
