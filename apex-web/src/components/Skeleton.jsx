export function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-md bg-zinc-800/60 motion-safe:animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}
