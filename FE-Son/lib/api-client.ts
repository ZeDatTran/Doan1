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
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
