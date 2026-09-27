export default function StatusBadge({ children }) {
  return (
    <span
      className={`badge badge-${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}
