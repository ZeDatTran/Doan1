"use client"

import type { ReactNode } from "react"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { SocketProvider } from "./socket-provider"

// Create a client
const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>{children}</SocketProvider>
    </QueryClientProvider>
  )
}
