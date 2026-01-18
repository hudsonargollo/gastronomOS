"use client"

import * as React from "react"
import { UploadIcon, XIcon, ImageIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface ImageUploadProps {
  value?: string | File
  onChange?: (file: File | null) => void
  onUpload?: (file: File) => Promise<string>
  accept?: string
  maxSize?: number // in bytes
  maxWidth?: number
  maxHeight?: number
  disabled?: boolean
  className?: string
  placeholder?: string
  showPreview?: boolean
  multiple?: boolean
  dragAndDrop?: boolean
}

function ImageUpload({
  value,
  onChange,
  onUpload,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB
  maxWidth,
  maxHeight,
  disabled = false,
  className,
  placeholder = "Click to upload or drag and drop",
  showPreview = true,
  multiple = false,
  dragAndDrop = true,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [preview, setPreview] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Generate preview URL
  React.useEffect(() => {
    if (!showPreview) return

    if (typeof value === 'string') {
      setPreview(value)
    } else if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreview(null)
    }
  }, [value, showPreview])

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return "Please select an image file"
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024)
      return `File size must be less than ${maxSizeMB}MB`
    }

    return null
  }

  const validateImageDimensions = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!maxWidth && !maxHeight) {
        resolve(null)
        return
      }

      const img = new Image()
      img.onload = () => {
        let error: string | null = null
        
        if (maxWidth && img.width > maxWidth) {
          error = `Image width must be less than ${maxWidth}px`
        } else if (maxHeight && img.height > maxHeight) {
          error = `Image height must be less than ${maxHeight}px`
        }
        
        resolve(error)
      }
      img.onerror = () => resolve("Invalid image file")
      img.src = URL.createObjectURL(file)
    })
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file
    const fileError = validateFile(file)
    if (fileError) {
      toast.error(fileError)
      return
    }

    // Validate dimensions
    const dimensionError = await validateImageDimensions(file)
    if (dimensionError) {
      toast.error(dimensionError)
      return
    }

    // If upload handler is provided, upload the file
    if (onUpload) {
      setIsUploading(true)
      setUploadProgress(0)
      
      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90))
        }, 100)

        const uploadedUrl = await onUpload(file)
        
        clearInterval(progressInterval)
        setUploadProgress(100)
        
        onChange?.(file)
        toast.success("Image uploaded successfully")
      } catch (error) {
        console.error("Upload error:", error)
        toast.error("Failed to upload image")
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    } else {
      onChange?.(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && dragAndDrop) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled || !dragAndDrop) return
    
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  const handleClick = () => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && !isDragging && "hover:border-primary/50 hover:bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            <div className="w-full max-w-xs">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          </div>
        ) : preview && showPreview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-48 mx-auto rounded-lg object-contain"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              {dragAndDrop ? (
                <UploadIcon className="h-8 w-8 text-primary" />
              ) : (
                <ImageIcon className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{placeholder}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {accept} up to {formatFileSize(maxSize)}
                {maxWidth && maxHeight && ` (max ${maxWidth}x${maxHeight}px)`}
              </p>
            </div>
          </div>
        )}
      </div>

      {value instanceof File && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{value.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(value.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || isUploading}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export { ImageUpload }