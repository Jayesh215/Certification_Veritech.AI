import { linkedInCertificationUrl } from "../lib/api";

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}

export default function AddToLinkedIn({ registration, className = "" }) {
  const href = linkedInCertificationUrl(registration);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 bg-[#0A66C2] text-sm font-semibold text-white hover:bg-[#004182] ${className}`}
      data-testid="add-to-linkedin-btn"
    >
      <LinkedInMark />
      Add to LinkedIn
    </a>
  );
}
