import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset', 'slate', 'violet']

const STORAGE_KEY = 'aegisflow-theme'
// Tracks whether the user has explicitly picked a theme themselves, as
// opposed to just inheriting whatever the company's default is — so a
// company changing its default theme later doesn't get silently
// overridden by a stale localStorage value nobody ever chose on purpose.
const EXPLICIT_KEY = 'aegisflow-theme-explicit'

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // User explicitly picks a theme (Header dropdown, or Settings for the
  // company default) — persists and is never silently overridden again.
  const setTheme = (name) => {
    if (!THEMES.includes(name)) return
    setThemeState(name)
    localStorage.setItem(STORAGE_KEY, name)
    localStorage.setItem(EXPLICIT_KEY, '1')
  }

  // Called once the company's default theme is known (after login). Only
  // takes effect if this browser has never had an explicit user choice.
  const applyCompanyDefaultTheme = (name) => {
    if (!name || !THEMES.includes(name)) return
    if (localStorage.getItem(EXPLICIT_KEY)) return
    setThemeState(name)
    localStorage.setItem(STORAGE_KEY, name)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, applyCompanyDefaultTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}
