import { CATEGORIES, COMPONENTS, WRAPPERS, sourceFor, usageFor, valueControls } from './registry.jsx'

const tagOf = (c) => c.files[0].replace(/^.*\//, '').replace(/\.jsx$/, '')

const typeOf = (c) =>
  c.type === 'range' ? 'number' : c.type === 'toggle' ? 'boolean' : c.type === 'select' ? c.options.map((o) => `'${o}'`).join(' | ') : 'string'

const install = (comp) => `npm i ${['react', ...comp.deps].join(' ')}`

// A TypeScript declaration for the component's props, built from its controls.
export function typesFor(comp) {
  const tag = tagOf(comp)
  const lines = valueControls(comp).map((c) => `  /** default: ${JSON.stringify(c.default)}${c.unit ? ` (${c.unit.trim()})` : ''} */\n  ${c.name}?: ${typeOf(c)}`)
  if (WRAPPERS.includes(tag)) lines.unshift('  children?: React.ReactNode')
  lines.push('  /** Height of the preview area, in px or any CSS length. */\n  height?: number | string')
  lines.push('  style?: React.CSSProperties')
  return `import type { CSSProperties, ReactNode } from 'react'\n\nexport interface ${tag}Props {\n${lines.join('\n').replace(/React\.ReactNode/g, 'ReactNode').replace(/React\.CSSProperties/g, 'CSSProperties')}\n}\n\ndeclare const ${tag}: (props: ${tag}Props) => JSX.Element\nexport default ${tag}\n`
}

export function propsTable(comp, current) {
  const rows = valueControls(comp).map((c) => `| \`${c.name}\` | \`${typeOf(c).replace(/\|/g, '\\|')}\` | \`${JSON.stringify(c.default)}\` | \`${JSON.stringify(current[c.name])}\` |`)
  return `| Prop | Type | Default | Current |\n| --- | --- | --- | --- |\n${rows.join('\n')}`
}

const files = (comp) => sourceFor(comp).map((f) => `### ${f.file}\n\n\`\`\`jsx\n${f.code}\n\`\`\``).join('\n\n')

// A one-line description of a prop, from its control (or the control's own
// `description`, when one is given in the registry).
const describe = (c) => {
  if (c.description) return c.description
  const UNITS = { '°': 'degrees', s: 'seconds', ms: 'milliseconds', '%': 'percent' }
  const unit = c.unit ? `, in ${UNITS[c.unit.trim()] ?? c.unit.trim()}` : ''
  switch (c.type) {
    case 'range': return `Number from ${c.min} to ${c.max}${unit}.`
    case 'toggle': return 'Turns this on or off.'
    case 'color': return 'Colour, as any CSS colour.'
    case 'select': return `One of ${c.options.map((o) => `'${o}'`).join(', ')}.`
    case 'textarea': return 'Text; line breaks are kept.'
    case 'image': return 'Image URL or imported image file.'
    default: return 'Text shown in the component.'
  }
}

const cell = (s) => String(s).replace(/\|/g, '\\|')
// defaults as they would be written in code: strings in single quotes
const literal = (v) => (typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : JSON.stringify(v))

function referenceTable(comp) {
  const rows = valueControls(comp).map((c) => `| ${c.name} | ${cell(typeOf(c))} | ${cell(literal(c.default))} | ${cell(describe(c))} |`)
  if (WRAPPERS.includes(tagOf(comp))) rows.unshift('| children | ReactNode | - | Content shown inside the component. |')
  rows.push('| style | CSSProperties | - | Inline styles for the outer element. |')
  return `| Prop | Type | Default | Description |\n|------|------|---------|-------------|\n${rows.join('\n')}`
}

// Every prop written out with its value from the docs page, so the example
// shows the full surface (React Bits style), not only the changed props.
function fullUsage(comp, current) {
  const tag = tagOf(comp)
  const props = valueControls(comp).map((k) => {
    const v = current[k.name] ?? k.default
    if (typeof v === 'boolean') return v ? k.name : `${k.name}={false}`
    if (typeof v === 'number') return `${k.name}={${v}}`
    if (k.type === 'image') return `${k.name}="/your-image.png"`
    if (/["\n\\]/.test(v)) return `${k.name}={${JSON.stringify(v)}}`
    return `${k.name}="${v}"`
  })
  const open = props.length ? `<${tag}\n  ${props.join('\n  ')}\n` : `<${tag}`
  const body = WRAPPERS.includes(tag) ? `${open}>\n  {/* your content */}\n</${tag}>` : `${open}${props.length ? '/>' : ' />'}`
  return `import ${tag} from './${tag}';\n\n${body}`
}

// The short prompt sent by "Open in ChatGPT / Claude" (React Bits style): no
// source inline, just links to the docs page and the component's registry
// JSON (served at /r/<slug>.json), which the assistant fetches for the exact
// source and dependencies. `origin` is the site the visitor is on.
export function openPromptFor(comp, current, origin) {
  const tag = tagOf(comp)
  const json = `${origin}/r/${comp.slug}.json`
  return `Help me add the <${tag} /> component from React Dimensions to my project.

Variant: JS (JavaScript, inline styles)
Docs: ${origin}/library/${comp.slug}
Component source + dependencies (JSON): ${json}

Install it with:
npx shadcn@latest add ${json}

Use this configuration:
${fullUsage(comp, current)}

Please fetch the registry JSON above for the exact source, install any listed dependencies, add the component to my project, and wire it into the right place.
If this is not the right component, the full library index is at ${origin}/llms.txt.
`
}

// A prompt to paste into an AI assistant, laid out like the React Bits
// "Copy for AI" prompt: what it is, usage, props, full source, then steps.
export function promptFor(comp, current) {
  const tag = tagOf(comp)
  const src = sourceFor(comp)
  const multi = src.length > 1
  const deps = comp.deps.length ? comp.deps.join(' ') : 'none (React only)'
  const steps = [
    comp.deps.length ? `Install the dependencies: \`npm i ${comp.deps.join(' ')}\`.` : 'No packages to install beyond React.',
    multi
      ? `Copy every file from the source section into the project, keeping the paths shown: files without a folder (like \`${src[0].file}\`) go together in one folder, and files with a folder (like \`${src.find((f) => f.file.includes('/'))?.file ?? src[1].file}\`) go in a sibling folder of that name, so the relative imports between them resolve.`
      : `Copy the component source into the appropriate directory in the project as \`${src[0].file}\`.`,
    'Styles are inline in the component; there is no separate CSS file to import.',
    `Import and render \`<${tag} />\` using the usage example above as a starting point.`,
    'Adjust props as needed for the specific use case; refer to the props table for every option.',
    "Keep the source as it is unless asked to change it, so it stays in step with the library.",
  ]

  return `## Integrate the <${tag} /> component from React Dimensions

You are helping integrate an open-source React component into an existing application.

### Component: ${tag}
### Variant: JavaScript (JSX), inline styles
### Dependencies: ${deps}

${comp.description}

---

### Usage Example
\`\`\`jsx
${fullUsage(comp, current)}
\`\`\`

### Props
${referenceTable(comp)}

### Full Component Source
${multi ? `${src.length} files.\n\n` : ''}${src.map((f) => `${multi ? `#### ${f.file}\n` : ''}\`\`\`jsx\n${f.code.trimEnd()}\n\`\`\``).join('\n\n')}

### Integration Instructions
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### More from React Dimensions
The library has ${COMPONENTS.filter((c) => CATEGORIES.includes(c.category)).length} components across text, animation, UI and 3D. Browse them at /library on the React Dimensions site if this component is not the right fit or the project needs more pieces.
`
}

export function markdownFor(comp, current) {
  return `# ${comp.name}

${comp.description}

- Category: ${comp.category}
- Dependencies: ${['react', ...comp.deps].join(', ')}

## Install

\`\`\`bash
${install(comp)}
\`\`\`

## Usage

\`\`\`jsx
${usageFor(comp, current)}
\`\`\`

## Props

${propsTable(comp, current)}

## Source

${files(comp)}
`
}

export const sourceText = (comp) => sourceFor(comp).map((f) => `// ===== ${f.file} =====\n${f.code}`).join('\n\n')
