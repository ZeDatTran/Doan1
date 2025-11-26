"use client"

import { DeviceTable } from "@/components/device-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleList } from "@/components/scheduling/schedule-list"
import { ScheduleEditor } from "@/components/scheduling/schedule-editor"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useUIStore } from "@/lib/store"

export default function Dashboard() {
  const { setScheduleEditorOpen } = useUIStore()

  return (
    <>
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Device Management</h2>
            </div>
            <DeviceTable />
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Schedules</h2>
              <Button onClick={() => setScheduleEditorOpen(true)} className="gap-2">
                <Plus size={18} />
                New Schedule
              </Button>
            </div>
            <ScheduleList />
          </div>
        </TabsContent>
      </Tabs>

      <ScheduleEditor />
    </>
  )
}
