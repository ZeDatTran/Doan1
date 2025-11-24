// API configuration and helper functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const USE_MOCK_DATA = !API_BASE_URL;

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
  if (USE_MOCK_DATA) {
    return Promise.resolve(getMockDevices());
  }

  try {
    const response = await fetch(`${API_BASE_URL}/check-data`);
    if (!response.ok) throw new Error("Failed to fetch devices");
    const result = await response.json();

    // Transform API response to Device format
    if (result.status === "success" && result.data) {
      let count = 0;
      return (result.data as any[]).map((deviceData: any) => {
        const attributes = deviceData?.attributes || {};
        const telemetry = deviceData?.telemetry || {};
        const deviceId = deviceData?.id || `${++count}`;

        const voltage = parseFloat(telemetry["ENERGY-Voltage"] || "0");
        const status = attributes.POWER === "ON" ? "online" : "offline";
        const isOn = attributes.POWER === "ON";

        return {
          id: deviceId,
          name: `Smart Device ${++count}`,
          type: deviceData.type,
          status: status as "online" | "offline",
          isOn,
          location: deviceData.location,
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
    return getMockDevices();
  }
}

export async function toggleDevice(
  deviceId: string,
  isOn: boolean
): Promise<void> {
  if (USE_MOCK_DATA) {
    console.log(`[Mock] Toggle device ${deviceId} to ${isOn}`);
    return Promise.resolve();
  }

  try {
    await fetch(`${API_BASE_URL}/devices/${deviceId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOn }),
    });
  } catch (error) {
    console.error("Error toggling device:", error);
  }
}

export async function fetchAlerts(): Promise<Alert[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(getMockAlerts());
  }

  try {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (!response.ok) throw new Error("Failed to fetch alerts");
    return await response.json();
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return getMockAlerts();
  }
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    console.log(`[Mock] Mark alert ${alertId} as read`);
    return Promise.resolve();
  }

  try {
    await fetch(`${API_BASE_URL}/alerts/${alertId}/read`, {
      method: "POST",
    });
  } catch (error) {
    console.error("Error marking alert as read:", error);
  }
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(getMockLogs());
  }

  try {
    const response = await fetch(`${API_BASE_URL}/logs`);
    if (!response.ok) throw new Error("Failed to fetch logs");
    return await response.json();
  } catch (error) {
    console.error("Error fetching logs:", error);
    return getMockLogs();
  }
}

export async function fetchEnergyData(
  period: "day" | "week" | "month"
): Promise<EnergyData[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(getMockEnergyData(period));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/energy?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch energy data");
    return await response.json();
  } catch (error) {
    console.error("Error fetching energy data:", error);
    return getMockEnergyData(period);
  }
}

// Mock data for development
function getMockDevices(): Device[] {
  return [
    {
      id: "4e6ac130-af7c-11f0-b5f4-25fce636d3ff",
      name: "Smart plug 1",
      type: "light",
      status: "online",
      isOn: true,
      location: "Phòng khách",
      lastUpdate: new Date().toISOString(),
      power: 17,
      voltage: 321,
      current: 0.108,
      energyToday: 0.077,
      energyTotal: 0.157,
      powerFactor: 0.49,
    },
    {
      id: "b1adb710-af7d-11f0-b5f4-25fce636d3ff",
      name: "Smart plug 2",
      type: "fan",
      status: "online",
      isOn: true,
      location: "Phòng ngủ",
      lastUpdate: new Date().toISOString(),
      power: 10,
      voltage: 319,
      current: 0.024,
      energyToday: 0.101,
      energyTotal: 0.181,
      powerFactor: 0.05,
    },
    {
      id: "be386340-a84d-11f0-b5f4-25fce636d3ff",
      name: "Smart plug 3",
      type: "ac",
      status: "offline",
      isOn: false,
      location: "Phòng làm việc",
      lastUpdate: new Date().toISOString(),
      power: 0,
      voltage: 0,
      current: 0.0,
      energyToday: 0.044,
      energyTotal: 0.044,
      powerFactor: 0.0,
    },
  ];
}

function getMockAlerts(): Alert[] {
  return [
    {
      id: "1",
      type: "warning",
      message: "Tiêu thụ điện vượt ngưỡng 80%",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      read: false,
    },
    {
      id: "2",
      type: "error",
      message: "Camera an ninh mất kết nối",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      deviceId: "5",
      read: false,
    },
    {
      id: "3",
      type: "info",
      message: "Nhiệt độ phòng làm việc: 28°C",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      deviceId: "4",
      read: true,
    },
  ];
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

function getMockEnergyData(period: "day" | "week" | "month"): EnergyData[] {
  const data: EnergyData[] = [];
  const points = period === "day" ? 24 : period === "week" ? 7 : 30;
  const now = new Date();

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now);
    if (period === "day") {
      timestamp.setHours(timestamp.getHours() - i);
    } else if (period === "week") {
      timestamp.setDate(timestamp.getDate() - i);
    } else {
      timestamp.setDate(timestamp.getDate() - i);
    }

    const consumption = Math.random() * 5 + 2; // 2-7 kWh
    data.push({
      timestamp: timestamp.toISOString(),
      consumption,
      cost: consumption * 3000, // 3000 VND per kWh
    });
  }

  return data;
}
