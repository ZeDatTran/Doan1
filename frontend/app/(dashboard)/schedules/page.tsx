"use client"

import { ScheduleList } from "@/components/scheduling/schedule-list"
import { ScheduleEditor } from "@/components/scheduling/schedule-editor"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useUIStore } from "@/lib/store"

export default function SchedulesPage() {
  const { setScheduleEditorOpen } = useUIStore()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedules</h1>
        <Button onClick={() => setScheduleEditorOpen(true)} className="gap-2">
          <Plus size={18} />
          New Schedule
        </Button>
      </div>
      <ScheduleList />
      <ScheduleEditor />
    </div>
  )
}
