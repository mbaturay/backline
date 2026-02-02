/**
 * Transform flat credits into a hierarchical tree structure for icicle visualization
 *
 * Structure:
 * Root: Artist (Jeff Porcaro)
 *   Level 1: Collaborator (primaryArtist)
 *     Level 2: Role (normalized role)
 *       Level 3: Release leaves (title + year)
 */

import type { CreditRow } from '../types';

export interface HierarchyNode {
  name: string;
  id: string;
  type: 'root' | 'collaborator' | 'role' | 'release';
  children?: HierarchyNode[];
  value?: number;
  // Leaf node data
  credit?: CreditRow;
  // For display
  count?: number;
  yearRange?: [number, number];
}

export function buildHierarchy(
  credits: CreditRow[],
  artistName: string
): HierarchyNode {
  // Group credits by collaborator -> role -> releases
  const collaboratorMap = new Map<string, Map<string, CreditRow[]>>();

  credits.forEach(credit => {
    const collabId = credit.primaryArtistId;

    if (!collaboratorMap.has(collabId)) {
      collaboratorMap.set(collabId, new Map());
    }

    const roleMap = collaboratorMap.get(collabId)!;

    // Each credit can have multiple roles - add to each
    const roles = credit.roles.length > 0 ? credit.roles : ['other'];
    roles.forEach(role => {
      if (!roleMap.has(role)) {
        roleMap.set(role, []);
      }
      roleMap.get(role)!.push(credit);
    });
  });

  // Build hierarchy
  const children: HierarchyNode[] = [];

  collaboratorMap.forEach((roleMap, collabId) => {
    // Get collaborator name from first credit
    const firstCredit = roleMap.values().next().value?.[0];
    const collaboratorName = firstCredit?.primaryArtist ?? 'Unknown';

    const roleChildren: HierarchyNode[] = [];
    let collabYears: number[] = [];
    let collabCount = 0;

    roleMap.forEach((creditsForRole, role) => {
      const releaseChildren: HierarchyNode[] = [];
      const roleYears: number[] = [];

      creditsForRole.forEach(credit => {
        releaseChildren.push({
          name: credit.releaseTitle,
          id: `release-${credit.releaseId}`,
          type: 'release',
          value: 1,
          credit,
        });

        if (credit.year !== null) {
          roleYears.push(credit.year);
          collabYears.push(credit.year);
        }
      });

      collabCount += creditsForRole.length;

      roleChildren.push({
        name: role,
        id: `role-${collabId}-${role}`,
        type: 'role',
        children: releaseChildren,
        count: creditsForRole.length,
        yearRange: roleYears.length > 0
          ? [Math.min(...roleYears), Math.max(...roleYears)]
          : undefined,
      });
    });

    // Sort roles by count descending
    roleChildren.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

    children.push({
      name: collaboratorName,
      id: `collab-${collabId}`,
      type: 'collaborator',
      children: roleChildren,
      count: collabCount,
      yearRange: collabYears.length > 0
        ? [Math.min(...collabYears), Math.max(...collabYears)]
        : undefined,
    });
  });

  // Sort collaborators by count descending
  children.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return {
    name: artistName,
    id: 'root',
    type: 'root',
    children,
    count: credits.length,
  };
}

/**
 * Filter hierarchy based on search query
 */
export function filterHierarchy(
  root: HierarchyNode,
  query: string
): HierarchyNode | null {
  if (!query.trim()) return root;

  const lowerQuery = query.toLowerCase();

  function filterNode(node: HierarchyNode): HierarchyNode | null {
    // Check if this node matches
    const nameMatches = node.name.toLowerCase().includes(lowerQuery);

    // For leaves, check credit details too
    if (node.type === 'release' && node.credit) {
      const creditMatches =
        node.credit.releaseTitle.toLowerCase().includes(lowerQuery) ||
        node.credit.primaryArtist.toLowerCase().includes(lowerQuery) ||
        node.credit.roles.some(r => r.toLowerCase().includes(lowerQuery));

      if (creditMatches) {
        return node;
      }
      return null;
    }

    // For internal nodes, filter children recursively
    if (node.children) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is HierarchyNode => n !== null);

      if (filteredChildren.length > 0 || nameMatches) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
          count: filteredChildren.reduce((sum, c) => sum + (c.count ?? c.value ?? 0), 0),
        };
      }
    }

    return nameMatches ? node : null;
  }

  return filterNode(root);
}
