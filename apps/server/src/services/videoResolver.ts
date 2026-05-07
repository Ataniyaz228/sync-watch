import { spawn } from 'child_process';
import type { VideoResolution, VideoType } from '../types/index.js';
import { getCachedVideoResolution, cacheVideoResolution } from './redis.js';

const RESOLVE_TIMEOUT = 15000; // 15 seconds

// Known iframe embed domains
const IFRAME_DOMAINS = [
  'kodik.info',
  'kodik.cc',
  'anilibria.tv',
  'video.sibnet.ru',
  'ok.ru/videoembed',
  'vk.com/video_ext',
  'rutube.ru/play/embed',
  'dailymotion.com/embed',
];

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function detectVideoType(url: string): { type: VideoType; resolvedUrl: string; title?: string } | null {
  const lowerUrl = url.toLowerCase();

  // YouTube
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return { type: 'youtube', resolvedUrl: ytId };
  }

  // Direct HLS
  if (lowerUrl.includes('.m3u8')) {
    return { type: 'hls', resolvedUrl: url };
  }

  // Direct MP4/WebM
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.ogg')) {
    return { type: 'mp4', resolvedUrl: url };
  }

  // VK Video / Clips — convert to embed format
  // Matches: vk.com/video-123_456, vk.com/clip-123_456, vkvideo.ru/video-123_456, etc.
  const vkRegex = /(?:vk\.com|vkvideo\.ru)\/(?:(?:video|clip|.*z=video)(-?\d+)_(\d+))/;
  const vkMatch = url.match(vkRegex);
  if (vkMatch) {
    const oid = vkMatch[1];
    const id = vkMatch[2];
    const embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`;
    return { type: 'iframe', resolvedUrl: embedUrl };
  }

  // Known iframe domains
  for (const domain of IFRAME_DOMAINS) {
    if (lowerUrl.includes(domain)) {
      return { type: 'iframe', resolvedUrl: url };
    }
  }

  return null;
}

function runYtDlp(url: string): Promise<{ directUrl: string; title: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const args = ['--get-url', '-f', 'best', '--no-warnings', '-j', url];
    const proc = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('yt-dlp timed out'));
    }, RESOLVE_TIMEOUT);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // yt-dlp -j outputs JSON metadata, --get-url outputs direct URL
        // When using both, URL comes first, then JSON on separate lines
        const lines = stdout.trim().split('\n');

        let directUrl = '';
        let title = '';
        let ext = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{')) {
            try {
              const json = JSON.parse(trimmed);
              title = json.title || '';
              ext = json.ext || '';
              if (json.url) directUrl = json.url;
            } catch {
              // not valid JSON, might be a URL
            }
          } else if (trimmed.startsWith('http')) {
            directUrl = trimmed;
          }
        }

        if (!directUrl) {
          reject(new Error('yt-dlp returned no URL'));
          return;
        }

        resolve({ directUrl, title, ext });
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp output: ${err}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

export async function resolveVideo(url: string): Promise<VideoResolution> {
  // Check cache first
  const cachedRaw = await getCachedVideoResolution(url);
  if (cachedRaw) {
    try {
      const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw as unknown as VideoResolution;
      
      // If it's a VK link but the cached version isn't the proper embed, skip cache
      const isVk = url.includes('vk.com') || url.includes('vkvideo.ru');
      const isProperEmbed = cached.type === 'iframe' && cached.resolvedUrl.includes('video_ext.php');
      
      if (!isVk || isProperEmbed) {
        return cached;
      }
    } catch {
      // Cache corrupted, continue with resolution
    }
  }

  // Quick detection without yt-dlp
  const quick = detectVideoType(url);
  if (quick) {
    const result: VideoResolution = {
      type: quick.type,
      resolvedUrl: quick.resolvedUrl,
      originalUrl: url,
      title: quick.title,
    };
    await cacheVideoResolution(url, JSON.stringify(result));
    return result;
  }

  // Try yt-dlp
  try {
    const { directUrl, title, ext } = await runYtDlp(url);

    let type: VideoType = 'mp4';
    if (directUrl.includes('.m3u8') || ext === 'm3u8') {
      type = 'hls';
    } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
      type = 'mp4';
    }

    const result: VideoResolution = {
      type,
      resolvedUrl: directUrl,
      originalUrl: url,
      title,
    };
    await cacheVideoResolution(url, JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn(`[VideoResolver] yt-dlp failed for ${url}:`, err);
    // Fallback: try as iframe embed
    return {
      type: 'iframe',
      resolvedUrl: url,
      originalUrl: url,
    };
  }
}
