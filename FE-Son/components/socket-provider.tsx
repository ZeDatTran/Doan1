"use client"

import { useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { initSocket, disconnectSocket } from "@/lib/socket"

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    initSocket(queryClient)
    return () => {
      disconnectSocket()
    }
  }, [queryClient])

  return <>{children}</>
}
