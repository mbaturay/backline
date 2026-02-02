import type { CreditRow, GraphNode, GraphLink, FilterState } from '../types';

/**
 * Filter credits based on current filter state
 */
export function filterCredits(
  credits: CreditRow[],
  filters: FilterState
): CreditRow[] {
  return credits.filter(credit => {
    // Year range filter
    if (filters.yearRange) {
      const [minYear, maxYear] = filters.yearRange;
      if (credit.year === null) {
        // Include undated credits only if we're showing the full range
        return false;
      }
      if (credit.year < minYear || credit.year > maxYear) {
        return false;
      }
    }

    // Role filter
    if (filters.roles.length > 0) {
      const hasMatchingRole = credit.roles.some(role =>
        filters.roles.includes(role)
      );
      if (!hasMatchingRole) {
        return false;
      }
    }

    // Type filter (band vs session)
    if (filters.types.length > 0) {
      const type = credit.isBand ? 'band' : 'session';
      if (!filters.types.includes(type)) {
        return false;
      }
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = credit.releaseTitle.toLowerCase().includes(query);
      const matchesArtist = credit.primaryArtist.toLowerCase().includes(query);
      if (!matchesTitle && !matchesArtist) {
        return false;
      }
    }

    // Selected collaborator filter
    if (filters.selectedCollaborator) {
      if (credit.primaryArtistId !== filters.selectedCollaborator) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter graph nodes based on visible credits
 * Only show nodes that have at least one visible credit
 */
export function filterGraphNodes(
  nodes: GraphNode[],
  filteredCredits: CreditRow[],
  centralNodeId: string
): GraphNode[] {
  // Always include the central node
  const visibleArtistIds = new Set<string>([centralNodeId]);

  // Add all artists that appear in filtered credits
  filteredCredits.forEach(credit => {
    visibleArtistIds.add(credit.primaryArtistId);
  });

  return nodes.filter(node => visibleArtistIds.has(node.id));
}

/**
 * Filter graph links based on visible nodes
 */
export function filterGraphLinks(
  links: GraphLink[],
  visibleNodeIds: Set<string>
): GraphLink[] {
  return links.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
  });
}

/**
 * Extract unique roles from credits
 */
export function extractUniqueRoles(credits: CreditRow[]): string[] {
  const roles = new Set<string>();
  credits.forEach(credit => {
    credit.roles.forEach(role => roles.add(role));
  });
  return [...roles].sort();
}

/**
 * Group credits by year for timeline
 */
export function groupCreditsByYear(
  credits: CreditRow[]
): Map<number | null, CreditRow[]> {
  const grouped = new Map<number | null, CreditRow[]>();

  credits.forEach(credit => {
    const existing = grouped.get(credit.year);
    if (existing) {
      existing.push(credit);
    } else {
      grouped.set(credit.year, [credit]);
    }
  });

  return grouped;
}

/**
 * Calculate credit count by collaborator for node sizing
 */
export function calculateCollaboratorCounts(
  credits: CreditRow[]
): Map<string, number> {
  const counts = new Map<string, number>();

  credits.forEach(credit => {
    const current = counts.get(credit.primaryArtistId) ?? 0;
    counts.set(credit.primaryArtistId, current + 1);
  });

  return counts;
}
