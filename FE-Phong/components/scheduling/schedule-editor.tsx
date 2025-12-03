"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useCreateSchedule, useUpdateSchedule, useSchedules } from "@/hooks/use-schedules"
import { useDeviceTree } from "@/hooks/use-devices"
import { useUIStore } from "@/lib/store"
import { X } from "lucide-react"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function ScheduleEditor() {
  const { isScheduleEditorOpen, editingScheduleId, setScheduleEditorOpen } = useUIStore()
  const { data: schedules } = useSchedules()
  const { data: tree } = useDeviceTree()
  const { mutate: createSchedule } = useCreateSchedule()
  const { mutate: updateSchedule } = useUpdateSchedule()

  const [formData, setFormData] = useState({
    name: "",
    targetId: "",
    action: "on" as "on" | "off",
    time: "12:00",
    days: [] as string[],
    enabled: true,
  })

  // Load schedule data if editing
  useEffect(() => {
    if (editingScheduleId && schedules) {
      const schedule = schedules.find((s) => s.id === editingScheduleId)
      if (schedule) {
        setFormData({
          name: schedule.name,
          targetId: schedule.targetId,
          action: schedule.action,
          time: schedule.time,
          days: schedule.days,
          enabled: schedule.enabled,
        })
      }
    } else {
      setFormData({
        name: "",
        targetId: "",
        action: "on",
        time: "12:00",
        days: [],
        enabled: true,
      })
    }
  }, [editingScheduleId, schedules])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.targetId || formData.days.length === 0) {
      alert("Please fill in all required fields")
      return
    }

    if (editingScheduleId) {
      updateSchedule({
        id: editingScheduleId,
        ...formData,
      } as any)
    } else {
      createSchedule(formData)
    }

    setScheduleEditorOpen(false)
  }

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))
  }

  if (!isScheduleEditorOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{editingScheduleId ? "Edit Schedule" : "Create Schedule"}</h2>
          <button onClick={() => setScheduleEditorOpen(false)} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Schedule Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Evening Lights"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Target Device/Group *</label>
            <select
              value={formData.targetId}
              onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a device or group</option>
              {tree?.map((area: any) => (
                <optgroup key={area.id} label={area.name}>
                  {area.children?.map((group: any) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Action *</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as "on" | "off" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="on">Turn ON</option>
                <option value="off">Turn OFF</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Time *</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Days *</label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.days.includes(day)}
                    onChange={() => toggleDay(day)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Enable this schedule
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setScheduleEditorOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              {editingScheduleId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
