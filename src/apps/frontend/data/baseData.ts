// Tipos del modelo compartido y contenedores vacíos. Todo el catálogo real
// llega ahora de la API de Jellyfin (ver `src/api/jellyfin.ts`).

export type Rating = { imdb: number; rt: number; age: string };
export type CastMember = { name: string; role: string; photo?: string | null };

export type Episode = {
  n: number;
  title?: string;
  date?: string;
  runtime?: number;
  synopsis?: string;
  thumb?: string;
  thumbHD?: string;
  watched: number;
  current?: boolean;
  jfId?: string;       // ID real del item en Jellyfin
  // Datos técnicos reales del fichero (MediaSources de Jellyfin).
  video?: string;      // p. ej. "1080p · H264 · SDR"
  audio?: string;      // p. ej. "5.1 EAC3 · 15 idiomas"
  subtitles?: string;  // p. ej. "60 pistas · 32 idiomas"
  container?: string;  // mkv, mp4…
};

export type Season = {
  n: number;
  year?: number | string;
  total: number;
  watched: number;
  synopsis?: string;
  backdrop?: string;
  episodes: Episode[];
};

export type Show = {
  id: string;
  title: string;
  year: number;
  runtime: string;
  rating: Rating;
  genres: string[];
  creator: string;
  directors: string;
  studio: string;
  country: string;
  premiere: string;
  status: string;
  cast: CastMember[];
  synopsis: string;
  defaultSeason: number;
  cont: { seasonN: number; epN: number; progress: number; remaining: string };
  seasons: Season[];
  backdrop?: string;
  backdrops?: string[];   // Todos los backdrops (para rotación en el hero).
  poster?: string;
  logo?: string | null;
};

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: string;
  rating: Rating;
  genres: string[];
  director: string;
  studio: string;
  country: string;
  premiere: string;
  cast: CastMember[];
  synopsis: string;
  watched?: number;
  remaining?: string;
  backdrop?: string;
  poster?: string;
  logo?: string | null;
};

export type CarouselSlide = {
  type: 'continue' | 'new';
  id: string;
  kind: string;
  title: string;
  season: number | null;
  episode: number | null;
  episodeTitle: string;
  year: number;
  progress: number | null;
  remaining: string;
  backdrop: string;
  poster: string;
  logo?: string | null;
};

export type ProtoData = {
  shows: Record<string, Show>;
  movies: Record<string, Movie>;
  carousel: CarouselSlide[];
};

export const baseData: ProtoData = {
  shows: {},
  movies: {},
  carousel: [],
};

export const findSeason = (show: Show | undefined, seasonN: number | string): Season | null => {
  if (!show?.seasons) return null;
  return show.seasons.find((s) => s.n === Number(seasonN)) || null;
};
