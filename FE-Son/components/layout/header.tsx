"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchAlerts,
  fetchActivityLogs,
  markAlertAsRead,
  type Alert,
  type ActivityLog,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<"alerts" | "logs">("alerts");

  useEffect(() => {
    loadAlerts();
    loadLogs();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadAlerts();
      loadLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    const data = await fetchAlerts();
    setAlerts(data);
  };

  const loadLogs = async () => {
    const data = await fetchActivityLogs();
    setLogs(data);
  };

  const handleMarkAsRead = async (alertId: string) => {
    await markAlertAsRead(alertId);
    setAlerts(alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return <Icons.error className="h-4 w-4 text-red-500" />;
      case "warning":
        return <Icons.warning className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <Icons.success className="h-4 w-4 text-green-500" />;
      default:
        return <Icons.info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Icons.home className="h-5 w-5 text-white" />
          </div>
          <span className="hidden font-semibold text-lg sm:inline-block">
            IoT Manager
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/energy"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Energy
          </Link>
          <Link
            href="/monitor"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Monitor
          </Link>
          <Link
            href="/schedules"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Schedules
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Alerts & Logs Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Icons.bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-background border border-border shadow-lg z-50"
              sideOffset={5}
            >
              <div className="flex border-b border-border bg-background">
                <button
                  onClick={() => setActiveTab("alerts")}
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === "alerts"
                      ? "border-b-2 border-blue-600 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cảnh báo ({unreadCount})
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === "logs"
                      ? "border-b-2 border-blue-600 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Nhật ký
                </button>
              </div>

              <ScrollArea className="h-[400px] bg-background">
                {activeTab === "alerts" ? (
                  <div className="p-2">
                    {alerts.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Không có cảnh báo nào
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "mb-2 rounded-lg border p-3 transition-colors hover:bg-accent",
                            !alert.read && "bg-blue-500/5 border-blue-500/20"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1 space-y-1">
                              <p className="text-sm leading-relaxed">
                                {alert.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(alert.timestamp)}
                              </p>
                            </div>
                            {!alert.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(alert.id)}
                                className="h-6 px-2 text-xs"
                              >
                                Đánh dấu đã đọc
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="p-2">
                    {logs.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Không có nhật ký nào
                      </div>
                    ) : (
                      logs.map((log) => (
                        <div
                          key={log.id}
                          className="mb-2 rounded-lg border p-3 hover:bg-accent transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {log.action}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(log.timestamp)}
                              </p>
                            </div>
                            {log.deviceName && (
                              <p className="text-xs text-muted-foreground">
                                Thiết bị: {log.deviceName}
                              </p>
                            )}
                            {log.details && (
                              <p className="text-xs text-muted-foreground">
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <Icons.close className="h-5 w-5" />
            ) : (
              <Icons.menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container flex flex-col gap-2 py-4 px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icons.home className="h-4 w-4" />
              Dashboard
            </Link>
            {/* <Link
              href="/devices"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icons.devices className="h-4 w-4" />
              Thiết bị
            </Link>
            <Link
              href="/scheduling"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icons.schedule className="h-4 w-4" />
              Lập lịch
            </Link> */}
            <Link
              href="/energy"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icons.energy className="h-4 w-4" />
              Điện năng
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
