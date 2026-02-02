/**
 * Discogs Data Fetcher for Artist Journey
 *
 * This script:
 * 1. Searches for Jeff Porcaro on Discogs
 * 2. Fetches all his release credits (including appearances/session work)
 * 3. For each release, fetches details to get collaborator info
 * 4. Normalizes the data into our graph format
 * 5. Saves to data/normalized/jeff-porcaro.json
 *
 * Usage:
 *   npm run fetch              # Use cached data
 *   REFRESH=true npm run fetch # Force refresh
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { DiscogsClient } from './discogsClient.js';
import type {
  NormalizedData,
  CreditRow,
  GraphNode,
  GraphLink,
} from '../src/types/index.js';

const ARTIST_NAME = 'Jeff Porcaro';
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'normalized');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'jeff-porcaro.json');
const PUBLIC_OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'normalized');
const PUBLIC_OUTPUT_FILE = path.join(PUBLIC_OUTPUT_DIR, 'jeff-porcaro.json');

// =============================================================================
// Role Normalization
// =============================================================================

// Keywords that indicate drum/percussion roles (case-insensitive contains match)
const DRUM_KEYWORDS = [
  'drum', 'drums', 'drummer', 'snare', 'hi-hat', 'hihat', 'hi hat',
  'kick', 'bass drum', 'tom', 'cymbal', 'ride', 'crash',
];

const PERCUSSION_KEYWORDS = [
  'percussion', 'percussionist', 'conga', 'congas', 'bongo', 'bongos',
  'timbale', 'timbales', 'shaker', 'tambourine', 'cabasa', 'cowbell',
  'triangle', 'maracas', 'claves', 'guiro', 'vibraslap', 'woodblock',
  'bell', 'chimes', 'gong', 'timpani', 'xylophone', 'marimba',
  'vibraphone', 'vibes', 'hand claps', 'handclaps', 'finger snaps',
];

const PRODUCER_KEYWORDS = ['producer', 'produced', 'production'];
const ENGINEER_KEYWORDS = ['engineer', 'engineered', 'recording', 'mixing', 'mixed'];
const COMPOSER_KEYWORDS = ['composer', 'composed', 'written', 'songwriter', 'music by'];
const ARRANGER_KEYWORDS = ['arranger', 'arranged', 'arrangement'];

/**
 * Normalize a role string using fuzzy keyword matching
 */
function normalizeRole(rawRole: string): string {
  const lower = rawRole.toLowerCase().trim();

  // Check for drum-related roles first (most specific for Jeff Porcaro)
  for (const keyword of DRUM_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'drums';
    }
  }

  // Check for percussion
  for (const keyword of PERCUSSION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'percussion';
    }
  }

  // Check other roles
  for (const keyword of PRODUCER_KEYWORDS) {
    if (lower.includes(keyword)) return 'producer';
  }
  for (const keyword of ENGINEER_KEYWORDS) {
    if (lower.includes(keyword)) return 'engineer';
  }
  for (const keyword of COMPOSER_KEYWORDS) {
    if (lower.includes(keyword)) return 'composer';
  }
  for (const keyword of ARRANGER_KEYWORDS) {
    if (lower.includes(keyword)) return 'arranger';
  }

  // Vocals
  if (lower.includes('vocal') || lower.includes('backing') || lower.includes('chorus')) {
    return 'vocals';
  }

  return 'other';
}

/**
 * Parse a complex role string into normalized roles
 * Example: "Drums, Percussion [Congas, Timbales]" -> ['drums', 'percussion']
 */
function parseRoles(roleString: string): string[] {
  if (!roleString) return [];

  // Split by comma and semicolon
  const parts = roleString.split(/[,;]/).map(r => r.trim());
  const roles: string[] = [];

  for (const part of parts) {
    // Also extract content from brackets as separate roles
    const bracketMatch = part.match(/\[([^\]]+)\]/);
    const mainPart = part.replace(/\[.*?\]/g, '').trim();

    if (mainPart) {
      const normalized = normalizeRole(mainPart);
      if (!roles.includes(normalized)) {
        roles.push(normalized);
      }
    }

    if (bracketMatch) {
      // Split bracket contents
      const bracketItems = bracketMatch[1].split(/[,;]/).map(s => s.trim());
      for (const item of bracketItems) {
        const normalized = normalizeRole(item);
        if (!roles.includes(normalized)) {
          roles.push(normalized);
        }
      }
    }
  }

  return roles;
}

// =============================================================================
// Year Validation
// =============================================================================

