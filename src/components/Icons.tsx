interface IconProps {
  size?: number;
}

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconFrame({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M4.5 9.5h15" />
    </svg>
  );
}

export function IconRect({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="5" y="6.5" width="14" height="11" rx="2" />
    </svg>
  );
}

export function IconEllipse({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <ellipse cx="12" cy="12" rx="7.5" ry="6.25" />
    </svg>
  );
}

export function IconText({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M6 7.5h12M12 7.5v9M9.5 16.5h5" />
    </svg>
  );
}

export function IconSticky({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M7 5.5h7.5L18.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18V7A1.5 1.5 0 0 1 7 5.5Z" />
      <path d="M14.5 5.5V9a1 1 0 0 0 1 1h3.5" />
    </svg>
  );
}

export function IconTrash({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M5.5 8h13M10 8V6.5A1.5 1.5 0 0 1 11.5 5h1A1.5 1.5 0 0 1 14 6.5V8M8.5 8v10a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5V8" />
    </svg>
  );
}

export function IconSpark({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M7.2 7.2l2 2M14.8 14.8l2 2M16.8 7.2l-2 2M9.2 14.8l-2 2" />
    </svg>
  );
}

export function IconLayout({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
      <path d="M5 10h14M10 10v9" />
    </svg>
  );
}

export function IconKanban({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="4.5" y="5" width="4.5" height="14" rx="1.25" />
      <rect x="9.75" y="5" width="4.5" height="9" rx="1.25" />
      <rect x="15" y="5" width="4.5" height="11.5" rx="1.25" />
    </svg>
  );
}

export function IconFlow({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="6.5" cy="12" r="2.25" />
      <rect x="10" y="9.5" width="5" height="5" rx="1.25" />
      <circle cx="18.5" cy="12" r="2.25" />
    </svg>
  );
}

export function IconNote({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M7 6h7l3 3v9a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18V7.5A1.5 1.5 0 0 1 7 6Z" />
    </svg>
  );
}

export function IconGrid({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="5" y="5" width="5.5" height="5.5" rx="1.2" />
      <rect x="13.5" y="5" width="5.5" height="5.5" rx="1.2" />
      <rect x="5" y="13.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="5.5" height="5.5" rx="1.2" />
    </svg>
  );
}

export function IconMoon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M16.5 14.5A6.5 6.5 0 0 1 9.5 7.4 6.25 6.25 0 1 0 16.5 14.5Z" />
    </svg>
  );
}

export function IconUndo({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M8 8H5.5v2.5M5.8 10.2A6.5 6.5 0 1 0 8 6.6" />
    </svg>
  );
}

export function IconReview({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M6 7h12M6 12h8M6 17h5" />
      <path d="M16.5 15.5l1.4 1.4 2.6-2.8" />
    </svg>
  );
}

export function IconGap({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="6.5" cy="12" r="2.25" />
      <path d="M9.2 12h2.2M12.8 12h2" />
      <circle cx="18.2" cy="12" r="2.25" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden>
      <rect x="2.5" y="2.5" width="12.5" height="12.5" rx="3.6" fill="#7C6CF5" />
      <rect x="17" y="2.5" width="12.5" height="12.5" rx="3.6" fill="#4ECDC4" />
      <rect x="2.5" y="17" width="12.5" height="12.5" rx="3.6" fill="#C4B5FD" />
      <rect x="17" y="17" width="12.5" height="12.5" rx="3.6" fill="#E8C36A" />
    </svg>
  );
}
