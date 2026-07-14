'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function ProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [width, setWidth] = useState(0)
  const prevUrl = useRef(pathname + searchParams.toString())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearAll() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function start() {
    clearAll()
    setPhase('loading')
    setWidth(0)
    timers.current.push(setTimeout(() => setWidth(70), 16))
  }

  function finish() {
    clearAll()
    setWidth(100)
    setPhase('done')
    timers.current.push(setTimeout(() => {
      setPhase('idle')
      setWidth(0)
    }, 550))
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!link) return
      try {
        const url = new URL(link.href, location.href)
        if (url.origin !== location.origin) return
        const next = url.pathname + url.search
        if (next === prevUrl.current) return
        start()
      } catch { /* ignore */ }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentUrl = pathname + searchParams.toString()
  useEffect(() => {
    if (currentUrl !== prevUrl.current) {
      prevUrl.current = currentUrl
      finish()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl])

  if (phase === 'idle') return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '2px',
        width: `${width}%`,
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'linear-gradient(90deg, var(--c-burg), var(--c-gold))',
        boxShadow: '0 0 10px var(--c-gold-mid)',
        opacity: phase === 'done' ? 0 : 1,
        transition: phase === 'loading'
          ? 'width 2s cubic-bezier(0.16, 1, 0.3, 1)'
          : 'width 0.2s ease, opacity 0.35s ease 0.15s',
      }}
    />
  )
}

export default function NavigationProgress() {
  return (
    <Suspense>
      <ProgressBar />
    </Suspense>
  )
}
