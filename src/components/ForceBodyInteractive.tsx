'use client'
import { useEffect } from 'react'

export function ForceBodyInteractive() {
  useEffect(() => {
    const id = setInterval(() => {
      document.body.style.pointerEvents = 'auto'
      document.body.removeAttribute('data-scroll-locked')
    }, 50)

    return () => clearInterval(id)
  }, [])

  return null
}
