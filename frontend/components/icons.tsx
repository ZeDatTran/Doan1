import {
  Lightbulb,
  Fan,
  AirVent,
  Thermometer,
  Camera,
  Power,
  PowerOff,
  Wifi,
  WifiOff,
  Bell,
  Clock,
  Zap,
  Settings,
  Home,
  Calendar,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Menu,
  X,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

export const Icons = {
  // Device types
  light: Lightbulb,
  fan: Fan,
  ac: AirVent,
  sensor: Thermometer,
  camera: Camera,

  // Status
  power: Power,
  powerOff: PowerOff,
  online: Wifi,
  offline: WifiOff,

  // Navigation
  home: Home,
  devices: Settings,
  schedule: Calendar,
  energy: Zap,
  activity: Activity,

  // Actions
  bell: Bell,
  clock: Clock,
  menu: Menu,
  close: X,
  plus: Plus,
  edit: Edit,
  trash: Trash2,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,

  // Alerts
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  success: CheckCircle,

  // Charts
  chart: BarChart3,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
}
