// src/components/SourceLink.tsx
// Small source-attribution icon for widgets fed by an external document
// (e.g. a Google Sheet). Sits beside the section title; tooltip on hover,
// opens the source in a new tab.

interface SourceLinkProps {
  href: string;
  /** Tooltip, e.g. "Source: FY27 daily GP budget/forecast (Google Sheet)" */
  title: string;
  kind?: "sheet";
}

// Google Sheets-style mark: green sheet with white grid.
function SheetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#188038" />
      <path d="M15 2v5h5" fill="#34A853" />
      <path
        d="M8 11h8v7H8v-7Zm1.5 1.5v1.2h2.1v-1.2H9.5Zm3.4 0v1.2h2.1v-1.2h-2.1Zm-3.4 2.4v1.2h2.1v-1.2H9.5Zm3.4 0v1.2h2.1v-1.2h-2.1Z"
        fill="#fff"
      />
    </svg>
  );
}

export function SourceLink({ href, title }: SourceLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center w-6 h-6 rounded-md align-middle transition-colors"
      style={{ border: "1px solid var(--gaf-input-border)", background: "var(--gaf-card-bg)", cursor: "pointer" }}
      onClick={e => e.stopPropagation()}
    >
      <SheetIcon />
    </a>
  );
}
