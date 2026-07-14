// Cliente Jellyfin. Antes usaba `fetch` directo con headers MediaBrowser;
// ahora delega en el ApiClient oficial de jellyfin-web (ServerConnections).
// La superficie pública se mantiene intacta para no tocar el resto de la app.

import { ServerConnections, ConnectionState } from 'lib/jellyfin-apiclient';
import { loadSession, setSessionDisplayName } from '../auth/session';
import type { Show, Season, Episode, CastMember } from '../data/baseData';

// Headers de autenticación estilo MediaBrowser. Los toma del ApiClient oficial
// para heredar clientName/version/deviceId — así el servidor ve una sesión
// coherente con el resto de jellyfin-web.
function authHeader(accessToken?: string): string {
    const apiClient = ServerConnections.currentApiClient?.();
    const parts = [
        `MediaBrowser Client="${apiClient?.appName?.() ?? 'jellyfin-web'}"`,
        `Device="${apiClient?.deviceName?.() ?? 'Web'}"`,
        `DeviceId="${apiClient?.deviceId?.() ?? ''}"`,
        `Version="${apiClient?.appVersion?.() ?? '1.0.0'}"`
    ];
    if (accessToken) parts.push(`Token="${accessToken}"`);
    return parts.join(', ');
}

export type AuthResult = {
    accessToken: string;
    userId: string;
    serverId: string;
    displayName: string;
};

