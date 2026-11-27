export interface User {
  id: string;
  email: string | null;
  displayName: string;
  role: 'user' | 'admin';
  avatarColor: string;
  telegramLinked: boolean;
  createdAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration: number;
  coverUrl: string | null;
  lyrics?: string | null;
  color: string;
  plays: number;
  published: boolean;
  createdAt: string;
  liked: boolean;
  owned: boolean;
  streamUrl: string;
}

export interface UserStats {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  progress: number;
  plays: number;
  likes: number;
  playlists: number;
  comments: number;
  followers: number;
  following: number;
  streak: number;
  rank: number;
  achievements: Array<{
    code: string;
    title: string;
    description: string;
    unlocked: boolean;
  }>;
}

export interface PublicProfile {
  user: User;
  stats: UserStats;
  isFollowing: boolean;
  isMe: boolean;
  topTracks: Track[];
}

export interface TrackComment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarColor: string };
}

export interface FeedItem {
  id: string;
  type: 'play' | 'comment';
  createdAt: string;
  user: { displayName: string; avatarColor: string };
  track: { id: string; title: string; artist: string };
  text: string | null;
}

export interface DailyMix {
  title: string;
  genre: string;
  tracks: Track[];
}

export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  hostName?: string;
  trackId: string | null;
  playing: boolean;
  position: number;
  members: number;
  track?: Track | null;
  updatedAt?: string;
  memberList?: Array<{ id: string; displayName: string; avatarColor: string }>;
}

export interface YearReview {
  year: number;
  plays: number;
  minutes: number;
  likes: number;
  topTracks: Track[];
  genres: Array<{ genre: string; total: number }>;
}

export interface Playlist {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  mine?: boolean;
  shared?: boolean;
}

export interface Genre {
  name: string;
  total: number;
}

export interface HomeData {
  featured: Track | null;
  newest: Track[];
  top: Track[];
  genres: Genre[];
  playlists: Playlist[];
  totalTracks: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  audience: 'all' | 'users' | 'admins';
  channels: string[];
  createdAt: string;
  readAt: string | null;
  sent: number;
  failed: number;
}

export interface AdminStats {
  totals: {
    users: number;
    admins: number;
    tracks: number;
    unpublished: number;
    plays: number;
    likes: number;
    playlists: number;
    subscribers: number;
    notifications: number;
    playsToday: number;
  };
  daily: Array<{ day: string; total: number }>;
  topTracks: Track[];
  recentUsers: Array<{
    id: string;
    displayName: string;
    email: string | null;
    role: string;
    banned: boolean;
    createdAt: string;
  }>;
  bot: { configured: boolean; live: boolean };
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string;
  role: 'user' | 'admin';
  banned: boolean;
  telegramLinked: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface SubscribersInfo {
  total: number;
  muted: number;
  recent: Array<{
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    created_at: string;
  }>;
  bot: { configured: boolean; live: boolean };
}
