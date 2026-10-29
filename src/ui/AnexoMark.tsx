export function AnexoMark({
  size = 24,
  className = 'ax-mark',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={className} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4.4 19.4C4.4 11.6 10.3 5 20 3.9c.7 9.5-4.5 15.5-13.2 15.5H4.4Z"
          fill="currentColor"
        />
        <path
          d="M5.6 18.2C9 13.8 12.9 10.1 17.4 6.9"
          stroke="var(--ax-accent-500)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M9.8 14.5c.3-2 1.4-4.2 3.2-6.2M12.4 12c1.8-.2 3.5-.9 5-2.1"
          stroke="var(--ax-accent-500)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
