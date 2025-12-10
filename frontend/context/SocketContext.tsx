"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket, disconnectSocket } from "@/lib/socket";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Initialize socket once with QueryClient
        const socketInstance = initSocket(queryClient);
        setSocket(socketInstance);

        // Listen to connection state
        const handleConnect = () => {
            console.log("Socket connected");
            setIsConnected(true);
        };

        const handleDisconnect = () => {
            console.log("Socket disconnected");
            setIsConnected(false);
        };

        socketInstance.on("connect", handleConnect);
        socketInstance.on("disconnect", handleDisconnect);

        // Set initial connection state
        setIsConnected(socketInstance.connected);

        // Cleanup on unmount
        return () => {
            socketInstance.off("connect", handleConnect);
            socketInstance.off("disconnect", handleDisconnect);
            disconnectSocket();
        };
    }, [queryClient]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within SocketProvider");
    }
    return context;
}
