import type { ResourceKey } from '../game/rules'

export type BuildingArtKind =
  | 'hall'
  | 'storage'
  | 'military'
  | 'trade'
  | 'research'
  | 'residence'
  | 'wall'
  | 'vault'
  | 'empty'

export type TileArtKind = 'empty' | 'occupied' | 'human'

interface IllustrationProps {
  className?: string
}

export function ResourceIllustration({
  kind,
  className,
}: IllustrationProps & { kind: ResourceKey }) {
  if (kind === 'wood') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#dff1cd" />
        <circle cx="48" cy="18" r="8" fill="#f7e9a7" />
        <path d="M18 39c0-7 6-13 14-13s14 6 14 13v5H18z" fill="#6eb165" />
        <path d="M22 31c0-6 5-12 10-12s10 6 10 12z" fill="#8bca72" />
        <rect x="29" y="36" width="6" height="14" rx="3" fill="#7b4f30" />
        <path d="M10 50h44" stroke="#6d9e58" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'clay') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#f6ddca" />
        <path d="M8 44c8-12 14-17 24-17s16 5 24 17v8H8z" fill="#cf8359" />
        <path d="M21 24h6v18h-6z" fill="#704732" />
        <path d="M24 14l12 9-5 4-12-9z" fill="#95a5b2" />
        <circle cx="45" cy="18" r="7" fill="#f6c39b" />
      </svg>
    )
  }

  if (kind === 'iron') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#e0e6ec" />
        <path d="M8 46 22 25l11 15 9-12 14 18z" fill="#7c8d9c" />
        <path d="M18 48h28" stroke="#bec9d3" strokeWidth="4" strokeLinecap="round" />
        <rect x="23" y="16" width="18" height="8" rx="3" fill="#a6b6c4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="18" fill="#f3e6a8" />
      <circle cx="17" cy="17" r="8" fill="#fbf1bf" />
      <path d="M12 50h40" stroke="#b89536" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 47c4-7 4-17 0-23M32 47c4-7 4-17 0-23M42 47c4-7 4-17 0-23" stroke="#8c7221" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 24c4 3 6 6 6 9M30 24c4 3 6 6 6 9M40 24c4 3 6 6 6 9" stroke="#d4bd54" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function BuildingIllustration({
  kind,
  className,
}: IllustrationProps & { kind: BuildingArtKind }) {
  if (kind === 'storage') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#f4e2c1" />
        <rect x="14" y="24" width="36" height="24" rx="4" fill="#bd8b4f" />
        <path d="M12 24 32 12l20 12" fill="#8a5b34" />
        <rect x="28" y="30" width="8" height="18" rx="2" fill="#6b4224" />
      </svg>
    )
  }

  if (kind === 'military') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#eadcc9" />
        <path d="m18 17 11 11-4 4-11-11z" fill="#8d9baa" />
        <path d="m46 17-11 11 4 4 11-11z" fill="#8d9baa" />
        <path d="M23 47c0-7 4-12 9-12s9 5 9 12z" fill="#926645" />
        <path d="M32 22c-6 0-10 4-10 10v3h20v-3c0-6-4-10-10-10" fill="#c3a07d" />
      </svg>
    )
  }

  if (kind === 'trade') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#f1e3c7" />
        <rect x="15" y="26" width="26" height="15" rx="3" fill="#c28a48" />
        <path d="M20 26V18h10l5 8" stroke="#8a5c33" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="24" cy="46" r="5" fill="#6d4a2f" />
        <circle cx="44" cy="46" r="5" fill="#6d4a2f" />
        <path d="M41 28h8l5 10H41z" fill="#d4a15e" />
      </svg>
    )
  }

  if (kind === 'research') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#ece5d6" />
        <path d="M18 18h16c5 0 8 3 8 8v20H26c-5 0-8-3-8-8z" fill="#cfbf9d" />
        <path d="M46 18H30c-5 0-8 3-8 8v20h16c5 0 8-3 8-8z" fill="#f7f1e7" />
        <path d="M32 22v20" stroke="#b49063" strokeWidth="3" />
      </svg>
    )
  }

  if (kind === 'residence') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#efe1cf" />
        <path d="M16 30 32 16l16 14v18H16z" fill="#be8c58" />
        <path d="M24 50V34h16v16" fill="#8c5c36" />
        <path d="M24 24h16" stroke="#f6e8d2" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'wall') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#e7ddd1" />
        <path d="M12 46h40V26H12z" fill="#ae9276" />
        <path d="M12 26h6v-6h6v6h8v-6h6v6h8v-6h6v6" fill="#92755c" />
        <path d="M18 34h28" stroke="#eaddcf" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'vault') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#eadfce" />
        <path d="M18 24c0-7 6-12 14-12s14 5 14 12v20H18z" fill="#8d6747" />
        <circle cx="32" cy="35" r="6" fill="#d8bd8c" />
        <path d="M32 35v6" stroke="#6d4b31" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'empty') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#eadfc9" />
        <path d="M14 42c8-10 14-14 18-14s10 4 18 14" stroke="#a07a54" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M16 46h32" stroke="#c3a57b" strokeWidth="4" strokeLinecap="round" />
        <path d="M22 24h20" stroke="#ccb08c" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="18" fill="#f0dfc7" />
      <path d="M18 32 32 18l14 14v16H18z" fill="#b17d49" />
      <rect x="28" y="34" width="8" height="14" rx="2" fill="#70452a" />
      <path d="M14 32h36" stroke="#f6e8d2" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function TileIllustration({
  kind,
  className,
}: IllustrationProps & { kind: TileArtKind }) {
  if (kind === 'human') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#dcefd2" />
        <path d="M9 46c8-8 16-12 24-12s16 4 22 12v8H9z" fill="#8eb777" />
        <path d="M18 36 32 24l14 12v11H18z" fill="#7b9f6a" />
        <path d="M44 16v14" stroke="#5e7f4f" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 16h10l-5 7h-5z" fill="#ba7b4d" />
      </svg>
    )
  }

  if (kind === 'occupied') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="18" fill="#efdfc6" />
        <path d="M9 46c8-8 16-12 24-12s16 4 22 12v8H9z" fill="#c9b07d" />
        <path d="M18 36 32 24l14 12v11H18z" fill="#a57446" />
        <rect x="29" y="38" width="6" height="9" rx="2" fill="#73472a" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="18" fill="#eadfb7" />
      <circle cx="48" cy="18" r="8" fill="#f7efbf" />
      <path d="M8 46c8-7 16-11 24-11s16 4 24 11v8H8z" fill="#cab577" />
      <path d="M10 42c6-5 13-8 22-8s16 3 22 8" stroke="#b59c56" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
