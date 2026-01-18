import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  height?: number | string
  width?: number | string
  itemHeight?: number | ((index: number) => number)
  className?: string
  loading?: boolean
  loadingItemCount?: number
  overscan?: number
  threshold?: number
  onEndReached?: () => void
}

function VirtualList<T>({
  items,
  renderItem,
  height = 400,
  width = "100%",
  className,
  loading = false,
  loadingItemCount = 10,
}: VirtualListProps<T>) {
  if (loading && items.length === 0) {
    return (
      <div className={cn("border rounded-lg", className)} style={{ height, width }}>
        <div className="p-4 space-y-2">
          {Array.from({ length: loadingItemCount }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("border rounded-lg overflow-auto", className)} style={{ height, width }}>
      <div className="p-2">
        {items.map((item, index) => (
          <div key={index} className="mb-2">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

export interface InfiniteVirtualListProps<T> extends VirtualListProps<T> {
  hasNextPage?: boolean
  loadNextPage?: () => Promise<void>
  isLoadingNextPage?: boolean
}

function InfiniteVirtualList<T>({
  hasNextPage = false,
  loadNextPage,
  isLoadingNextPage = false,
  ...props
}: InfiniteVirtualListProps<T>) {
  return <VirtualList {...props} />
}

export { VirtualList, InfiniteVirtualList }