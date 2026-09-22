import type { ReactNode } from 'react'

// Simple stroke icons: 1.9px stroke, rounded caps and joins. Decorative, so hidden from screen readers.
function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PortfolioIcon = () => (
  <Icon>
    <rect x="4" y="3.5" width="7" height="9" rx="1.8" />
    <rect x="13" y="3.5" width="7" height="9" rx="1.8" />
    <rect x="4" y="14.5" width="16" height="6" rx="1.8" />
  </Icon>
)

export const CameraIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1.5 1.5 0 0 0 1.2-.6l.7-1a1.5 1.5 0 0 1 1.2-.6h2.4a1.5 1.5 0 0 1 1.2.6l.7 1a1.5 1.5 0 0 0 1.2.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </Icon>
)

export const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c.6-3.6 3.3-5.5 7-5.5s6.4 1.9 7 5.5" />
  </Icon>
)

export const RefreshIcon = () => (
  <Icon>
    <path d="M20 11.5A8 8 0 0 0 6.1 6.6L4 9" />
    <path d="M4 4.5V9h4.5" />
    <path d="M4 12.5a8 8 0 0 0 13.9 4.9L20 15" />
    <path d="M20 19.5V15h-4.5" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon size={20}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const ShareIcon = () => (
  <Icon size={20}>
    <path d="M12 15V4" />
    <path d="M8.5 7.5L12 4l3.5 3.5" />
    <path d="M7 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H17" />
  </Icon>
)
