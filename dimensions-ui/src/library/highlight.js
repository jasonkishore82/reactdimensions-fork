// Tiny JSX highlighter: enough for code samples, no dependencies.
const KEYWORDS =
  /^(import|from|export|default|function|return|const|let|var|if|else|for|of|in|new|true|false|null|undefined|typeof|await|async)$/

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][\w.]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*\b)(?=\s*\()|(\b[A-Za-z_$][\w$]*\b)/g

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlight(code) {
  let out = ''
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    out += esc(code.slice(last, m.index))
    const [t, comment, str, tag, num, fn, word] = m
    if (comment) out += `<span class="tk-c">${esc(t)}</span>`
    else if (str) out += `<span class="tk-s">${esc(t)}</span>`
    else if (tag) out += `<span class="tk-p">${esc(t.slice(0, t.startsWith('</') ? 2 : 1))}</span><span class="tk-t">${esc(t.replace(/^<\/?/, ''))}</span>`
    else if (num) out += `<span class="tk-n">${t}</span>`
    else if (fn) out += KEYWORDS.test(fn) ? `<span class="tk-k">${t}</span>` : `<span class="tk-f">${t}</span>`
    else if (word) out += KEYWORDS.test(word) ? `<span class="tk-k">${t}</span>` : esc(t)
    last = m.index + t.length
  }
  return out + esc(code.slice(last))
}
