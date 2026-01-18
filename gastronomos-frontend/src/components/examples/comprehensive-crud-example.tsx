"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { z } from "zod"
import { PlusIcon, EditIcon, TrashIcon, DownloadIcon } from "lucide-react"

import {
  Button,
  DataTable,
  ModalForm,
  SearchFilter,
  ExportData,
  ConfirmationDialog,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  ResponsiveGrid,
  ResponsiveContainer,
} from "@/components/ui"
import { useCategories } from "@/hooks/use-crud"
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog"

// Example data type
interface Category {
  id: string
  name: string
  description?: string
  parentId?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

// Form schema
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
  parentId: z.string().optional(),
  active: z.boolean().default(true),
})

type CategoryFormData = z.infer<typeof categorySchema>

// Form fields configuration
const formFields = [
  {
    name: "name",
    label: "Category Name",
    type: "text" as const,
    placeholder: "Enter category name",
    required: true,
  },
  {
    name: "description",
    label: "Description",
    type: "textarea" as const,
    placeholder: "Enter description (optional)",
    rows: 3,
  },
  {
    name: "parentId",
    label: "Parent Category",
    type: "select" as const,
    placeholder: "Select parent category",
    options: [
      { value: "", label: "None (Root Category)" },
      { value: "1", label: "Food & Beverages" },
      { value: "2", label: "Kitchen Equipment" },
      { value: "3", label: "Cleaning Supplies" },
    ],
  },
  {
    name: "active",
    label: "Active",
    type: "switch" as const,
    description: "Enable this category",
  },
]

// Filter options
const filterOptions = [
  {
    key: "active",
    label: "Status",
    type: "boolean" as const,
  },
  {
    key: "parentId",
    label: "Parent Category",
    type: "select" as const,
    options: [
      { value: "1", label: "Food & Beverages" },
      { value: "2", label: "Kitchen Equipment" },
      { value: "3", label: "Cleaning Supplies" },
    ],
  },
]

// Export columns
const exportColumns = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "active", label: "Status", format: (value: boolean) => value ? "Active" : "Inactive" },
  { key: "createdAt", label: "Created", format: (value: string) => new Date(value).toLocaleDateString() },
]

export function ComprehensiveCrudExample() {
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<Category | null>(null)
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValues, setFilterValues] = React.useState({})
  
  const { openDialog, ConfirmationDialog } = useConfirmationDialog()

  // CRUD operations
  const {
    data: categories = [],
    loading,
    error,
    create,
    update,
    delete: deleteCategory,
    bulkDelete,
    refresh,
  } = useCategories({
    search: searchValue,
    ...filterValues,
  })

  // Table columns
  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="text-muted-foreground max-w-xs truncate">
          {row.getValue("description") || "—"}
        </div>
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          row.getValue("active") 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {row.getValue("active") ? "Active" : "Inactive"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {new Date(row.getValue("createdAt")).toLocaleDateString()}
        </div>
      ),
    },
  ]

  // Handlers
  const handleCreate = () => {
    setEditingItem(null)
    setIsModalOpen(true)
  }

  const handleEdit = (item: Category) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleDelete = (item: Category) => {
    openDialog({
      title: "Delete Category",
      description: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteCategory(item.id)
      },
    })
  }

  const handleBulkDelete = (items: Category[]) => {
    openDialog({
      title: "Delete Categories",
      description: `Are you sure you want to delete ${items.length} categories? This action cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete All",
      onConfirm: async () => {
        await bulkDelete(items.map(item => item.id))
      },
    })
  }

  const handleFormSubmit = async (data: CategoryFormData) => {
    if (editingItem) {
      await update(editingItem.id, data)
    } else {
      await create(data)
    }
    setIsModalOpen(false)
    setEditingItem(null)
  }

  const handleExport = (format: string, data: Category[]) => {
    console.log(`Exporting ${data.length} items as ${format}`)
  }

  // Loading state
  if (loading && categories.length === 0) {
    return (
      <ResponsiveContainer>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Categories</h1>
            <LoadingSpinner text="Loading categories..." />
          </div>
        </div>
      </ResponsiveContainer>
    )
  }

  // Error state
  if (error) {
    return (
      <ResponsiveContainer>
        <ErrorState
          title="Failed to load categories"
          description="There was an error loading the categories. Please try again."
          error={error}
          onRetry={refresh}
        />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Categories</h1>
            <p className="text-muted-foreground">
              Manage your product categories
            </p>
          </div>
          <Button onClick={handleCreate}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>

        {/* Search and Filters */}
        <SearchFilter
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search categories..."
          filters={filterOptions}
          filterValues={filterValues}
          onFilterChange={setFilterValues}
        />

        {/* Data Table */}
        {categories.length === 0 && !loading ? (
          <EmptyState
            title="No categories found"
            description="Get started by creating your first category."
            action={{
              label: "Add Category",
              onClick: handleCreate,
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={categories}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onAdd={handleCreate}
            onExport={(data) => (
              <ExportData
                data={data}
                columns={exportColumns}
                filename="categories"
                formats={["csv", "json", "pdf"]}
                onExport={handleExport}
              />
            )}
            searchable={false} // We have custom search
            addLabel="Add Category"
          />
        )}

        {/* Modal Form */}
        <ModalForm
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
          onSubmit={handleFormSubmit}
          title={editingItem ? "Edit Category" : "Add Category"}
          description={editingItem ? "Update the category details." : "Create a new category."}
          initialData={editingItem || undefined}
          fields={formFields}
          schema={categorySchema}
          submitLabel={editingItem ? "Update" : "Create"}
        />

        {/* Confirmation Dialog */}
        <ConfirmationDialog />
      </div>
    </ResponsiveContainer>
  )
}