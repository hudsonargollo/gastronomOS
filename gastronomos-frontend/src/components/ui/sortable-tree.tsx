"use client"

import * as React from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
  SortableContext as SortableContextType,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface TreeItem {
  id: string
  children?: TreeItem[]
  [key: string]: any
}

export interface SortableTreeProps<T extends TreeItem> {
  items: T[]
  onItemsChange: (items: T[]) => void
  renderItem: (item: T, depth: number) => React.ReactNode
  collapsible?: boolean
  indentationWidth?: number
  className?: string
  itemClassName?: string
  dragOverlayClassName?: string
}

interface SortableTreeItemProps<T extends TreeItem> {
  item: T
  depth: number
  renderItem: (item: T, depth: number) => React.ReactNode
  collapsible: boolean
  indentationWidth: number
  itemClassName?: string
  collapsed?: boolean
  onToggle?: (id: string) => void
}

function SortableTreeItem<T extends TreeItem>({
  item,
  depth,
  renderItem,
  collapsible,
  indentationWidth,
  itemClassName,
  collapsed = false,
  onToggle,
}: SortableTreeItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: depth * indentationWidth,
  }

  const hasChildren = item.children && item.children.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center gap-2 py-2 px-3 border-b border-border/50",
        isDragging && "opacity-50",
        itemClassName
      )}
      {...attributes}
    >
      {/* Drag Handle */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 cursor-grab active:cursor-grabbing"
        {...listeners}
      >
        <GripVerticalIcon className="h-4 w-4" />
      </Button>

      {/* Collapse/Expand Button */}
      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onToggle?.(item.id)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Item Content */}
      <div className="flex-1">
        {renderItem(item, depth)}
      </div>
    </div>
  )
}

function SortableTree<T extends TreeItem>({
  items,
  onItemsChange,
  renderItem,
  collapsible = true,
  indentationWidth = 20,
  className,
  itemClassName,
  dragOverlayClassName,
}: SortableTreeProps<T>) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [collapsedItems, setCollapsedItems] = React.useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }

  // Flatten tree for drag and drop
  const flattenTree = (items: T[], depth = 0): Array<T & { depth: number }> => {
    return items.reduce((acc, item) => {
      const flatItem = { ...item, depth }
      acc.push(flatItem)
      
      if (item.children && !collapsedItems.has(item.id)) {
        acc.push(...flattenTree(item.children as T[], depth + 1))
      }
      
      return acc
    }, [] as Array<T & { depth: number }>)
  }

  // Rebuild tree from flat array
  const buildTree = (flatItems: T[]): T[] => {
    const tree: T[] = []
    const itemMap = new Map<string, T>()

    // Create map of all items
    flatItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] })
    })

    // Build tree structure
    flatItems.forEach(item => {
      const treeItem = itemMap.get(item.id)!
      
      // Find parent by checking if any item contains this item in its children
      let parentId: string | null = null
      for (const [id, potentialParent] of itemMap) {
        if (potentialParent.children?.some(child => child.id === item.id)) {
          parentId = id
          break
        }
      }

      if (parentId) {
        const parent = itemMap.get(parentId)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(treeItem)
        }
      } else {
        tree.push(treeItem)
      }
    })

    return tree
  }

  const flatItems = flattenTree(items)
  const sortableIds = flatItems.map(item => item.id)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = flatItems.findIndex(item => item.id === active.id)
      const newIndex = flatItems.findIndex(item => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFlatItems = [...flatItems]
        const [movedItem] = newFlatItems.splice(oldIndex, 1)
        newFlatItems.splice(newIndex, 0, movedItem)

        // Remove depth property before rebuilding tree
        const cleanItems = newFlatItems.map(({ depth, ...item }) => item as T)
        const newTree = buildTree(cleanItems)
        onItemsChange(newTree)
      }
    }

    setActiveId(null)
  }

  const handleToggle = (id: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const activeItem = activeId ? flatItems.find(item => item.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={measuring}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className={cn("border rounded-lg overflow-hidden", className)}>
          {flatItems.map((item) => (
            <SortableTreeItem
              key={item.id}
              item={item}
              depth={item.depth}
              renderItem={renderItem}
              collapsible={collapsible}
              indentationWidth={indentationWidth}
              itemClassName={itemClassName}
              collapsed={collapsedItems.has(item.id)}
              onToggle={handleToggle}
            />
          ))}
          
          {flatItems.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No items to display
            </div>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <div
            className={cn(
              "bg-background border rounded-lg shadow-lg",
              dragOverlayClassName
            )}
          >
            <SortableTreeItem
              item={activeItem}
              depth={0}
              renderItem={renderItem}
              collapsible={false}
              indentationWidth={indentationWidth}
              itemClassName={itemClassName}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export { SortableTree }