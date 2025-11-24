"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { DeviceStatusCard } from "@/components/dashboard/device-status-card";
import { Icons } from "@/components/icons";
import { fetchDevices, type Device } from "@/lib/api";

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    const data = await fetchDevices();
    setDevices(data);
    setLoading(false);
  };

  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const activeDevices = devices.filter((d) => d.isOn).length;
  const totalPower = devices.reduce((sum, d) => sum + (d.power || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Tổng quan hệ thống IoT của bạn</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng thiết bị"
          value={devices.length}
          icon={<Icons.devices className="h-6 w-6 text-blue-500" />}
        />
        <StatCard
          title="Đang hoạt động"
          value={activeDevices}
          icon={<Icons.power className="h-6 w-6 text-green-500" />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Đang online"
          value={onlineDevices}
          icon={<Icons.online className="h-6 w-6 text-blue-500" />}
        />
        <StatCard
          title="Tổng công suất"
          value={`${totalPower}W`}
          icon={<Icons.energy className="h-6 w-6 text-yellow-500" />}
          trend={{ value: 8, isPositive: false }}
        />
      </div>

      {/* Devices overview - now full width */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Thiết bị của bạn</h2>
          <span className="text-sm text-muted-foreground">
            {devices.length} thiết bị
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {devices.map((device) => (
            <DeviceStatusCard
              key={device.id}
              device={device}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
