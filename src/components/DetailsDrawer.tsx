import type { CreditRow } from '../types';
import './DetailsDrawer.css';

interface DetailsDrawerProps {
  credit: CreditRow | null;
  onClose: () => void;
}

/**
 * Slide-in drawer showing full credit details
 */
export function DetailsDrawer({ credit, onClose }: DetailsDrawerProps) {
  if (!credit) return null;

  return (
    <aside className="details-drawer">
      <div className="drawer-header">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="drawer-content">
        <h2 className="drawer-title">{credit.releaseTitle}</h2>

        <div className="drawer-meta">
          <span className="drawer-year">{credit.year ?? 'Unknown year'}</span>
          <span className="drawer-separator">•</span>
          <span className="drawer-artist">{credit.primaryArtist}</span>
        </div>

        <div className="drawer-section">
          <h3>Roles</h3>
          <div className="drawer-tags">
            {credit.roles.map(role => (
              <span key={role} className="drawer-tag role">
                {role}
              </span>
            ))}
          </div>
        </div>

        {credit.genres.length > 0 && (
          <div className="drawer-section">
            <h3>Genres</h3>
            <div className="drawer-tags">
              {credit.genres.map(genre => (
                <span key={genre} className="drawer-tag genre">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {credit.styles.length > 0 && (
          <div className="drawer-section">
            <h3>Styles</h3>
            <div className="drawer-tags">
              {credit.styles.map(style => (
                <span key={style} className="drawer-tag style">
                  {style}
                </span>
              ))}
            </div>
          </div>
        )}

        {credit.labels.length > 0 && (
          <div className="drawer-section">
            <h3>Labels</h3>
            <ul className="drawer-list">
              {credit.labels.slice(0, 5).map(label => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="drawer-section">
          <h3>Type</h3>
          <span className={`drawer-type ${credit.isBand ? 'band' : 'session'}`}>
            {credit.isBand ? 'Band member' : 'Session musician'}
          </span>
        </div>

        {credit.discogsUrl && (
          <a
            href={credit.discogsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="drawer-link"
          >
            Open on Discogs
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M4 10L10 4M10 4H5M10 4V9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </aside>
  );
}
