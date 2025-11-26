import { create } from "zustand"

interface UIState {
  selectedAreaId: string | null
  isScheduleEditorOpen: boolean
  editingScheduleId: string | null
  isSidebarCollapsed: boolean
  setSelectedAreaId: (id: string | null) => void
  setScheduleEditorOpen: (open: boolean, scheduleId?: string | null) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedAreaId: null,
  isScheduleEditorOpen: false,
  editingScheduleId: null,
  isSidebarCollapsed: false,
  setSelectedAreaId: (id) => set({ selectedAreaId: id }),
  setScheduleEditorOpen: (open, scheduleId = null) =>
    set({ isScheduleEditorOpen: open, editingScheduleId: scheduleId }),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
}))
