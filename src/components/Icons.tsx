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

export function IconExport({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M12 4.5v10.2" />
      <path d="m8.4 8.1 3.6-3.6 3.6 3.6" />
      <path d="M6 16.8v1.4A1.8 1.8 0 0 0 7.8 20h8.4A1.8 1.8 0 0 0 18 18.2v-1.4" />
    </svg>
  );
}

export function IconTrash({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8.15 8.15 8.9 19.05A1.7 1.7 0 0 0 10.6 20.6h2.8a1.7 1.7 0 0 0 1.7-1.55l.75-10.9Z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5 8h14M9.2 8V6.25A1.25 1.25 0 0 1 10.45 5h3.1A1.25 1.25 0 0 1 14.8 6.25V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 11.35v5.1M13.4 11.35v5.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
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

export function IconFrontier({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M5 17.5h3.2V8.5H5zM10.4 17.5h3.2V5.5h-3.2zM15.8 17.5H19v-6.2h-3.2z" />
    </svg>
  );
}

export function IconModels({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="8.5" y="4.5" width="7" height="4.5" rx="1.2" />
      <rect x="3.5" y="15" width="6" height="4.5" rx="1.2" />
      <rect x="14.5" y="15" width="6" height="4.5" rx="1.2" />
      <path d="M12 9v3.2M6.5 15v-2.8h11V15" />
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

export function IconSun({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 4.75v1.7M12 17.55v1.7M4.75 12h1.7M17.55 12h1.7M6.55 6.55l1.2 1.2M16.25 16.25l1.2 1.2M17.45 6.55l-1.2 1.2M7.75 16.25l-1.2 1.2" />
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

export function IconSystem({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="4.5" y="5.5" width="15" height="10.5" rx="1.75" />
      <path d="M8.5 18.5h7M12 16v2.5" />
    </svg>
  );
}

export function IconConnect({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="6.5" cy="12" r="2.25" />
      <circle cx="17.5" cy="12" r="2.25" />
      <path d="M8.8 12h6.4" />
    </svg>
  );
}

export function IconUndo({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M9 15H7.2A5.2 5.2 0 1 0 12 9.2" />
      <path d="M12.2 5.8 8.8 9.2l3.4 3.4" />
    </svg>
  );
}

export function IconRedo({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M15 15h1.8A5.2 5.2 0 1 1 12 9.2" />
      <path d="M11.8 5.8 15.2 9.2l-3.4 3.4" />
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

export function IconClose({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}

export function IconCopy({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <rect x="8.5" y="8.5" width="9" height="9" rx="1.5" />
      <path d="M15.5 8.5V7A1.5 1.5 0 0 0 14 5.5H7A1.5 1.5 0 0 0 5.5 7v7A1.5 1.5 0 0 0 7 15.5h1.5" />
    </svg>
  );
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M6.5 12.5 10 16l7.5-8" />
    </svg>
  );
}

export function LogoMark() {
  return <img className="logo-mark" src="/logo.png" alt="" width={28} height={28} />;
}
