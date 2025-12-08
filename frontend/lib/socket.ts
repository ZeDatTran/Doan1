import { io, type Socket } from "socket.io-client"
import type { QueryClient } from "@tanstack/react-query"

let socket: Socket | null = null
let queryClientInstance: QueryClient | null = null

export function initSocket(queryClient?: QueryClient): Socket {
  if (queryClient) {
    queryClientInstance = queryClient
  }
  
  if (socket) return socket

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000", {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  })

  // Listen for connection
  socket.on('connect', () => {
    console.log('Connected to Socket.IO server')
    socket?.emit('subscribe_devices')
  })

  // Listen for device updates
  socket.on("device_update", (data) => {
    console.log('Device update received:', data)
    queryClientInstance?.setQueryData(["devices"], (oldData: any) => {
      if (!oldData) return oldData
      return oldData.map((device: any) => (device.id === data.device_id ? { ...device, telemetry: data.telemetry, attributes: data.attributes } : device))
    })
  })

  // Listen for schedule updates
  socket.on("schedule_updated", () => {
    queryClientInstance?.invalidateQueries({ queryKey: ["schedules"] })
  })

  socket.on('disconnect', () => {
    console.log('Disconnected from Socket.IO server')
  })

  socket.on('error', (error) => {
    console.error('Socket.IO error:', error)
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
