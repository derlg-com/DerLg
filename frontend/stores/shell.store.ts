'use client'

import { create } from 'zustand'

interface ShellState {
  /** Network status; updated by the OfflineBanner's window listeners. */
  online: boolean
  setOnline: (online: boolean) => void
  /** Whether the top bar is currently shown (toggled by scroll direction). */
  topBarVisible: boolean
  setTopBarVisible: (visible: boolean) => void
}

export const useShellStore = create<ShellState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
  topBarVisible: true,
  setTopBarVisible: (topBarVisible) => set({ topBarVisible }),
}))
