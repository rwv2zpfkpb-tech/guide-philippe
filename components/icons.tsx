// Small set of monochrome, stroke-based icons (Heroicons-outline style,
// 24×24 viewBox, currentColor) used to replace decorative pictographic
// emojis across the app. The spoon-rating glyphs in lib/ratings.ts are the
// only emoji left by design — everything else uses these instead so it
// stays legible/consistent in both themes.

type IconProps = { size?: number; className?: string };

function Icon({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Icon>
  );
}

export function IconEmptyState(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5.25-3.75h.008v.008h-.008V8.25Zm-6.75 0h.008v.008H9V8.25Z" />
    </Icon>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </Icon>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 12.75 2.25 2.25 4.5-4.5m5.25 2.25a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </Icon>
  );
}

export function IconWarningTriangle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </Icon>
  );
}

export function IconBlocked(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </Icon>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </Icon>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </Icon>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
    </Icon>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.804a1.125 1.125 0 0 0-1.006 0L3.622 6.24C3.24 6.43 3 6.82 3 7.246V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </Icon>
  );
}

export function IconList(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </Icon>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </Icon>
  );
}
