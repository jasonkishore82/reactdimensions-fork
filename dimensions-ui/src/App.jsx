import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Footer, Nav } from './Nav.jsx'
import SearchDialog from './SearchDialog.jsx'
import Landing from './Landing.jsx'
import Library, { CategoryPage } from './library/Library.jsx'
import { COMPONENTS } from './library/registry.jsx'

export default function App() {
  const [search, setSearch] = useState(false)

  // "/" or Ctrl/Cmd+K opens the search from anywhere
  useEffect(() => {
    const on = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  return (
    <>
      <div className="paper" aria-hidden="true" />
      <Nav onSearch={() => setSearch(true)} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/library" element={<Navigate to={`/library/${COMPONENTS[0].slug}`} replace />} />
        <Route path="/library/c/:cat" element={<CategoryPage />} />
        <Route path="/library/:slug" element={<Library />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </>
  )
}
