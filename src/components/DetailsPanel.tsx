import type { CreditRow, GraphNode } from '../types';
import './DetailsPanel.css';

interface DetailsPanelProps {
  selectedRelease: CreditRow | null;
  hoveredRelease: CreditRow | null;
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  collaboratorCredits?: CreditRow[];
  onReleaseClick?: (releaseId: string) => void;
}

/**
 * Details panel showing information about selected/hovered items
 * When a collaborator is selected, shows a scrollable list of their releases
 */
export function DetailsPanel({
  selectedRelease,
  hoveredRelease,
  selectedNode,
  hoveredNode,
  collaboratorCredits = [],
  onReleaseClick,
}: DetailsPanelProps) {
  // Priority: hovered > selected
  const release = hoveredRelease ?? selectedRelease;
  const node = hoveredNode ?? selectedNode;

  // Show release details if available
  if (release) {
    return (
      <aside className="details-panel">
        <div className="details-header">
          <span className="details-badge">Release</span>
        </div>
        <h2 className="details-title">{release.releaseTitle}</h2>
        <div className="details-meta">
          {release.year && <span className="details-year">{release.year}</span>}
          <span className="details-artist">{release.primaryArtist}</span>
        </div>

        <div className="details-section">
          <h3>Roles</h3>
          <div className="details-tags">
            {release.roles.map(role => (
              <span key={role} className="details-tag role-tag">
                {role}
              </span>
            ))}
          </div>
        </div>

        {release.genres.length > 0 && (
          <div className="details-section">
            <h3>Genres</h3>
            <div className="details-tags">
              {release.genres.map(genre => (
                <span key={genre} className="details-tag genre-tag">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {release.styles.length > 0 && (
          <div className="details-section">
            <h3>Styles</h3>
            <div className="details-tags">
              {release.styles.map(style => (
                <span key={style} className="details-tag style-tag">
                  {style}
                </span>
              ))}
            </div>
          </div>
        )}

        {release.labels.length > 0 && (
          <div className="details-section">
            <h3>Labels</h3>
            <ul className="details-list">
              {release.labels.slice(0, 3).map(label => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="details-section">
          <h3>Type</h3>
          <span className={`details-type ${release.isBand ? 'band' : 'session'}`}>
            {release.isBand ? 'Band member' : 'Session musician'}
          </span>
        </div>

        {release.discogsUrl && (
          <a
            href={release.discogsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="details-link"
          >
            Open on Discogs
          </a>
        )}
      </aside>
    );
  }

  // Show node details with releases list if a collaborator is selected
  if (node) {
    // Sort credits by year (ascending), unknown years at end
    const sortedCredits = [...collaboratorCredits].sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

    return (
      <aside className="details-panel">
        <div className="details-header">
          <span className="details-badge collaborator">Collaborator</span>
        </div>
        <h2 className="details-title">{node.name}</h2>
        <div className="details-meta">
          <span className={`details-type ${node.type}`}>
            {node.type === 'band' ? 'Band' : 'Artist'}
          </span>
          {node.yearRange && (
            <span className="details-year">
              {node.yearRange[0]} - {node.yearRange[1]}
            </span>
          )}
        </div>

        <div className="details-section">
          <h3>Credits with Jeff Porcaro</h3>
          <span className="details-credit-count">{node.creditCount} releases</span>
        </div>

        {node.meta?.genres && node.meta.genres.length > 0 && (
          <div className="details-section">
            <h3>Genres</h3>
            <div className="details-tags">
              {node.meta.genres.slice(0, 5).map(genre => (
                <span key={genre} className="details-tag genre-tag">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable releases list */}
        {sortedCredits.length > 0 && (
          <div className="details-section releases-section">
            <h3>Releases ({sortedCredits.length})</h3>
            <div className="releases-list">
              {sortedCredits.map(credit => (
                <button
                  key={credit.releaseId}
                  className="release-item"
                  onClick={() => onReleaseClick?.(credit.releaseId)}
                >
                  <span className="release-year">
                    {credit.year ?? '—'}
                  </span>
                  <span className="release-title">{credit.releaseTitle}</span>
                  <span className="release-roles">
                    {credit.roles.slice(0, 2).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    );
  }

  // Empty state with helpful instructions
  return (
    <aside className="details-panel">
      <div className="details-empty">
        <div className="empty-icon">?</div>
        <h3>Explore the Graph</h3>
        <ul className="empty-instructions">
          <li>
            <strong>Hover</strong> nodes or timeline dots to preview
          </li>
          <li>
            <strong>Click</strong> a collaborator to see their releases
          </li>
          <li>
            <strong>Click</strong> a timeline dot to pin details
          </li>
          <li>
            <strong>Drag</strong> on timeline to filter by year
          </li>
        </ul>
      </div>
    </aside>
  );
}
