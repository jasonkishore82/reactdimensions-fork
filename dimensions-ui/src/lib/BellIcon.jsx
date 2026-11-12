// A notification bell icon. Drawn on a 24×24 grid with strokes, so it scales cleanly
// and inherits the surrounding text colour unless `color` is set.
export default function BellIcon({ size = 24, color = 'currentColor', strokeWidth = 1.75, title, style, ...rest }) {
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
      <path d="M18 16v-5a6 6 0 0 0-12 0v5l-1.5 2h15zM10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  )
}