export function normalizeServerUrl(u: string): string {
    const trimmed = u.trim().replace(/\/$/, '');
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function trimSlash(u: string): string {
    return u.replace(/\/$/, '');
}

// Login vía ConnectionManager oficial: primero contactamos el servidor
// (connectToAddress) para que quede registrado como ApiClient local, y luego
// autenticamos al usuario. El AccessToken queda accesible a través de
// ServerConnections.currentApiClient() para el resto de la app.
export async function authenticate(
    serverUrl: string,
    username: string,
    password: string
): Promise<AuthResult> {
    const base = normalizeServerUrl(serverUrl);
    let connection;
    try {
        connection = await ServerConnections.connectToAddress(base);
    } catch {
        throw new Error(
            `No se pudo alcanzar ${base}. Comprueba que el servidor está corriendo y la URL es correcta.`
        );
    }
    if (!connection || connection.State === ConnectionState.Unavailable) {
        throw new Error(`No se pudo alcanzar ${base}.`);
    }
    const apiClient = connection.ApiClient ?? ServerConnections.currentApiClient?.();
    if (!apiClient) throw new Error('No hay ApiClient disponible tras conectar.');

    let auth;
    try {
        auth = await apiClient.authenticateUserByName(username, password);
    } catch (err: any) {
        throw new Error(
            err?.status === 401
                ? 'Usuario o contraseña incorrectos'
                : `Error del servidor (${err?.status ?? '?'})`
        );
    }
    const displayName = auth?.User?.Name ?? username;
    setSessionDisplayName(displayName);
    return {
        accessToken: auth.AccessToken,
        userId: auth.User.Id,
        serverId: auth.ServerId,
        displayName
    };
}

async function apiFetch<T>(path: string): Promise<T> {
  const session = loadSession();
  if (!session?.accessToken || !session.userId) {
    throw new Error('Sin sesión activa');
  }
  const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
    headers: {
      'Authorization': authHeader(session.accessToken),
      'X-Emby-Authorization': authHeader(session.accessToken),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → HTTP ${res.status}`);
  return res.json();
}

type ImageType = 'Primary' | 'Backdrop' | 'Logo' | 'Thumb';

export function imageUrl(
  itemId: string | undefined,
  type: ImageType,
  opts: { tag?: string; maxHeight?: number; maxWidth?: number; index?: number } = {},
): string | undefined {
  if (!itemId) return undefined;
  const session = loadSession();
  if (!session?.serverUrl) return undefined;
  const q = new URLSearchParams();
  if (opts.tag) q.set('tag', opts.tag);
  if (opts.maxHeight) q.set('maxHeight', String(opts.maxHeight));
  if (opts.maxWidth) q.set('maxWidth', String(opts.maxWidth));
  const qs = q.toString();
  // Sin index → apunta al Primary/Backdrop/… "por defecto" (índice 0). Con
  // index → selecciona ese específico (necesario para múltiples backdrops).
  const path = opts.index != null ? `${type}/${opts.index}` : type;
  return `${trimSlash(session.serverUrl)}/Items/${itemId}/Images/${path}${qs ? '?' + qs : ''}`;
}

// -------- Modelo Jellyfin (subset) --------
type JFMediaStream = {
  Type: 'Video' | 'Audio' | 'Subtitle';
  Codec?: string;
  Width?: number;
  Height?: number;
  VideoRangeType?: string;
  ChannelLayout?: string;
  Channels?: number;
  Language?: string;
  Title?: string;
  DisplayTitle?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
};

type JFMediaSource = {
  Container?: string;
  Size?: number;
  MediaStreams?: JFMediaStream[];
};

type JFItem = {
  Id: string;
  Name: string;
  IndexNumber?: number;
  ProductionYear?: number;
  Overview?: string;
  Genres?: string[];
  Studios?: { Name: string }[];
  People?: {
    Name: string; Role?: string; Type: string; Id?: string; PrimaryImageTag?: string;
  }[];
  CommunityRating?: number;
  OfficialRating?: string;
  Taglines?: string[];
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  RunTimeTicks?: number;
  PremiereDate?: string;
  EndDate?: string;
  Status?: string;
  Container?: string;
  MediaSources?: JFMediaSource[];
  UserData?: { Played?: boolean; PlayedPercentage?: number; PlaybackPositionTicks?: number };
};

const ticksToMinutes = (ticks?: number) =>
  ticks ? Math.round(ticks / 10_000_000 / 60) : undefined;

function mapCast(item: JFItem): CastMember[] {
  return (item.People ?? [])
    .filter((p) => p.Type === 'Actor')
    .slice(0, 14)
    .map((p) => ({
      name: p.Name,
      role: p.Role || '',
      photo: p.PrimaryImageTag && p.Id
        ? imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: 320 })
        : null,
    }));
}

function mapShow(item: JFItem): Show {
  const runtimeMin = ticksToMinutes(item.RunTimeTicks);
  const backdrops = (item.BackdropImageTags ?? []).map((tag, i) =>
    imageUrl(item.Id, 'Backdrop', { tag, maxWidth: 2560, index: i }) ?? '',
  ).filter(Boolean);
  return {
    id: item.Id,
    title: item.Name,
    year: item.ProductionYear ?? 0,
    runtime: runtimeMin ? `${runtimeMin} min` : '—',
    rating: {
      imdb: item.CommunityRating ?? 0,
      rt: 0,
      age: item.OfficialRating ?? 'N/A',
    },
    genres: item.Genres ?? [],
    creator: '',
    directors: '',
    studio: item.Studios?.[0]?.Name ?? '',
    country: '',
    premiere: item.PremiereDate ?? '',
    status: item.Status ?? '',
    cast: mapCast(item),
    synopsis: item.Overview ?? '',
    defaultSeason: 1,
    cont: { seasonN: 1, epN: 1, progress: 0, remaining: '' },
    seasons: [],
    backdrop: backdrops[0] ?? '',
    backdrops,
    poster: imageUrl(item.Id, 'Primary', { maxHeight: 900 }) ?? '',
    logo: item.ImageTags?.Logo
      ? imageUrl(item.Id, 'Logo', { tag: item.ImageTags.Logo, maxHeight: 400 }) ?? null
      : null,
  };
}

// Convierte alto en píxeles al label habitual: 480p, 720p, 1080p, 2160p (4K).
function resolutionLabel(height?: number, width?: number): string | undefined {
  const h = height ?? 0;
  if (h >= 4300) return '4320p';
  if (h >= 2100) return '2160p';
  if (h >= 1400) return '1440p';
  if (h >= 1030) return '1080p';
  if (h >= 690) return '720p';
  if (h >= 460) return '480p';
  if (width && width >= 1900) return '1080p';
  return undefined;
}

// Nombres humanos para códecs de audio comunes.
const AUDIO_CODEC_NAMES: Record<string, string> = {
  eac3: 'Dolby Digital+',
  ac3: 'Dolby Digital',
  truehd: 'TrueHD',
  dts: 'DTS',
  'dts-hd': 'DTS-HD',
  aac: 'AAC',
  opus: 'Opus',
  flac: 'FLAC',
  mp3: 'MP3',
};

function summarizeVideo(streams: JFMediaStream[] = []): string | undefined {
  const video = streams.find((s) => s.Type === 'Video');
  if (!video) return undefined;
  const parts: string[] = [];
  const res = resolutionLabel(video.Height, video.Width);
  if (res) parts.push(res);
  if (video.Codec) parts.push(video.Codec.toUpperCase());
  const range = video.VideoRangeType && video.VideoRangeType !== 'Unknown'
    ? video.VideoRangeType : undefined;
  if (range) parts.push(range);
  return parts.length ? parts.join(' · ') : undefined;
}

function summarizeAudio(streams: JFMediaStream[] = []): string | undefined {
  const tracks = streams.filter((s) => s.Type === 'Audio');
  if (tracks.length === 0) return undefined;
  const primary = tracks.find((s) => s.IsDefault) ?? tracks[0];
  const parts: string[] = [];
  if (primary.ChannelLayout) parts.push(primary.ChannelLayout);
  else if (primary.Channels) parts.push(`${primary.Channels} canales`);
  if (primary.Codec) {
    const key = primary.Codec.toLowerCase();
    parts.push(AUDIO_CODEC_NAMES[key] ?? primary.Codec.toUpperCase());
  }
  const langs = new Set(
    tracks.map((s) => s.Language).filter((l): l is string => !!l && l !== 'und'),
  );
  if (langs.size > 1) parts.push(`${langs.size} idiomas`);
  return parts.length ? parts.join(' · ') : undefined;
}

function summarizeSubtitles(streams: JFMediaStream[] = []): string | undefined {
  const subs = streams.filter((s) => s.Type === 'Subtitle');
  if (subs.length === 0) return undefined;
  const langs = new Set(
    subs.map((s) => s.Language).filter((l): l is string => !!l && l !== 'und'),
  );
  const parts = [`${subs.length} pistas`];
  if (langs.size > 0) parts.push(`${langs.size} idiomas`);
  return parts.join(' · ');
}

function mapEpisode(item: JFItem): Episode {
  const played = item.UserData?.Played ?? false;
  const pct = item.UserData?.PlayedPercentage;
  const watched = played ? 1 : pct != null ? pct / 100 : 0;
  const source = item.MediaSources?.[0];
  const streams = source?.MediaStreams ?? [];
  return {
    n: item.IndexNumber ?? 0,
    title: item.Name,
    date: item.PremiereDate,
    runtime: ticksToMinutes(item.RunTimeTicks),
    synopsis: item.Overview,
    thumb: imageUrl(item.Id, 'Primary', { maxWidth: 720 }),
    thumbHD: imageUrl(item.Id, 'Primary', { maxWidth: 1920 }),
    watched,
    jfId: item.Id,
    video: summarizeVideo(streams),
    audio: summarizeAudio(streams),
    subtitles: summarizeSubtitles(streams),
    container: source?.Container ?? item.Container,
  };
}

const FIELDS_LIST =
  'Overview,Genres,ProductionYear,Studios,CommunityRating,OfficialRating,ImageTags,BackdropImageTags,RunTimeTicks,PremiereDate';
const FIELDS_DETAIL = `${FIELDS_LIST},People,Taglines,EndDate,Status`;

export async function getShows(): Promise<Show[]> {
  const session = loadSession();
  if (!session?.userId) throw new Error('Sin sesión');
  const data = await apiFetch<{ Items: JFItem[] }>(
    `/Users/${session.userId}/Items?IncludeItemTypes=Series&Recursive=true&SortBy=SortName&Fields=${FIELDS_LIST}`,
  );
  return (data.Items ?? []).map(mapShow);
}

// Caché sencilla en memoria para que ShowPage → SeasonPage → EpisodePage
// no re-peticionen la misma serie al navegar. Se invalida en logout desde
// la SessionProvider (ver clearShowCache más abajo).
const showCache = new Map<string, Promise<Show>>();

export async function getShow(id: string): Promise<Show> {
  const cached = showCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const item = await apiFetch<JFItem>(
      `/Users/${session.userId}/Items/${id}?Fields=${FIELDS_DETAIL}`,
    );
    const show = mapShow(item);
    show.seasons = await getSeasonsWithEpisodes(id);
    const firstIncomplete = show.seasons
      .flatMap((s) => s.episodes.map((e) => ({ s, e })))
      .find(({ e }) => e.watched < 1);
    if (firstIncomplete) {
      show.cont = {
        seasonN: firstIncomplete.s.n,
        epN: firstIncomplete.e.n,
        progress: firstIncomplete.e.watched,
        remaining: '',
      };
      show.defaultSeason = firstIncomplete.s.n;
    }
    return show;
  })();
  showCache.set(id, p);
  p.catch(() => showCache.delete(id));
  return p;
}

export function clearShowCache(): void {
  showCache.clear();
}

async function getSeasonsWithEpisodes(showId: string): Promise<Season[]> {
  const session = loadSession();
  if (!session?.userId) throw new Error('Sin sesión');
  const seasonData = await apiFetch<{ Items: JFItem[] }>(
    `/Shows/${showId}/Seasons?userId=${session.userId}&Fields=Overview,ImageTags`,
  );
  const seasons: Season[] = [];
  for (const s of seasonData.Items ?? []) {
    if (typeof s.IndexNumber !== 'number') continue;
    const epData = await apiFetch<{ Items: JFItem[] }>(
      `/Shows/${showId}/Episodes?userId=${session.userId}&seasonId=${s.Id}&Fields=Overview,ImageTags,RunTimeTicks,PremiereDate,MediaSources,MediaStreams`,
    );
    const eps = (epData.Items ?? []).map(mapEpisode).sort((a, b) => a.n - b.n);
    seasons.push({
      n: s.IndexNumber,
      year: s.ProductionYear,
      total: eps.length,
      watched: eps.filter((e) => e.watched >= 1).length,
      synopsis: s.Overview,
      // Las temporadas suelen tener póster propio (Primary) y no backdrop;
      // usamos el póster como imagen de fondo de la SeasonCard.
      backdrop: imageUrl(s.Id, 'Primary', { maxHeight: 900 }),
      episodes: eps,
    });
  }
  seasons.sort((a, b) => a.n - b.n);
  return seasons;
}

// -------- Reproducción / streaming --------

export type PlaybackDecision = {
  kind: 'direct' | 'hls';
  url: string;             // URL absoluta lista para <video src> o hls.js
  playSessionId?: string;  // Necesario para el stop en modo transcode
  container?: string;
  mediaSourceId: string;
  audioStreams: MediaStreamInfo[];
  subtitleStreams: MediaStreamInfo[];
  activeAudioIndex?: number;
  activeSubtitleIndex?: number;
};

export type MediaStreamInfo = {
  index: number;
  language?: string;
  displayTitle: string;
  isDefault: boolean;
  isForced?: boolean;
  isText: boolean;   // Solo para subs: si es texto (vtt/srt/ass) o gráfico (pgs)
  codec?: string;
};

// Perfil de dispositivo que enviamos a Jellyfin: le decimos qué contenedores/
// códecs puede decodificar el navegador. Con esto el servidor decide si nos
// puede servir el fichero directo (DirectPlay), un remux (DirectStream) o
// transcode completo (HLS). Es el mismo perfil que usa la web oficial.
function browserDeviceProfile() {
  return {
    MaxStreamingBitrate: 20_000_000,
    MaxStaticBitrate:    20_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: [
      { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,vp9,av1', AudioCodec: 'aac,mp3,opus' },
      { Container: 'webm',    Type: 'Video', VideoCodec: 'vp9,av1',      AudioCodec: 'opus,vorbis' },
    ],
    TranscodingProfiles: [
      {
        Container: 'mp4', Type: 'Video',
        VideoCodec: 'h264', AudioCodec: 'aac',
        Protocol: 'hls', Context: 'Streaming',
        MaxAudioChannels: '2', MinSegments: 2,
        BreakOnNonKeyFrames: true,
      },
    ],
    CodecProfiles: [],
    ContainerProfiles: [],
    SubtitleProfiles: [
      { Format: 'vtt', Method: 'External' },
    ],
  };
}

function isTextSubtitle(codec?: string): boolean {
  if (!codec) return false;
  const c = codec.toLowerCase();
  return c === 'subrip' || c === 'srt' || c === 'ass' || c === 'ssa' || c === 'vtt' || c === 'webvtt';
}

function mapMediaStream(s: any): MediaStreamInfo {
  return {
    index: s.Index,
    language: s.Language,
    displayTitle: s.DisplayTitle ?? s.Title ?? s.Language ?? `#${s.Index}`,
    isDefault: !!s.IsDefault,
    isForced: !!s.IsForced,
    isText: s.Type === 'Subtitle' && isTextSubtitle(s.Codec),
    codec: s.Codec,
  };
}

export async function getPlaybackDecision(
  itemId: string,
  opts: {
    startTicks?: number;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
  } = {},
): Promise<PlaybackDecision> {
  const session = loadSession();
  if (!session?.accessToken || !session?.userId) throw new Error('Sin sesión');
  const q = new URLSearchParams({ userId: session.userId });
  if (opts.startTicks) q.set('startTimeTicks', String(opts.startTicks));
  if (opts.audioStreamIndex != null) q.set('audioStreamIndex', String(opts.audioStreamIndex));
  if (opts.subtitleStreamIndex != null) q.set('subtitleStreamIndex', String(opts.subtitleStreamIndex));
  const res = await apiSend(
    `/Items/${itemId}/PlaybackInfo?${q.toString()}`,
    'POST',
    { DeviceProfile: browserDeviceProfile() },
  );
  const data = await res.json();
  const src = (data.MediaSources ?? [])[0];
  if (!src) throw new Error('Sin fuentes reproducibles');
  const server = trimSlash(session.serverUrl);
  const streams: any[] = src.MediaStreams ?? [];
  const audioStreams   = streams.filter((s) => s.Type === 'Audio').map(mapMediaStream);
  const subtitleStreams = streams.filter((s) => s.Type === 'Subtitle').map(mapMediaStream);
  const activeAudioIndex    = src.DefaultAudioStreamIndex ?? opts.audioStreamIndex;
  const activeSubtitleIndex = src.DefaultSubtitleStreamIndex ?? opts.subtitleStreamIndex;

  const common = {
    playSessionId: data.PlaySessionId,
    mediaSourceId: src.Id,
    audioStreams, subtitleStreams,
    activeAudioIndex, activeSubtitleIndex,
  };
  if (src.SupportsDirectPlay || src.SupportsDirectStream) {
    const params = new URLSearchParams({
      api_key: session.accessToken,
      Static: 'true',
      MediaSourceId: src.Id,
    });
    if (opts.startTicks) params.set('startTimeTicks', String(opts.startTicks));
    return {
      kind: 'direct',
      url: `${server}/Videos/${itemId}/stream?${params.toString()}`,
      container: src.Container,
      ...common,
    };
  }
  if (src.SupportsTranscoding && src.TranscodingUrl) {
    const rel = src.TranscodingUrl.startsWith('/') ? src.TranscodingUrl : '/' + src.TranscodingUrl;
    return {
      kind: 'hls',
      url: `${server}${rel}`,
      container: src.TranscodingContainer,
      ...common,
    };
  }
  throw new Error('El servidor no puede reproducir este item');
}

// URL WebVTT para un stream de subtítulos textual. Se adjunta como <track>
// del <video> y el navegador lo pinta con controles nativos.
export function subtitleVttUrl(
  itemId: string, mediaSourceId: string, streamIndex: number,
): string {
  const session = loadSession();
  if (!session?.accessToken) return '';
  return `${trimSlash(session.serverUrl)}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.vtt?api_key=${session.accessToken}`;
}

// Reporting: Jellyfin usa esto para mantener "continuar viendo", marcar como
// visto al 90%, y actualizar la última fecha de visionado. No es obligatorio
// pero sin esto no se actualizan los contadores.
export async function reportPlaybackStart(itemId: string): Promise<void> {
  try {
    await apiSend('/Sessions/Playing', 'POST', {
      ItemId: itemId,
      PlayMethod: 'Transcode',
      CanSeek: true,
    });
  } catch { /* no bloquea la reproducción */ }
}

export async function reportPlaybackProgress(
  itemId: string, positionTicks: number, isPaused: boolean,
): Promise<void> {
  try {
    await apiSend('/Sessions/Playing/Progress', 'POST', {
      ItemId: itemId,
      PositionTicks: positionTicks,
      IsPaused: isPaused,
      PlayMethod: 'Transcode',
      CanSeek: true,
    });
  } catch { /* silencio */ }
}

export async function reportPlaybackStop(
  itemId: string, positionTicks: number, playSessionId?: string,
): Promise<void> {
  try {
    await apiSend('/Sessions/Playing/Stopped', 'POST', {
      ItemId: itemId,
      PositionTicks: positionTicks,
      PlaySessionId: playSessionId,
    });
    if (playSessionId) {
      // Le decimos al servidor que puede liberar el proceso de ffmpeg.
      await apiSend(`/Videos/ActiveEncodings?deviceId=${encodeURIComponent(getDeviceId())}&playSessionId=${playSessionId}`, 'DELETE').catch(() => {});
    }
    showCache.delete(itemId);
  } catch { /* silencio */ }
}

function getDeviceId(): string {
  const KEY = 'jfp-device-id';
  return localStorage.getItem(KEY) ?? '';
}

// -------- Acciones directas sobre items (menu de "más opciones") --------

async function apiSend(
  path: string, method: 'POST' | 'DELETE' | 'PUT',
  body?: unknown,
): Promise<Response> {
  const session = loadSession();
  if (!session?.accessToken) throw new Error('Sin sesión');
  const headers: Record<string, string> = {
    'Authorization': authHeader(session.accessToken),
    'X-Emby-Authorization': authHeader(session.accessToken),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}`);
  return res;
}

export async function markPlayed(itemId: string, played: boolean): Promise<void> {
  const session = loadSession();
  if (!session?.userId) throw new Error('Sin sesión');
  await apiSend(
    `/Users/${session.userId}/PlayedItems/${itemId}`,
    played ? 'POST' : 'DELETE',
  );
  showCache.delete(itemId);
}

export async function toggleFavorite(itemId: string, favorite: boolean): Promise<void> {
  const session = loadSession();
  if (!session?.userId) throw new Error('Sin sesión');
  await apiSend(
    `/Users/${session.userId}/FavoriteItems/${itemId}`,
    favorite ? 'POST' : 'DELETE',
  );
  showCache.delete(itemId);
}

export async function refreshItemMetadata(itemId: string): Promise<void> {
  await apiSend(
    `/Items/${itemId}/Refresh?metadataRefreshMode=FullRefresh&imageRefreshMode=FullRefresh&replaceAllMetadata=false&replaceAllImages=false`,
    'POST',
  );
}

export async function deleteItem(itemId: string): Promise<void> {
  await apiSend(`/Items/${itemId}`, 'DELETE');
  showCache.delete(itemId);
}

export function downloadUrl(itemId: string): string {
  const session = loadSession();
  if (!session?.accessToken) return '';
  return `${trimSlash(session.serverUrl)}/Items/${itemId}/Download?api_key=${encodeURIComponent(session.accessToken)}`;
}

// Enlace canónico al item dentro del web player nativo (para "Reproducir",
// "Compartir", "Añadir a lista de reproducción" y demás cosas que necesitan
// una superficie UI que aquí todavía no tenemos).
export function nativeItemUrl(itemId: string): string {
  const session = loadSession();
  if (!session?.serverUrl) return '';
  const server = session.serverId ? `&serverId=${session.serverId}` : '';
  return `${trimSlash(session.serverUrl)}/web/#/details?id=${itemId}${server}`;
}

// -------- Editor de metadatos / identificar / imágenes / subtítulos --------

export type ItemMetadataPatch = {
  Name?: string;
  OriginalTitle?: string;
  ProductionYear?: number | null;
  Overview?: string;
  Taglines?: string[];
  Genres?: string[];
  OfficialRating?: string;
};

export async function getItemRaw(itemId: string): Promise<any> {
  const session = loadSession();
  if (!session?.userId) throw new Error('Sin sesión');
  return apiFetch<any>(`/Users/${session.userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,ProductionYear,OfficialRating,OriginalTitle,ProviderIds`);
}

export async function updateItemMetadata(itemId: string, patch: ItemMetadataPatch): Promise<void> {
  const current = await getItemRaw(itemId);
  const merged = { ...current, ...patch };
  await apiSend(`/Items/${itemId}`, 'POST', merged);
  showCache.delete(itemId);
}

// Search en proveedores remotos (TMDB/TVDB) para "Identificar…".
export type RemoteSearchResult = {
  Name: string;
  ProductionYear?: number;
  Overview?: string;
  ImageUrl?: string;
  SearchProviderName?: string;
  ProviderIds?: Record<string, string>;
};

export async function remoteSearch(
  itemId: string, itemType: 'Movie' | 'Series' | 'Episode',
  query?: { name?: string; year?: number },
): Promise<RemoteSearchResult[]> {
  const raw = await getItemRaw(itemId);
  const body = {
    ItemId: itemId,
    SearchInfo: {
      Name: query?.name ?? raw.Name,
      Year: query?.year ?? raw.ProductionYear,
      ProviderIds: raw.ProviderIds ?? {},
    },
  };
  const res = await apiSend(`/Items/RemoteSearch/${itemType}`, 'POST', body);
  return res.json();
}

export async function applyRemoteSearchResult(
  itemId: string, result: RemoteSearchResult,
): Promise<void> {
  await apiSend(`/Items/RemoteSearch/Apply/${itemId}?replaceAllImages=true`, 'POST', result);
  showCache.delete(itemId);
}

// Imágenes: subir por URL (POST con la URL como cuerpo) y borrar.
export async function setImageByUrl(
  itemId: string, type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb', url: string,
): Promise<void> {
  await apiSend(`/Items/${itemId}/RemoteImages/Download?Type=${type}&ImageUrl=${encodeURIComponent(url)}`, 'POST');
  showCache.delete(itemId);
}

export async function deleteImage(
  itemId: string, type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb', index = 0,
): Promise<void> {
  await apiSend(`/Items/${itemId}/Images/${type}/${index}`, 'DELETE');
  showCache.delete(itemId);
}

// Subir una imagen desde un File local (input type="file" o drag&drop).
// Jellyfin espera el body como base64 con el Content-Type de la imagen; el
// endpoint acepta jpg/png/webp/gif y detecta el formato por la cabecera.
export async function uploadImageFile(
  itemId: string,
  type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb',
  file: File,
): Promise<void> {
  const session = loadSession();
  if (!session?.accessToken) throw new Error('Sin sesión');
  const MAX_BYTES = 30 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error(`La imagen supera 30 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  const buf = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  const mime = file.type && /^image\//.test(file.type) ? file.type : 'image/jpeg';
  const res = await fetch(`${trimSlash(session.serverUrl)}/Items/${itemId}/Images/${type}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(session.accessToken),
      'X-Emby-Authorization': authHeader(session.accessToken),
      'Content-Type': mime,
    },
    body: base64,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload falló: HTTP ${res.status} ${text}`);
  }
  showCache.delete(itemId);
}

// Búsqueda de imágenes alternativas en los proveedores externos.
export type JFRemoteImage = {
  Url: string;
  ThumbnailUrl?: string;
  Height?: number;
  Width?: number;
  Language?: string;
  CommunityRating?: number;
  VoteCount?: number;
  ProviderName?: string;
  Type?: string;
};

export async function getRemoteImages(
  itemId: string,
  type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb',
  opts: { includeAllLanguages?: boolean; limit?: number } = {},
): Promise<{ images: JFRemoteImage[]; providers: string[] }> {
  const q = new URLSearchParams({
    type,
    startIndex: '0',
    limit: String(opts.limit ?? 60),
    includeAllLanguages: String(opts.includeAllLanguages ?? true),
  });
  const data = await apiFetch<{ Images: JFRemoteImage[]; Providers: string[] }>(
    `/Items/${itemId}/RemoteImages?${q.toString()}`,
  );
  return { images: data.Images ?? [], providers: data.Providers ?? [] };
}

// Lista de URLs de todos los backdrops del item (para rotación en el hero).
export function getItemBackdrops(
  itemId: string, tags: string[] = [],
): string[] {
  const session = loadSession();
  if (!session?.serverUrl) return [];
  const base = trimSlash(session.serverUrl);
  return tags.length > 0
    ? tags.map((tag, i) =>
        `${base}/Items/${itemId}/Images/Backdrop/${i}?tag=${tag}&maxWidth=2560`)
    : [`${base}/Items/${itemId}/Images/Backdrop/0?maxWidth=2560`];
}

// Base64 sin cargar todo el fichero como string. Chunkeamos porque el
// spread `String.fromCharCode(...bytes)` peta con arrays grandes.
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

// Subtítulos.
export type RemoteSubtitle = {
  Id: string;
  Name: string;
  Format?: string;
  Language?: string;
  ProviderName?: string;
  Comment?: string;
};

export async function searchSubtitles(
  itemId: string, language: string,
): Promise<RemoteSubtitle[]> {
  const res = await apiSend(`/Items/${itemId}/RemoteSearch/Subtitles/${language}`, 'POST', {});
  return res.json();
}

export async function downloadSubtitle(itemId: string, subtitleId: string): Promise<void> {
  await apiSend(`/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`, 'POST', {});
  showCache.delete(itemId);
}

// -------- Endpoints de administración --------

export type SystemInfo = {
  serverName: string;
  version: string;
  operatingSystem: string;
  id: string;
};

export async function getSystemInfo(): Promise<SystemInfo> {
  const data = await apiFetch<any>('/System/Info');
  return {
    serverName: data.ServerName ?? 'Jellyfin',
    version: data.Version ?? '',
    operatingSystem: data.OperatingSystem ?? '',
    id: data.Id ?? '',
  };
}

// Lanza un rescan de todas las bibliotecas (Panel → Biblioteca → Escanear).
// Es un POST sin body y devuelve 204.
export async function refreshLibrary(): Promise<void> {
  const session = loadSession();
  if (!session?.accessToken) throw new Error('Sin sesión');
  const res = await fetch(`${trimSlash(session.serverUrl)}/Library/Refresh`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(session.accessToken),
      'X-Emby-Authorization': authHeader(session.accessToken),
    },
  });
  if (!res.ok) throw new Error(`Refresh falló: HTTP ${res.status}`);
}

// URL absoluta al dashboard nativo de Jellyfin (para abrirlo en pestaña nueva).
export function dashboardUrl(): string {
  const session = loadSession();
  if (!session?.serverUrl) return '';
  return `${trimSlash(session.serverUrl)}/web/#/dashboard`;
}

// Endpoints todavía no implementados en modo real — mantenidos para no romper
// imports existentes que sí funcionan contra PROTO_DATA.
export async function getMovies(): Promise<never[]> { return []; }
export async function getMovie(_id: string): Promise<never> {
  throw new Error('Películas: pendiente');
}
export async function search(_q: string): Promise<never[]> { return []; }
