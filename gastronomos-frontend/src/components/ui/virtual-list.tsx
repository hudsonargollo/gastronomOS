"use client"

import * as React from "react"
import { FixedSizeList as List, VariableSizeList } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  itemHeight?: number | ((index: number) => number)
  height?: number
  width?: number
  className?: string
  loading?: boolean
  loadingCount?: number
  onScroll?: (scrollTop: number) => void
  overscan?: number
  threshold?: number
  onEndReached?: () => void
}

function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 50,
  height = 400,
  width,
  className,
  loading = false,
  loadingCount = 10,
  onScroll,
  overscan = 5,
  threshold = 0.8,
  onEndReached,
}: VirtualListProps<T>) {
  const listRef = React.useRef<any>(null)
  const [isNearEnd, setIsNearEnd] = React.useState(false)

  const handleScroll = React.useCallback(({ scrollTop, scrollHeight, clientHeight }: any) => {
    onScroll?.(scrollTop)
    
    // Check if near end for infinite loading
    if (onEndReached && scrollHeight > 0) {
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
      const nearEnd = scrollPercentage >= threshold
      
      if (nearEnd && !isNearEnd) {
        setIsNearEnd(true)
        onEndReached()
      } else if (!nearEnd && isNearEnd) {
        setIsNearEnd(false)
      }
    }
  }, [onScroll, onEndReached, threshold, isNearEnd])

  const ItemRenderer = React.useCallback(({ index, style }: any) => {
    const item = items[index]
    
    if (!item) {
      return (
        <div style={style} className="p-2">
          <Skeleton className="h-full w-full" />
        </div>
      )
    }

    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    )
  }, [items, renderItem])

  const LoadingRenderer = React.useCallback(({ index, style }: any) => (
    <div style={style} className="p-2">
      <Skeleton className="h-full w-full" />
    </div>
  ), [])

  // Determine if we should use fixed or variable size list
  const isFixedSize = typeof itemHeight === 'number'
  const ListComponent = isFixedSize ? List : VariableSizeList

  if (loading && items.length === 0) {
    return (
      <div className={cn("border rounded-lg", className)} style={{ height, width }}>
        <AutoSizer>
          {({ height: autoHeight, width: autoWidth }) => (
            <List
              height={autoHeight}
              width={autoWidth}
              itemCount={loadingCount}
              itemSize={typeof itemHeight === 'number' ? itemHeight : 50}
              overscanCount={overscan}
            >
              {LoadingRenderer}
            </List>
          )}
        </AutoSizer>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div 
        className={cn("border rounded-lg flex items-center justify-center", className)}
        style={{ height, width }}
      >
        <p className="text-muted-foreground">No items to display</p>
      </div>
    )
  }

  return (
    <div className={cn("border rounded-lg", className)} style={{ height, width }}>
      <AutoSizer>
        {({ height: autoHeight, width: autoWidth }) => (
          <ListComponent
            ref={listRef}
            height={autoHeight}
            width={autoWidth}
            itemCount={items.length}
            itemSize={itemHeight}
            overscanCount={overscan}
            onScroll={handleScroll}
          >
            {ItemRenderer}
          </ListComponent>
        )}
      </AutoSizer>
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
  const handleEndReached = React.useCallback(async () => {
    if (hasNextPage && !isLoadingNextPage && loadNextPage) {
      await loadNextPage()
    }
  }, [hasNextPage, isLoadingNextPage, loadNextPage])

  // Add loading items to the end if loading next page
  const itemsWithLoading = React.useMemo(() => {
    if (isLoadingNextPage) {
      return [...props.items, ...Array(5).fill(null)]
    }
    return props.items
  }, [props.items, isLoadingNextPage])

  const renderItemWithLoading = React.useCallback((item: T | null, index: number) => {
    if (item === null) {
      return (
        <div className="p-2">
          <Skeleton className="h-full w-full" />
        </div>
      )
    }
    return props.renderItem(item, index)
  }, [props.renderItem])

  return (
    <VirtualList
      {...props}
      items={itemsWithLoading}
      renderItem={renderItemWithLoading}
      onEndReached={handleEndReached}
    />
  )
}

export { VirtualList, InfiniteVirtualList }