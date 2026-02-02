/**
 * Discogs API Client
 *
 * Features:
 * - Rate limiting: Max 60 requests per minute (Discogs limit)
 * - Exponential backoff on 429 errors
 * - File-based caching for raw responses
 * - Automatic pagination handling
 */

import fs from 'fs/promises';
import path from 'path';
import type { DiscogsAPI } from '../src/types/index.js';

const BASE_URL = 'https://api.discogs.com';
const RATE_LIMIT_MS = 1100; // 1.1s between requests = ~54/min, staying under 60/min Discogs limit
const MAX_RETRIES = 5;
const CACHE_DIR = path.join(process.cwd(), 'data', 'raw');

let lastRequestTime = 0;
let requestCount = 0;

interface ClientOptions {
  token: string;
  useCache?: boolean;
  cacheDir?: string;
}

export class DiscogsClient {
  private token: string;
  private useCache: boolean;
  private cacheDir: string;

  constructor(options: ClientOptions) {
    this.token = options.token;
    this.useCache = options.useCache ?? true;
    this.cacheDir = options.cacheDir ?? CACHE_DIR;
  }

  /**
   * Rate-limited fetch with exponential backoff
   */
  private async rateLimitedFetch<T>(url: string, cacheKey?: string): Promise<T> {
    // Check cache first
    if (this.useCache && cacheKey) {
      const cached = await this.readCache<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        lastRequestTime = Date.now();
        requestCount++;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Discogs token=${this.token}`,
            'User-Agent': 'ArtistJourney/1.0 +https://github.com/example/artist-journey',
          },
        });

        if (response.status === 429) {
          // Rate limited - exponential backoff
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          console.log(`  [rate limited] Waiting ${waitTime}ms...`);
          await this.sleep(waitTime);
          attempt++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as T;

        // Save to cache
        if (this.useCache && cacheKey) {
          await this.writeCache(cacheKey, data);
        }

        return data;
      } catch (error) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          throw error;
        }
        const waitTime = Math.pow(2, attempt) * 500;
        console.log(`  [error] Retry ${attempt}/${MAX_RETRIES} after ${waitTime}ms...`);
        await this.sleep(waitTime);
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES} retries`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCachePath(key: string): string {
    // Sanitize key for filesystem - preserve some structure
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const cachePath = this.getCachePath(key);
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  private async writeCache<T>(key: string, data: T): Promise<void> {
    try {
      const cachePath = this.getCachePath(key);
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn(`  [cache write failed] ${key}:`, error);
    }
  }

  getRequestCount(): number {
    return requestCount;
  }

  /**
   * Search for an artist by name
   */
  async searchArtist(name: string): Promise<DiscogsAPI.SearchResult[]> {
    const url = `${BASE_URL}/database/search?q=${encodeURIComponent(name)}&type=artist&per_page=25`;
    const response = await this.rateLimitedFetch<DiscogsAPI.SearchResponse>(
      url,
      `search_artist_${name.toLowerCase().replace(/\s+/g, '_')}`
    );
    return response.results;
  }

  /**
   * Get artist details by ID
   */
  async getArtist(artistId: number): Promise<DiscogsAPI.Artist> {
    const url = `${BASE_URL}/artists/${artistId}`;
    return this.rateLimitedFetch<DiscogsAPI.Artist>(url, `artist_${artistId}`);
  }

  /**
   * Get all releases for an artist (handles pagination)
   * This includes both main releases AND appearances (session work)
   */
  async getArtistReleases(artistId: number, perPage = 100, maxPages = 100): Promise<DiscogsAPI.ArtistRelease[]> {
    const allReleases: DiscogsAPI.ArtistRelease[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= maxPages) {
      const url = `${BASE_URL}/artists/${artistId}/releases?page=${page}&per_page=${perPage}&sort=year&sort_order=asc`;
      const response = await this.rateLimitedFetch<DiscogsAPI.ArtistReleasesResponse>(
        url,
        `artist_${artistId}_releases_p${page}`
      );

      allReleases.push(...response.releases);
      totalPages = response.pagination.pages;

      console.log(`  [releases] Page ${page}/${totalPages} (${allReleases.length} total)`);
      page++;
    }

    if (page > maxPages) {
      console.log(`  [warning] Stopped at page ${maxPages}, may have more releases`);
    }

    return allReleases;
  }

  /**
   * Get release details by ID
   */
  async getRelease(releaseId: number): Promise<DiscogsAPI.Release> {
    const url = `${BASE_URL}/releases/${releaseId}`;
    return this.rateLimitedFetch<DiscogsAPI.Release>(url, `release_${releaseId}`);
  }

  /**
   * Get master release details by ID
   */
  async getMasterRelease(masterId: number): Promise<DiscogsAPI.Release> {
    const url = `${BASE_URL}/masters/${masterId}`;
    return this.rateLimitedFetch<DiscogsAPI.Release>(url, `master_${masterId}`);
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      console.log('[cache cleared]');
    } catch {
      // Directory might not exist
    }
  }
}
