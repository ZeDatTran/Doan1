"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Icons } from "@/components/icons"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ThresholdAlertProps {
  currentConsumption: number
}

export function ThresholdAlert({ currentConsumption }: ThresholdAlertProps) {
  const [enabled, setEnabled] = useState(true)
  const [threshold, setThreshold] = useState("100")
  const [isEditing, setIsEditing] = useState(false)

  const thresholdValue = Number.parseFloat(threshold) || 0
  const percentage = (currentConsumption / thresholdValue) * 100
  const isOverThreshold = currentConsumption >= thresholdValue

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Cảnh báo ngưỡng</CardTitle>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled && isOverThreshold && (
          <Alert variant="destructive">
            <Icons.warning className="h-4 w-4" />
            <AlertDescription>Tiêu thụ điện đã vượt ngưỡng {threshold} kWh!</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tiêu thụ hiện tại</span>
            <span className="font-semibold">{currentConsumption.toFixed(2)} kWh</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                percentage >= 100 ? "bg-red-500" : percentage >= 80 ? "bg-yellow-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ngưỡng cảnh báo</span>
            <span className="font-semibold">{threshold} kWh</span>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="threshold">Ngưỡng cảnh báo (kWh)</Label>
              <Input
                id="threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setIsEditing(false)}>
                Lưu
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Hủy
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => setIsEditing(true)}>
            <Icons.edit className="mr-2 h-4 w-4" />
            Chỉnh sửa ngưỡng
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
