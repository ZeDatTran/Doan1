"use client"

import { useEffect, type ReactNode } from "react"
import { initSocket, disconnectSocket } from "@/lib/socket"

export function SocketProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initSocket()
    return () => {
      disconnectSocket()
    }
  }, [])

  return <>{children}</>
}
