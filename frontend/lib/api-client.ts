// API Client for FE-Son - Communicates with Flask Backend
// Base URL for the backend API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Types for device data from backend
 */
export interface DeviceAttributes {
  POWER?: string;
  [key: string]: any;
}

export interface DeviceTelemetry {
  'ENERGY-Voltage'?: number | string;
  'ENERGY-Current'?: number | string;
  'ENERGY-Power'?: number | string;
  'ENERGY-Today'?: number | string;
  'ENERGY-Total'?: number | string;
  'ENERGY-Factor'?: number | string;
  [key: string]: any;
}

export interface Device {
  type: string;
  location: string;
  id: string;
  attributes: DeviceAttributes;
  telemetry: DeviceTelemetry;
}

export interface DeviceCheckDataResponse {
  status: 'success' | 'error';
  message?: string;
  data?: Device[];
}

export interface ControlResponse {
  status: 'success' | 'error' | 'partial_failure';
  message?: string;
  device_id?: string;
  command_sent?: string;
  total_devices?: number;
  results?: ControlResponse[];
}

/**
 * Fetch all devices from the backend
 * GET /check-data
 */
export async function fetchDevices(): Promise<Device[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/check-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch devices: ${response.statusText}`
      );
    }

    const data: DeviceCheckDataResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to fetch devices');
    }

    return data.data || [];
  } catch (error) {
    console.error('Error fetching devices:', error);
    throw error;
  }
}

/**
 * Control a specific device
 * POST /control/<device_id>/<command>
 * @param deviceId - The ID of the device to control
 * @param command - The command to send ('on' or 'off')
 */
export async function controlDevice(
  deviceId: string,
  command: 'on' | 'off'
): Promise<ControlResponse> {
  try {
    const commandLower = command.toLowerCase();
    
    if (!['on', 'off'].includes(commandLower)) {
      throw new Error('Invalid command. Only "on" or "off" are allowed.');
    }

    // Create an AbortController with 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `${API_BASE_URL}/control/${deviceId}/${commandLower}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      const data: ControlResponse = await response.json().catch(() => ({
        status: 'error' as const,
        message: 'Failed to parse server response'
      }));

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to control device: ${response.statusText}`
        );
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Device control request timed out after 30 seconds for device ${deviceId}`);
      throw new Error('Request timed out. The device may be unresponsive. Please try again.');
    }
    console.error(`Error controlling device ${deviceId}:`, error);
    throw error;
  }
}

/**
 * Control all devices in a group
 * POST /control/group/<command>
 * @param command - The command to send ('on' or 'off')
 */
export async function controlGroupDevices(
  command: 'on' | 'off'
): Promise<ControlResponse> {
  try {
    const commandLower = command.toLowerCase();
    
    if (!['on', 'off'].includes(commandLower)) {
      throw new Error('Invalid command. Only "on" or "off" are allowed.');
    }

    // Create an AbortController with 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `${API_BASE_URL}/control/group/${commandLower}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      const data: ControlResponse = await response.json().catch(() => ({
        status: 'error' as const,
        message: 'Failed to parse server response'
      }));

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to control group: ${response.statusText}`
        );
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Group control request timed out after 30 seconds`);
      throw new Error('Request timed out. Devices may be unresponsive. Please try again.');
    }
    console.error('Error controlling group devices:', error);
    throw error;
  }
}

/**
 * Check if the backend API is accessible
 * GET /check-token
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/check-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error checking API health:', error);
    return false;
  }
}

/**
 * Fetch a single device by ID
 * GET /device/<device_id>
 */
export async function fetchDeviceById(deviceId: string): Promise<Device | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/device/${deviceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Fallback: Get all devices and find by ID
      const devices = await fetchDevices();
      return devices.find(d => d.id === deviceId) || null;
    }

    const data = await response.json();
    return data.device || data;
  } catch (error) {
    console.error(`Error fetching device ${deviceId}:`, error);
    // Fallback: Get all devices and find by ID
    try {
      const devices = await fetchDevices();
      return devices.find(d => d.id === deviceId) || null;
    } catch {
      return null;
    }
  }
}

/**
 * Device history data point
 */
export interface DeviceHistoryPoint {
  timestamp: string;
  power: number;
  voltage: number;
  current: number;
  energy: number;
}

/**
 * Fetch device history data for charts
 * GET /device/<device_id>/history?period=day|week|month
 */
export async function fetchDeviceHistory(
  deviceId: string, 
  period: string = 'day'
): Promise<DeviceHistoryPoint[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/device/${deviceId}/history?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Device history API not available, using mock data`);
      return generateMockHistory(period);
    }

    const data = await response.json();
    return data.history || data || [];
  } catch (error) {
    console.error(`Error fetching device history for ${deviceId}:`, error);
    // Return mock data for demo purposes
    return generateMockHistory(period);
  }
}

/**
 * Generate mock history data for demo/fallback
 */
function generateMockHistory(period: string): DeviceHistoryPoint[] {
  const now = new Date();
  const points: DeviceHistoryPoint[] = [];
  
  let count = 24; // Default for day
  let intervalMinutes = 60;
  
  if (period === 'week') {
    count = 168; // 7 days * 24 hours
    intervalMinutes = 60;
  } else if (period === 'month') {
    count = 720; // 30 days * 24 hours
    intervalMinutes = 60;
  }

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
    const hour = timestamp.getHours();
    
    // Generate realistic values based on time of day
    let basePower = 50;
    if (hour >= 6 && hour < 9) basePower = 150; // Morning
    else if (hour >= 9 && hour < 17) basePower = 80; // Day
    else if (hour >= 17 && hour < 22) basePower = 200; // Evening peak
    else basePower = 30; // Night
    
    const power = basePower + (Math.random() - 0.5) * 40;
    const voltage = 220 + (Math.random() - 0.5) * 10;
    const current = power / voltage;
    
    points.push({
      timestamp: timestamp.toISOString(),
      power: Math.max(0, power),
      voltage: voltage,
      current: Math.max(0, current),
      energy: Math.max(0, power * (intervalMinutes / 60) / 1000), // kWh
    });
  }
  
  return points;
}

/**
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
