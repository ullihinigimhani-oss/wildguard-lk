const paths = {
  patrol: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-3 5-5 3 3-5Z" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
    </>
  ),
  wildlife: (
    <>
      <path d="M20 3C9 2 3 8 5 15s16 5 15-12ZM5 21 16 9M9 16v-5m4 1h4" />
    </>
  ),
  data: (
    <>
      <path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5" />
    </>
  ),
};
export default function FeatureIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
