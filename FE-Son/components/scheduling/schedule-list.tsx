"use client"

import { useSchedules, useDeleteSchedule, useUpdateSchedule } from "@/hooks/use-schedules"
import { useUIStore } from "@/lib/store"
import { Trash2, Edit2 } from "lucide-react"

export function ScheduleList() {
  const { data: schedules, isLoading } = useSchedules()
  const { mutate: deleteSchedule } = useDeleteSchedule()
  const { mutate: updateSchedule } = useUpdateSchedule()
  const { setScheduleEditorOpen } = useUIStore()

  const handleEdit = (schedule: any) => {
    setScheduleEditorOpen(true, schedule.id)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteSchedule(id)
    }
  }

  const handleToggleEnabled = (schedule: any) => {
    updateSchedule({ ...schedule, enabled: !schedule.enabled })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Target</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Days</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Enabled</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading schedules...
                </td>
              </tr>
            ) : !schedules || schedules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No schedules created yet
                </td>
              </tr>
            ) : (
              schedules.map((schedule) => (
                <tr key={schedule.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{schedule.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{schedule.targetId}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schedule.action === "on" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      Turn {schedule.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{schedule.time}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{schedule.days.join(", ")}</td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={() => handleToggleEnabled(schedule)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
