import { WRAPPERS, sourceFor, usageFor, valueControls } from './registry.jsx'

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

// A prompt to paste into an AI assistant, so it can use or adapt the component.
export function promptFor(comp, current) {
  return `I want to use the "${comp.name}" component from React Dimensions, a library of interactive and 3D React components. Help me add it to my project and customise it.

## What it is
${comp.description}

## Install
\`\`\`bash
${install(comp)}
\`\`\`

## Props (current settings from the docs page)
${propsTable(comp, current)}

## Usage
\`\`\`jsx
${usageFor(comp, current)}
\`\`\`

## Source
Copy these files into my project as they are, keeping the folder layout. Do not rewrite them unless I ask.

${files(comp)}
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
