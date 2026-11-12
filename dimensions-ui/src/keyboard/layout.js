// Key positions for the three layouts, in key units (1u = one standard key,
// about 19 mm). Each key carries the KeyboardEvent.code it answers to, its
// legend (and shifted legend), its size, its row (for the sculpted profile)
// and its kind (alpha, modifier or accent keycap colour).

const k = (code, label, shift = null, w = 1, h = 1) => ({ code, label, shift, w, h })
const gap = (w) => ({ gap: w })

const NUM = [
  k('Backquote', '`', '~'), k('Digit1', '1', '!'), k('Digit2', '2', '@'), k('Digit3', '3', '#'), k('Digit4', '4', '$'),
  k('Digit5', '5', '%'), k('Digit6', '6', '^'), k('Digit7', '7', '&'), k('Digit8', '8', '*'), k('Digit9', '9', '('),
  k('Digit0', '0', ')'), k('Minus', '-', '_'), k('Equal', '=', '+'), k('Backspace', 'Backspace', null, 2),
]
const TOP = [k('Tab', 'Tab', null, 1.5), ...'QWERTYUIOP'.split('').map((c) => k(`Key${c}`, c)), k('BracketLeft', '[', '{'), k('BracketRight', ']', '}'), k('Backslash', '\\', '|', 1.5)]
const HOME = [k('CapsLock', 'Caps Lock', null, 1.75), ...'ASDFGHJKL'.split('').map((c) => k(`Key${c}`, c)), k('Semicolon', ';', ':'), k('Quote', "'", '"'), k('Enter', 'Enter', null, 2.25)]
const SHIFT = [k('ShiftLeft', 'Shift', null, 2.25), ...'ZXCVBNM'.split('').map((c) => k(`Key${c}`, c)), k('Comma', ',', '<'), k('Period', '.', '>'), k('Slash', '/', '?'), k('ShiftRight', 'Shift', null, 2.75)]
const BOTTOM = [
  k('ControlLeft', 'Ctrl', null, 1.25), k('MetaLeft', 'Super', null, 1.25), k('AltLeft', 'Alt', null, 1.25), k('Space', '', null, 6.25),
  k('AltRight', 'Alt', null, 1.25), k('MetaRight', 'Super', null, 1.25), k('ContextMenu', 'Menu', null, 1.25), k('ControlRight', 'Ctrl', null, 1.25),
]
const FROW = [
  k('Escape', 'Esc'), gap(1), ...[1, 2, 3, 4].map((n) => k(`F${n}`, `F${n}`)), gap(0.5),
  ...[5, 6, 7, 8].map((n) => k(`F${n}`, `F${n}`)), gap(0.5), ...[9, 10, 11, 12].map((n) => k(`F${n}`, `F${n}`)),
]
const NAV = [
  [k('PrintScreen', 'PrtSc'), k('ScrollLock', 'ScrLk'), k('Pause', 'Pause')],
  [k('Insert', 'Ins'), k('Home', 'Home'), k('PageUp', 'PgUp')],
  [k('Delete', 'Del'), k('End', 'End'), k('PageDown', 'PgDn')],
  [],
  [gap(1), k('ArrowUp', '↑')],
  [k('ArrowLeft', '←'), k('ArrowDown', '↓'), k('ArrowRight', '→')],
]
const PAD = [
  [],
  [k('NumLock', 'Num'), k('NumpadDivide', '/'), k('NumpadMultiply', '*'), k('NumpadSubtract', '-')],
  [k('Numpad7', '7'), k('Numpad8', '8'), k('Numpad9', '9'), k('NumpadAdd', '+', null, 1, 2)],
  [k('Numpad4', '4'), k('Numpad5', '5'), k('Numpad6', '6')],
  [k('Numpad1', '1'), k('Numpad2', '2'), k('Numpad3', '3'), k('NumpadEnter', 'Enter', null, 1, 2)],
  [k('Numpad0', '0', null, 2), k('NumpadDecimal', '.')],
]

const ACCENT = new Set(['Escape', 'Enter', 'NumpadEnter'])
const ALPHA = /^(Key|Digit|Numpad\d|Backquote|Minus|Equal|Bracket|Backslash|Semicolon|Quote|Comma|Period|Slash|NumpadDecimal)/

export const LAYOUTS = ['60%', 'TKL', 'Full']

// Returns { keys, width, depth }, keys centred on the origin.
export function buildLayout(layout = 'TKL') {
  const full = layout === 'Full'
  const sixty = layout === '60%'
  const keys = []
  const place = (items, x0, row, z) => {
    let x = x0
    for (const it of items) {
      if (it.gap) { x += it.gap; continue }
      const kind = ACCENT.has(it.code) ? 'accent' : ALPHA.test(it.code) && it.w === 1 ? 'alpha' : 'mod'
      keys.push({ ...it, kind, row, x: x + it.w / 2, z: z + it.h / 2 })
      x += it.w
    }
  }
  const main = [NUM, TOP, HOME, SHIFT, BOTTOM]
  const z0 = sixty ? 0 : 1.25
  if (!sixty) place(FROW, 0, 0, 0)
  main.forEach((items, i) => place(items, 0, i + 1, z0 + i))
  if (!sixty) {
    NAV.forEach((items, i) => place(items, 15.25, i, i === 0 ? 0 : z0 + i - 1))
    if (full) PAD.forEach((items, i) => place(items, 18.5, i, i === 0 ? 0 : z0 + i - 1))
  }
  const width = sixty ? 15 : full ? 22.5 : 18.25
  const depth = sixty ? 5 : 6.25
  for (const key of keys) { key.x -= width / 2; key.z -= depth / 2 }
  return { keys, width, depth }
}

// What a click on a key types into the little readout above the board.
export function charOf(key) {
  if (key.code === 'Space') return ' '
  if (key.code.startsWith('Key')) return key.label.toLowerCase()
  if (key.kind === 'alpha') return key.label
  return null
}
