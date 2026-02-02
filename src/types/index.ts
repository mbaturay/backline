/**
 * Core data types for the Artist Journey visualization
 *
 * The data model separates:
 * - CreditRow: Individual release credits (used for timeline)
 * - Node/Link: Graph representation (used for network visualization)
 *
 * Network nodes are COLLABORATORS (artists/bands), not releases.
 * This keeps the graph manageable and tells a clearer story about
 * working relationships over time.
 */

export type NodeType = 'artist' | 'band' | 'release' | 'label';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  yearRange?: [number, number];
  creditCount: number;
  meta?: {
    genres?: string[];
    styles?: string[];
    discogsId?: number;
  };
  // D3 simulation properties (added at runtime)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export type LinkKind = 'played_on' | 'member_of' | 'released_on_label';

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: LinkKind;
  roles?: string[];
  weight: number;
  years: number[];
}

export interface CreditRow {
  year: number | null;
  releaseId: string;
  releaseTitle: string;
  primaryArtist: string;
  primaryArtistId: string;
  roles: string[];
  labels: string[];
  genres: string[];
  styles: string[];
  discogsUrl: string;
  isBand: boolean;
}

export interface ArtistInfo {
  name: string;
  discogsArtistId: number;
  profile?: string;
  imageUrl?: string;
}

export interface NormalizedData {
  artist: ArtistInfo;
  credits: CreditRow[];
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  stats: {
    totalCredits: number;
    yearMin: number | null;
    yearMax: number | null;
    topCollaborators: Array<{ name: string; count: number }>;
  };
  fetchedAt: string;
}

// Filter state for the UI
export interface FilterState {
  yearRange: [number, number] | null;
  roles: string[];
  types: ('band' | 'session')[];
  searchQuery: string;
  selectedCollaborator: string | null;
}

// Discogs API response types
export namespace DiscogsAPI {
  export interface SearchResult {
    id: number;
    type: string;
    title: string;
    thumb: string;
    cover_image: string;
    resource_url: string;
    uri: string;
  }

  export interface SearchResponse {
    pagination: Pagination;
    results: SearchResult[];
  }

  export interface Pagination {
    page: number;
    pages: number;
    per_page: number;
    items: number;
    urls: {
      first?: string;
      last?: string;
      prev?: string;
      next?: string;
    };
  }

  export interface Artist {
    id: number;
    name: string;
    realname?: string;
    profile?: string;
    releases_url: string;
    uri: string;
    urls?: string[];
    images?: Array<{
      type: string;
      uri: string;
      resource_url: string;
      uri150: string;
      width: number;
      height: number;
    }>;
  }

  export interface ArtistRelease {
    id: number;
    title: string;
    type: string;
    main_release?: number;
    artist: string;
    role: string;
    resource_url: string;
    year?: number;
    thumb: string;
    stats?: {
      community: {
        in_wantlist: number;
        in_collection: number;
      };
    };
  }

  export interface ArtistReleasesResponse {
    pagination: Pagination;
    releases: ArtistRelease[];
  }

  export interface ReleaseArtist {
    id: number;
    name: string;
    anv: string;
    join: string;
    role: string;
    tracks: string;
    resource_url: string;
  }

  export interface Release {
    id: number;
    title: string;
    artists: ReleaseArtist[];
    extraartists?: ReleaseArtist[];
    labels?: Array<{
      id: number;
      name: string;
      catno: string;
      resource_url: string;
    }>;
    year?: number;
    genres?: string[];
    styles?: string[];
    uri: string;
    resource_url: string;
    master_id?: number;
    master_url?: string;
    images?: Array<{
      type: string;
      uri: string;
      resource_url: string;
      uri150: string;
      width: number;
      height: number;
    }>;
  }
}
