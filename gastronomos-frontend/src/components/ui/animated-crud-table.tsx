"use client"

import * as React from "react"
import { motion, AnimatePresence, Variants } from "framer-motion"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MoreHorizontalIcon,
  DownloadIcon,
  FilterIcon,
  SearchIcon,
  EyeIcon,
  EyeOffIcon,
  Trash2Icon,
  EditIcon,
  PlusIcon,
  CopyIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { EnhancedCRUDHook } from "@/hooks/use-crud"
import { listItemVariants, staggerContainer, fadeInOut } from "@/lib/animation-utils"

interface AnimatedCRUDTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[]
  crudHook: EnhancedCRUDHook<TData>
  searchable?: boolean
  searchPlaceholder?: string
  sortable?: boolean
  filterable?: boolean
  selectable?: boolean
  pagination?: boolean
  pageSize?: number
  onRowClick?: (row: TData) => void
  onEdit?: (row: TData) => void
  onView?: (row: TData) => void
  addLabel?: string
  emptyMessage?: string
  className?: string
  rowClassName?: (row: TData) => string
  enableRowSelection?: boolean
  enableBulkOperations?: boolean
  enableExport?: boolean
  enableDuplicate?: boolean
  bulkOperationProgress?: number
  onCreateNew?: () => void
  onEditItem?: (item: TData) => void
}

// Animation variants for table elements
const tableVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.05
    }
  },
  exit: { opacity: 0, y: -20 }
}

const rowVariants: Variants = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  },
  exit: { 
    opacity: 0, 
    x: 20, 
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  },
  hover: {
    scale: 1.01,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
}

const actionButtonVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 }
}

