import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="React Dimensions home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 9v14M25 9v14M7 16h18" />
        <path className="arrow" d="M11 13.5 7.5 16 11 18.5M21 13.5l3.5 2.5-3.5 2.5" />
      </svg>
      <span>
        React <b>Dimensions</b>
      </span>
    </Link>
  )
}

const THEME_KEY = 'rd-theme'

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0d0c11' : '#efece4')
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {}
    setTheme(next)
  }
  return [theme, toggle]
}

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="9" cy="9" r="5.8" />
      <path d="m13.5 13.5 4 4" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M16.5 11.8A6.8 6.8 0 0 1 8.2 3.5a6.8 6.8 0 1 0 8.3 8.3Z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1.8a8.2 8.2 0 0 0-2.6 16c.4.1.6-.2.6-.4v-1.5c-2.3.5-2.8-1-2.8-1-.4-1-.9-1.2-.9-1.2-.8-.5.1-.5.1-.5.8.1 1.3.9 1.3.9.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.7-.9-3.7-4 0-.9.3-1.600.9-2.100-.1-.2-.4-1 .1-2.100 0 0 .7-.2 2.200.8a7.600 7.600 0 0 1 4 0c1.500-1 2.200-.8 2.200-.8.4 1.100.2 1.900.1 2.100.5.5.9 1.200.9 2.100 0 3.100-1.900 3.800-3.700 4 .3.3.6.8.6 1.500v2.200c0 .2.2.5.6.4A8.200 8.200 0 0 0 10 1.800Z" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  ),
}
export { Icon }

export function Nav({ onSearch }) {
  const { pathname } = useLocation()
  const [theme, toggleTheme] = useTheme()
  const onLibrary = pathname.startsWith('/library')
  return (
    <header className="nav">
      <button
        className={`icon-btn menu-btn${onLibrary ? ' on-library' : ''}`}
        aria-label="Browse components"
        onClick={() => window.dispatchEvent(new CustomEvent('rd:sidebar'))}
      >
        {Icon.menu}
      </button>
      <Logo />
      <nav className="links">
        <NavLink to="/library">Library</NavLink>
        <Link to="/#primitives">Primitives</Link>
        <Link to="/#models">Models</Link>
        <Link to="/#code">Code</Link>
      </nav>
      <div className="nav-spacer" />
      <button className="search-btn" onClick={onSearch} aria-label="Search components">
        {Icon.search}
        <span>Search…</span>
        <kbd className="kbd">/</kbd>
      </button>
      <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
        {theme === 'dark' ? Icon.sun : Icon.moon}
      </button>
      <a className="icon-btn gh" href="https://github.com/jasonkishore82/3D_Models" target="_blank" rel="noreferrer" aria-label="GitHub">
        {Icon.github}
      </a>
      <Link className="btn btn-small" to="/#access">
        Early access
      </Link>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <Logo />
      <span>Drawn in real time. No image assets were harmed.</span>
      <span>© {new Date().getFullYear()} React Dimensions</span>
    </footer>
  )
}
