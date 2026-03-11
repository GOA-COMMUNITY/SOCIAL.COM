const fs = require('fs');

const API_KEY = 'AIzaSyDGHXHuPiHAfJGin_c2-LF4FZ5IBMYLNK4';
const MAX_SHORTS_PER_CHANNEL = 20;
const SHORTS_MAX_DURATION = 70;

const channels = [
  { id: 'UCZ8yT-EnZneKIlJX7SgxzLQ', name: 'Channel 1', icon: '🎬' },
  { id: 'UC-i0Rvr1-JtE2A8Z5RuVatg', name: 'Channel 2', icon: '🎥' }
];

function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const minutes = parseInt(match[1] || '0', 10);
  const seconds = parseInt(match[2] || '0', 10);
  return minutes * 60 + seconds;
}

async function getChannelUploadsPlaylistId(channelId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  } catch {
    return null;
  }
}

async function getPlaylistVideos(playlistId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function getVideoDetails(videoIds) {
  if (!videoIds.length) return [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function main() {
  const allVideos = [];

  for (const channel of channels) {
    console.log(`Processing channel: ${channel.name}`);
    const uploadsId = await getChannelUploadsPlaylistId(channel.id);
    if (!uploadsId) {
      console.warn(`No uploads playlist for ${channel.name}, skipping.`);
      continue;
    }

    const playlistItems = await getPlaylistVideos(uploadsId);
    if (!playlistItems.length) {
      console.warn(`No playlist items for ${channel.name}, skipping.`);
      continue;
    }

    const videoIds = playlistItems.map(item => item.snippet?.resourceId?.videoId).filter(Boolean);
    const details = await getVideoDetails(videoIds);

    const shorts = details
      .filter(video => {
        const duration = video.contentDetails?.duration;
        if (!duration) return false;
        const seconds = parseDuration(duration);
        return seconds <= SHORTS_MAX_DURATION && seconds > 0;
      })
      .slice(0, MAX_SHORTS_PER_CHANNEL)
      .map(video => {
        const item = playlistItems.find(i => i.snippet?.resourceId?.videoId === video.id);
        return {
          videoId: video.id,
          channelName: channel.name,
          channelIcon: channel.icon
        };
      });

    allVideos.push(...shorts);
  }

  allVideos.sort(() => Math.random() - 0.5);
  fs.writeFileSync('videos.json', JSON.stringify(allVideos, null, 2));
  console.log(`✅ videos.json created with ${allVideos.length} shorts.`);
}

main().catch(err => {
  console.error('Fatal error in generate.js:', err);
  fs.writeFileSync('videos.json', JSON.stringify([], null, 2));
  process.exit(1);
});