function AnimatedCRUDTable<TData extends { id: string }, TValue>({
  columns,
  crudHook,
  searchable = true,
  searchPlaceholder = "Search...",
  sortable = true,
  filterable = true,
  selectable = true,
  pagination = true,
  pageSize = 10,
  onRowClick,
  onEdit,
  onView,
  addLabel = "Add New",
  emptyMessage = "No results found.",
  className,
  rowClassName,
  enableRowSelection = true,
  enableBulkOperations = true,
  enableExport = true,
  enableDuplicate = true,
  bulkOperationProgress,
  onCreateNew,
  onEditItem,
}: AnimatedCRUDTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<TData | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false)
  const [bulkOperationInProgress, setBulkOperationInProgress] = React.useState(false)

  const {
    data = [],
    loading,
    error,
    isAnimating,
    animationQueue,
    pendingOperations,
    create,
    update,
    delete: deleteItem,
    bulkDelete,
    bulkUpdate,
    duplicate,
    exportData,
    refresh,
    clearAnimationQueue,
  } = crudHook

  // Add selection column if selectable
  const tableColumns = React.useMemo(() => {
    if (!selectable || !enableRowSelection) return columns

    const selectionColumn: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table }) => (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </motion.div>
      ),
      cell: ({ row }) => (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </motion.div>
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [selectionColumn, ...columns]
  }, [columns, selectable, enableRowSelection])

  // Add actions column if any action handlers are provided
  const finalColumns = React.useMemo(() => {
    if (!onEdit && !deleteItem && !onView && !duplicate) return tableColumns

    const actionsColumn: ColumnDef<TData, TValue> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original
        const isItemPending = pendingOperations.has(`update-${item.id}`) || 
                             pendingOperations.has(`delete-${item.id}`)

        return (
          <motion.div
            variants={actionButtonVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  disabled={isItemPending}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {typeof onView === 'function' && (
                  <DropdownMenuItem onClick={() => onView(item)}>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                {(typeof onEdit === 'function' || typeof onEditItem === 'function') && (
                  <DropdownMenuItem onClick={() => onEdit ? onEdit(item) : onEditItem?.(item)}>
                    <EditIcon className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {enableDuplicate && typeof duplicate === 'function' && (
                  <DropdownMenuItem onClick={() => handleDuplicate(item.id)}>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {deleteItem && typeof deleteItem === 'function' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setItemToDelete(item)
                        setDeleteDialogOpen(true)
                      }}
                      className="text-red-600"
                    >
                      <Trash2Icon className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    }

    return [...tableColumns, actionsColumn]
  }, [tableColumns, onEdit, onEditItem, deleteItem, onView, duplicate, enableDuplicate, pendingOperations])

  const table = useReactTable({
    data,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const hasSelection = selectedRows.length > 0

  const handleDelete = async () => {
    if (!itemToDelete || !deleteItem) return

    try {
      await deleteItem(itemToDelete.id)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!bulkDelete || selectedRows.length === 0) return

    setBulkOperationInProgress(true)
    try {
      await bulkDelete(selectedRows.map(row => row.original.id))
      setRowSelection({})
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setBulkDeleteDialogOpen(false)
      setBulkOperationInProgress(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    if (!duplicate) return
    
    try {
      await duplicate(id)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    if (!exportData) return
    
    const selectedIds = hasSelection 
      ? selectedRows.map(row => row.original.id)
      : undefined
    
    exportData(format, selectedIds)
  }

  const handleRefresh = async () => {
    try {
      await refresh()
      clearAnimationQueue()
    } catch (error) {
      toast.error('Failed to refresh data')
    }
  }

  if (loading && data.length === 0) {
    return (
      <motion.div 
        className="space-y-4"
        variants={fadeInOut}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[250px]" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
        </div>
        <div className="rounded-md border">
          <div className="p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div 
                key={i} 
                className="flex items-center space-x-4 py-2"
                variants={listItemVariants}
              >
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[100px]" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className={className}
      variants={tableVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          {searchable && (
            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(String(event.target.value))}
                className="pl-8 max-w-sm"
              />
            </motion.div>
          )}
          
          {filterable && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon className="mr-2 h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </motion.div>
        </div>

        <div className="flex items-center space-x-2">
          {hasSelection && enableBulkOperations && typeof bulkDelete === 'function' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={bulkOperationInProgress}
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Delete ({selectedRows.length})
              </Button>
            </motion.div>
          )}
          
          {enableExport && typeof exportData === 'function' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}
          
          {(typeof create === 'function' || typeof onCreateNew === 'function') && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              variants={actionButtonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Button 
                size="sm" 
                onClick={onCreateNew}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                {addLabel}
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Selection Info */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div 
            className="flex items-center justify-between py-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {selectedRows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRowSelection({})}
              >
                Clear selection
              </Button>
            </div>
            {bulkOperationProgress !== undefined && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <Progress value={bulkOperationProgress} className="w-32" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animation Status */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="flex items-center space-x-2 py-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Processing {animationQueue.length} operation(s)...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div 
        className="rounded-md border"
        variants={fadeInOut}
      >
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <motion.tr 
                key={headerGroup.id} 
                className="border-b"
                variants={listItemVariants}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : (
                        <motion.div
                          className={
                            header.column.getCanSort()
                              ? "flex items-center space-x-2 cursor-pointer select-none hover:text-foreground"
                              : "flex items-center space-x-2"
                          }
                          onClick={header.column.getToggleSortingHandler()}
                          whileHover={header.column.getCanSort() ? { scale: 1.02 } : {}}
                          whileTap={header.column.getCanSort() ? { scale: 0.98 } : {}}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sortable && header.column.getCanSort() && (
                            <motion.div 
                              className="flex flex-col"
                              animate={{
                                rotate: header.column.getIsSorted() === "desc" ? 180 : 0
                              }}
                              transition={{ type: "spring", stiffness: 300 }}
                            >
                              {header.column.getIsSorted() === "desc" ? (
                                <ArrowDownIcon className="h-4 w-4" />
                              ) : header.column.getIsSorted() === "asc" ? (
                                <ArrowUpIcon className="h-4 w-4" />
                              ) : (
                                <ArrowUpDownIcon className="h-4 w-4" />
                              )}
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </th>
                  )
                })}
              </motion.tr>
            ))}
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => {
                  const isRowPending = pendingOperations.has(`update-${row.original.id}`) || 
                                      pendingOperations.has(`delete-${row.original.id}`)
                  
                  return (
                    <motion.tr
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={`border-b transition-colors data-[state=selected]:bg-muted ${
                        rowClassName ? rowClassName(row.original) : ""
                      } ${onRowClick ? "cursor-pointer" : ""} ${
                        isRowPending ? "opacity-50" : ""
                      }`}
                      onClick={() => !isRowPending && onRowClick?.(row.original)}
                      variants={rowVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      whileHover={!isRowPending ? "hover" : {}}
                      layout
                      layoutId={row.id}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <motion.td 
                          key={cell.id} 
                          className="p-4 align-middle"
                          variants={listItemVariants}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </motion.td>
                      ))}
                    </motion.tr>
                  )
                })
              ) : (
                <motion.tr
                  variants={fadeInOut}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <td
                    colSpan={finalColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {pagination && (
        <motion.div 
          className="flex items-center justify-between space-x-2 py-4"
          variants={fadeInOut}
        >
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRows.length} selected items? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkOperationInProgress}
            >
              {bulkOperationInProgress ? "Deleting..." : `Delete ${selectedRows.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

export { AnimatedCRUDTable }