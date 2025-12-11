// API configuration and helper functions
const API_BASE_URL = "http://localhost:5000";

import { aggregateEnergyDataByDay } from "./utils";

export interface Device {
  id: string;
  name: string;
  type: "light" | "fan" | "ac" | "sensor" | "camera";
  status: "online" | "offline";
  isOn: boolean;
  location: string;
  lastUpdate: string;
  power?: number; // watts
  voltage?: number; // volts
  current?: number; // amperes
  energyToday?: number; // kWh
  energyTotal?: number; // kWh
  powerFactor?: number; // power factor
}

export interface Alert {
  id: string;
  type: "warning" | "error" | "info" | "success";
  message: string;
  timestamp: string;
  deviceId?: string;
  read: boolean;
}

export interface ActivityLog {
  id: string;
  action: string;
  deviceId?: string;
  deviceName?: string;
  user: string;
  timestamp: string;
  details?: string;
}

export interface EnergyData {
  timestamp: string;
  consumption: number; // kWh
  cost: number;
}

// API functions
export async function fetchDevices(): Promise<Device[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/check-data`);
    if (!response.ok) throw new Error("Failed to fetch devices");
    const result = await response.json();

    // Transform API response to Device format
    if (result.status === "success" && result.data) {
      return (result.data as any[]).map((deviceData: any, index: number) => {
        const attributes = deviceData?.attributes || {};
        const telemetry = deviceData?.telemetry || {};
        const metadata = deviceData?.metadata || {};
        const deviceId = deviceData?.id || `device-${index}`;

        const voltage = parseFloat(telemetry["ENERGY-Voltage"] || "0");
        const status = attributes.POWER === "ON" ? "online" : "offline";
        const isOn = attributes.POWER === "ON";

        return {
          id: deviceId,
          name: metadata.name || deviceData.name || `Smart Device ${index + 1}`,
          type: metadata.type || deviceData.type || "sensor",
          status: status as "online" | "offline",
          isOn,
          location: metadata.location || deviceData.location || "",
          lastUpdate: new Date().toISOString(),
          power: parseFloat(telemetry["ENERGY-Power"] || "0"),
          voltage: voltage,
          current: parseFloat(telemetry["ENERGY-Current"] || "0"),
          energyToday: parseFloat(telemetry["ENERGY-Today"] || "0"),
          energyTotal: parseFloat(telemetry["ENERGY-Total"] || "0"),
          powerFactor: parseFloat(telemetry["ENERGY-Factor"] || "0"),
        };
      });
    }

    return [];
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

export async function controlAllDevices(command: "ON" | "OFF"): Promise<Device[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/control/group/${command}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) throw new Error("Failed to control devices")
    const data = await response.json()
    // Return updated devices based on results
    return (
      data.results?.map((result: any) => ({
        id: result.device_id,
        isOn: command === "ON",
      })) || []
    )
  } catch (error) {
    console.error("Error controlling devices:", error)
    return []
  }
}


export async function fetchEnergyData(
  period: "day" | "week" | "month"
): Promise<EnergyData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/energy?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch energy data");
    
    let data: EnergyData[] = await response.json();
    
    // For week/month views, aggregate hourly data into daily totals
    if ((period === 'week' || period === 'month') && data.length > 50) {
      data = aggregateEnergyDataByDay(data);
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching energy data:", error);
    return [];
  }
}

function getMockLogs(): ActivityLog[] {
  return [
    {
      id: "1",
      action: "Bật thiết bị",
      deviceId: "1",
      deviceName: "Đèn phòng khách",
      user: "Người dùng",
      timestamp: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: "2",
      action: "Tắt thiết bị",
      deviceId: "2",
      deviceName: "Quạt phòng ngủ",
      user: "Người dùng",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "3",
      action: "Tạo quy tắc tự động",
      user: "Người dùng",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: "Bật đèn lúc 18:00",
    },
  ];
}