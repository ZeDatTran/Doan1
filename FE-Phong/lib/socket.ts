import { io, type Socket } from "socket.io-client"
import { queryClient } from "./api-client"

let socket: Socket | null = null

export function initSocket() {
  if (socket) return socket

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  })

  // Listen for device updates
  socket.on("device_update", (data) => {
    queryClient.setQueryData(["devices"], (oldData: any) => {
      if (!oldData) return oldData
      return oldData.map((device: any) => (device.id === data.id ? { ...device, ...data } : device))
    })
  })

  // Listen for schedule updates
  socket.on("schedule_updated", () => {
    queryClient.invalidateQueries({ queryKey: ["schedules"] })
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
