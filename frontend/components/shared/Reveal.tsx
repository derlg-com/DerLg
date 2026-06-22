'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}

/**
 * Reveals children with a subtle fade + slide-up when they scroll into view.
 * Honors prefers-reduced-motion (renders statically) and never sets state in an
 * effect (motion handles the in-view transition internally).
 */
export function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
