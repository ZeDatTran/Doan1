"use client"

import { useState } from "react"
import { useDeviceTree } from "@/hooks/use-devices"
import { useUIStore } from "@/lib/store"
import { ChevronDown, Menu, X } from "lucide-react"

interface TreeNode {
  id: string
  name: string
  type: "area" | "group" | "device"
  children?: TreeNode[]
}

export function Sidebar() {
  const { data: tree, isLoading } = useDeviceTree()
  const { selectedAreaId, setSelectedAreaId, isSidebarCollapsed, setSidebarCollapsed } = useUIStore()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedNodes(newExpanded)
  }

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-100 ${
            selectedAreaId === node.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 16}px` }}
          onClick={() => {
            if (node.type === "area") {
              setSelectedAreaId(node.id)
            }
            if (node.children?.length) {
              toggleNode(node.id)
            }
          }}
        >
          {node.children?.length ? (
            <ChevronDown
              size={16}
              className={`transition-transform ${expandedNodes.has(node.id) ? "rotate-0" : "-rotate-90"}`}
            />
          ) : (
            <div className="w-4" />
          )}
          <span className="text-sm font-medium">{node.name}</span>
        </div>
        {expandedNodes.has(node.id) && node.children && renderTree(node.children, depth + 1)}
      </div>
    ))
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white border rounded-lg"
      >
        {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform ${
          isSidebarCollapsed ? "-translate-x-full md:translate-x-0" : ""
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold">Device Manager</h1>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : tree ? (
          <div className="py-2">{renderTree(tree)}</div>
        ) : null}
      </aside>
    </>
  )
}
