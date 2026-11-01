import { useCallback, useEffect, useState } from 'react'

export type RouteKey = 'dashboard' | 'hosts' | 'aliases' | 'bindings' | 'points' | 'transfers' | 'shop' | 'season' | 'data' | 'settings' | 'audit'

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  return { path: (path || 'dashboard') as RouteKey, params: new URLSearchParams(query) }
}

export function navigate(path: string) {
  window.location.hash = `/${path}`
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const h = () => setRoute(parse())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return { ...route, navigate: useCallback(navigate, []) }
}
