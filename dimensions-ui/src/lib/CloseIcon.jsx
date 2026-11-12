// A close / dismiss (×) icon. Drawn on a 24×24 grid with strokes, so it scales cleanly
// and inherits the surrounding text colour unless `color` is set.
export default function CloseIcon({ size = 24, color = 'currentColor', strokeWidth = 1.75, title, style, ...rest }) {
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
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
