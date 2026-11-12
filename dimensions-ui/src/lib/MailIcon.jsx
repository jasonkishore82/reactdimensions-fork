// An envelope / mail icon. Drawn on a 24×24 grid with strokes, so it scales cleanly
// and inherits the surrounding text colour unless `color` is set.
export default function MailIcon({ size = 24, color = 'currentColor', strokeWidth = 1.75, title, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', ...style }}
      {...rest}
    >
      {title && <title>{title}</title>}
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}
