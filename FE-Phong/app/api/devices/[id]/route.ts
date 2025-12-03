import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  // In a real app, update the database
  console.log(`Updating device ${params.id}:`, body)

  return NextResponse.json({
    id: params.id,
    ...body,
    lastUpdate: new Date().toISOString(),
  })
}
