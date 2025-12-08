"use client"

import type { ReactNode } from "react"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { SocketProvider as SocketIOProvider } from "./socket-provider"
import { SocketProvider } from "@/context/SocketContext"
import { ThemeProvider } from "./theme-provider"

// Create a client
const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketIOProvider>
        <SocketProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </SocketProvider>
      </SocketIOProvider>
    </QueryClientProvider>
  )
}