/**
 * Validate and normalize a year value
 * Returns null for invalid/missing years (0, negative, < 1900, > current year + 2)
 */
function validateYear(year: number | undefined | null): number | null {
  if (year === undefined || year === null) return null;
  if (typeof year !== 'number') return null;
  if (year === 0) return null;
  if (year < 1900) return null;
  if (year > new Date().getFullYear() + 2) return null;
  return year;
}

// =============================================================================
// Band Detection
// =============================================================================

// Known bands Jeff Porcaro was a member of
const KNOWN_BANDS = new Set([
  'toto',
  'rural still life',
]);

function isBandContext(artistName: string): boolean {
  const lower = artistName.toLowerCase();
  return KNOWN_BANDS.has(lower) || lower.includes('toto');
}

// =============================================================================
// Main Script
// =============================================================================

async function main() {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) {
    console.error('Error: DISCOGS_TOKEN not set in environment');
    console.error('Create a .env file with your Discogs personal access token');
    console.error('Get one at: https://www.discogs.com/settings/developers');
    process.exit(1);
  }

  const refresh = process.env.REFRESH === 'true';
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Artist Journey: Fetching ${ARTIST_NAME}`);
  console.log(`${'='.repeat(60)}\n`);

  const client = new DiscogsClient({
    token,
    useCache: !refresh,
  });

  if (refresh) {
    console.log('[mode] Refresh enabled - will re-fetch all data\n');
  } else {
    console.log('[mode] Using cached data where available\n');
  }

  // =========================================================================
  // Step 1: Find artist
  // =========================================================================
  console.log('[step 1/6] Searching for artist...');
  const searchResults = await client.searchArtist(ARTIST_NAME);

  // Find the best match (exact name match preferred)
  const exactMatch = searchResults.find(
    r => r.title.toLowerCase() === ARTIST_NAME.toLowerCase()
  );
  const artistResult = exactMatch ?? searchResults[0];

  if (!artistResult) {
    console.error(`Could not find artist: ${ARTIST_NAME}`);
    process.exit(1);
  }

  console.log(`  Found: ${artistResult.title} (ID: ${artistResult.id})\n`);

  // =========================================================================
  // Step 2: Get artist details
  // =========================================================================
  console.log('[step 2/6] Fetching artist details...');
  const artist = await client.getArtist(artistResult.id);
  console.log(`  Name: ${artist.name}`);
  console.log(`  Profile: ${artist.profile?.slice(0, 80)}...`);
  console.log(`  Releases URL: ${artist.releases_url}\n`);

  // =========================================================================
  // Step 3: Get all releases (with pagination)
  // =========================================================================
  console.log('[step 3/6] Fetching all releases (including appearances)...');
  const releases = await client.getArtistReleases(artistResult.id);

  // Analyze release types
  const releaseTypes = new Map<string, number>();
  releases.forEach(r => {
    const type = r.type || 'unknown';
    releaseTypes.set(type, (releaseTypes.get(type) ?? 0) + 1);
  });

  console.log(`\n  Total releases from API: ${releases.length}`);
  console.log('  By type:');
  releaseTypes.forEach((count, type) => {
    console.log(`    - ${type}: ${count}`);
  });
  console.log('');

  // =========================================================================
  // Step 4: Fetch release details and build credits
  // =========================================================================
  console.log('[step 4/6] Fetching release details and extracting credits...');

  const credits: CreditRow[] = [];
  const collaboratorMap = new Map<string, { count: number; years: number[]; roles: Set<string>; name: string }>();
  const processedReleases = new Set<number>();
  const skippedReasons = new Map<string, number>();

  let processedCount = 0;
  let creditsFound = 0;

  for (let i = 0; i < releases.length; i++) {
    const rel = releases[i];

    // Determine the actual release ID to fetch
    // For masters, fetch the main_release; otherwise fetch the release itself
    let releaseId: number;
    if (rel.type === 'master' && rel.main_release) {
      releaseId = rel.main_release;
    } else if (rel.type === 'master') {
      // Master without main_release - skip
      skippedReasons.set('master_no_main', (skippedReasons.get('master_no_main') ?? 0) + 1);
      continue;
    } else {
      releaseId = rel.id;
    }

    // Skip duplicates
    if (processedReleases.has(releaseId)) {
      skippedReasons.set('duplicate', (skippedReasons.get('duplicate') ?? 0) + 1);
      continue;
    }
    processedReleases.add(releaseId);
    processedCount++;

    try {
      const details = await client.getRelease(releaseId);

      // Find Jeff's roles in this release
      // Check extraartists first (session musicians)
      const jeffCreditsInExtra = details.extraartists?.filter(
        ea => ea.id === artistResult.id
      ) ?? [];

      // Also check main artists
      const jeffAsMainArtist = details.artists?.some(a => a.id === artistResult.id);

      // Extract roles from extra artists
      let roles = jeffCreditsInExtra.flatMap(c => parseRoles(c.role));

      // If Jeff is a main artist, add 'artist' role
      if (jeffAsMainArtist) {
        if (!roles.includes('artist')) {
          roles.push('artist');
        }
      }

      // The release listing from artist/releases endpoint already includes
      // Jeff's role - use it if we didn't find anything in the details
      if (roles.length === 0 && rel.role) {
        roles = parseRoles(rel.role);
      }

      // Skip if no roles found at all
      if (roles.length === 0) {
        skippedReasons.set('no_roles', (skippedReasons.get('no_roles') ?? 0) + 1);
        continue;
      }

      // Get primary artist name (first artist on release, excluding Jeff for session work)
      let primaryArtist = 'Unknown Artist';
      let primaryArtistId = '0';

      if (details.artists && details.artists.length > 0) {
        // If Jeff is the only artist, use him; otherwise use the first non-Jeff artist
        const nonJeffArtist = details.artists.find(a => a.id !== artistResult.id);
        const targetArtist = nonJeffArtist ?? details.artists[0];
        primaryArtist = targetArtist.name.replace(/\s*\(\d+\)$/, ''); // Remove disambiguation numbers
        primaryArtistId = targetArtist.id.toString();
      }

      // Validate year - reject 0, invalid, or missing years
      const validYear = validateYear(details.year);

      // Build credit row
      const credit: CreditRow = {
        year: validYear,
        releaseId: details.id.toString(),
        releaseTitle: details.title,
        primaryArtist,
        primaryArtistId,
        roles,
        labels: details.labels?.map(l => l.name) ?? [],
        genres: details.genres ?? [],
        styles: details.styles ?? [],
        discogsUrl: details.uri ?? `https://www.discogs.com/release/${details.id}`,
        isBand: isBandContext(primaryArtist),
      };

      credits.push(credit);
      creditsFound++;

      // Track collaborators (excluding self)
      if (primaryArtistId !== artistResult.id.toString()) {
        const existing = collaboratorMap.get(primaryArtistId);
        if (existing) {
          existing.count++;
          if (validYear !== null) existing.years.push(validYear);
          roles.forEach(r => existing.roles.add(r));
        } else {
          collaboratorMap.set(primaryArtistId, {
            count: 1,
            years: validYear !== null ? [validYear] : [],
            roles: new Set(roles),
            name: primaryArtist,
          });
        }
      }

      // Progress logging
      if (processedCount % 50 === 0) {
        console.log(`  [progress] ${processedCount} releases processed, ${creditsFound} credits found`);
      }
    } catch (error) {
      skippedReasons.set('fetch_error', (skippedReasons.get('fetch_error') ?? 0) + 1);
    }
  }

  console.log(`\n  Releases inspected: ${processedCount}`);
  console.log(`  Credits extracted: ${credits.length}`);
  console.log('  Skipped:');
  skippedReasons.forEach((count, reason) => {
    console.log(`    - ${reason}: ${count}`);
  });
  console.log('');

  // =========================================================================
  // Step 5: Build graph
  // =========================================================================
  console.log('[step 5/6] Building graph...');

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // Add Jeff as the central node
  nodes.push({
    id: artistResult.id.toString(),
    type: 'artist',
    name: ARTIST_NAME,
    creditCount: credits.length,
    meta: {
      discogsId: artistResult.id,
    },
  });

  // Group credits by collaborator
  const collaboratorCredits = new Map<string, CreditRow[]>();
  credits.forEach(c => {
    if (c.primaryArtistId === artistResult.id.toString()) return; // Skip self-credits
    const existing = collaboratorCredits.get(c.primaryArtistId);
    if (existing) {
      existing.push(c);
    } else {
      collaboratorCredits.set(c.primaryArtistId, [c]);
    }
  });

  // Sort by credit count
  const sortedCollaborators = [...collaboratorCredits.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  for (const [collabId, collabCredits] of sortedCollaborators) {
    const years = collabCredits
      .map(c => c.year)
      .filter((y): y is number => y !== null);

    const collabInfo = collaboratorMap.get(collabId);
    const firstCredit = collabCredits[0];

    nodes.push({
      id: collabId,
      type: firstCredit.isBand ? 'band' : 'artist',
      name: firstCredit.primaryArtist,
      yearRange: years.length > 0 ? [Math.min(...years), Math.max(...years)] : undefined,
      creditCount: collabCredits.length,
      meta: {
        genres: [...new Set(collabCredits.flatMap(c => c.genres))].slice(0, 5),
        styles: [...new Set(collabCredits.flatMap(c => c.styles))].slice(0, 5),
        discogsId: parseInt(collabId),
      },
    });

    links.push({
      source: artistResult.id.toString(),
      target: collabId,
      kind: firstCredit.isBand ? 'member_of' : 'played_on',
      roles: collabInfo ? [...collabInfo.roles] : [],
      weight: collabCredits.length,
      years: years,
    });
  }

  console.log(`  Graph: ${nodes.length} nodes, ${links.length} links\n`);

  // =========================================================================
  // Step 6: Calculate stats and save
  // =========================================================================
  console.log('[step 6/6] Saving normalized data...');

  const yearsWithData = credits
    .map(c => c.year)
    .filter((y): y is number => y !== null);

  const topCollaborators = sortedCollaborators
    .slice(0, 30)
    .map(([, creds]) => ({
      name: creds[0].primaryArtist,
      count: creds.length,
    }));

  // Role distribution
  const roleCounts = new Map<string, number>();
  credits.forEach(c => {
    c.roles.forEach(r => {
      roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
    });
  });

  const normalizedData: NormalizedData = {
    artist: {
      name: artist.name,
      discogsArtistId: artist.id,
      profile: artist.profile,
      imageUrl: artist.images?.[0]?.uri,
    },
    credits,
    graph: { nodes, links },
    stats: {
      totalCredits: credits.length,
      yearMin: yearsWithData.length > 0 ? Math.min(...yearsWithData) : null,
      yearMax: yearsWithData.length > 0 ? Math.max(...yearsWithData) : null,
      topCollaborators,
    },
    fetchedAt: new Date().toISOString(),
  };

  // Save files
  const outputJson = JSON.stringify(normalizedData, null, 2);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, outputJson);
  console.log(`  Saved to: ${OUTPUT_FILE}`);

  await fs.mkdir(PUBLIC_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(PUBLIC_OUTPUT_FILE, outputJson);
  console.log(`  Saved to: ${PUBLIC_OUTPUT_FILE}\n`);

  // =========================================================================
  // Summary
  // =========================================================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Artist: ${ARTIST_NAME}`);
  console.log(`  API requests: ${client.getRequestCount()}`);
  console.log(`  Time elapsed: ${elapsed}s`);
  console.log('');
  const unknownYearCount = credits.filter(c => c.year === null).length;
  const knownYearCount = credits.length - unknownYearCount;

  console.log(`  Total credits: ${credits.length}`);
  console.log(`  Credits with known year: ${knownYearCount}`);
  console.log(`  Credits with unknown year: ${unknownYearCount}`);
  console.log(`  Unique collaborators: ${sortedCollaborators.length}`);
  console.log(`  Year range: ${normalizedData.stats.yearMin ?? 'N/A'} - ${normalizedData.stats.yearMax ?? 'N/A'}`);
  console.log('');
  console.log('  Roles:');
  [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([role, count]) => {
      console.log(`    - ${role}: ${count}`);
    });
  console.log('');
  console.log('  Top 15 collaborators:');
  topCollaborators.slice(0, 15).forEach((c, i) => {
    console.log(`    ${(i + 1).toString().padStart(2)}. ${c.name} (${c.count} credits)`);
  });

  // Sanity checks
  console.log('');
  console.log('  Sanity checks:');
  if (credits.length < 150) {
    console.log(`    [WARNING] Only ${credits.length} credits - expected 150+`);
    console.log('    -> Check if artist releases endpoint is returning all appearances');
  } else {
    console.log(`    [OK] Credits: ${credits.length} >= 150`);
  }

  if (sortedCollaborators.length < 30) {
    console.log(`    [WARNING] Only ${sortedCollaborators.length} collaborators - expected 30+`);
  } else {
    console.log(`    [OK] Collaborators: ${sortedCollaborators.length} >= 30`);
  }

  const drumsCredits = credits.filter(c => c.roles.includes('drums')).length;
  if (drumsCredits < 100) {
    console.log(`    [WARNING] Only ${drumsCredits} drum credits - expected 100+`);
  } else {
    console.log(`    [OK] Drum credits: ${drumsCredits} >= 100`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('  Done!');
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
