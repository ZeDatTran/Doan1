"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocket, initSocket } from "@/lib/socket";

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

    useEffect(() => {
        // Get or initialize socket
        let socketInstance = getSocket();
        if (!socketInstance) {
            socketInstance = initSocket();
        }

        setSocket(socketInstance);

        // Lắng nghe trạng thái kết nối
        const handleConnect = () => {
            console.log("Socket context: Connected");
            setIsConnected(true);
        };

        const handleDisconnect = () => {
            console.log("Socket context: Disconnected");
            setIsConnected(false);
        };

        socketInstance.on("connect", handleConnect);
        socketInstance.on("disconnect", handleDisconnect);

        // Set initial connection state
        setIsConnected(socketInstance.connected);

        // Cleanup khi component unmount
        return () => {
            socketInstance.off("connect", handleConnect);
            socketInstance.off("disconnect", handleDisconnect);
        };
    }, []);

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
