'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BentoBox, BentoItem } from '@/components/design-system/layouts/bento-box';
import { useTheme } from '@/contexts/theme-context';
import {
  Upload,
  Camera,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
} from 'lucide-react';

interface ExtractedPurchaseData {
  supplier?: string;
  date?: string;
  totalAmount?: number;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  invoiceNumber?: string;
  confidence?: number;
}

interface ReceiptScannerProps {
  onDataExtracted?: (data: ExtractedPurchaseData) => void;
  onClose?: () => void;
}

export function ReceiptScanner({ onDataExtracted, onClose }: ReceiptScannerProps) {
  const { palette } = useTheme();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedPurchaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImage(base64);
      setError(null);
      extractReceiptData(base64);
    };
    reader.readAsDataURL(file);
  };

  const extractReceiptData = async (base64Image: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/purchasing/extract-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract receipt data');
      }

      const data = await response.json();
      setExtractedData(data);

      if (onDataExtracted) {
        onDataExtracted(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
      setExtractedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const resetScanner = () => {
    setImage(null);
    setExtractedData(null);
    setError(null);
    setPreviewOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <BentoItem variant="elevated" span={2}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold" style={{ color: palette.text }}>
                📸 Receipt Scanner
              </h3>
              <p className="text-sm mt-1" style={{ color: palette.textSecondary }}>
                Upload a photo of your receipt or nota fiscal
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" style={{ color: palette.text }} />
              </button>
            )}
          </div>

          {/* Upload Area */}
          {!image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              <button
                onClick={handleUploadClick}
                className="p-6 rounded-lg border-2 border-dashed transition-all hover:shadow-md"
                style={{
                  borderColor: palette.accent,
                  backgroundColor: `${palette.accent}10`,
                }}
              >
                <Upload className="h-6 w-6 mx-auto mb-2" style={{ color: palette.accent }} />
                <p className="text-sm font-medium" style={{ color: palette.text }}>
                  Upload Photo
                </p>
              </button>

              <button
                onClick={handleCameraClick}
                className="p-6 rounded-lg border-2 border-dashed transition-all hover:shadow-md"
                style={{
                  borderColor: palette.primary,
                  backgroundColor: `${palette.primary}10`,
                }}
              >
                <Camera className="h-6 w-6 mx-auto mb-2" style={{ color: palette.primary }} />
                <p className="text-sm font-medium" style={{ color: palette.text }}>
                  Take Photo
                </p>
              </button>
            </motion.div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Loading State */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 space-y-3"
              >
                <Loader className="h-8 w-8 animate-spin" style={{ color: palette.accent }} />
                <p className="text-sm font-medium" style={{ color: palette.text }}>
                  Scanning receipt...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error State */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg flex items-start space-x-3"
                style={{
                  backgroundColor: `${palette.accent}20`,
                  borderLeft: `4px solid ${palette.accent}`,
                }}
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: palette.accent }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: palette.text }}>
                    Error
                  </p>
                  <p className="text-sm mt-1" style={{ color: palette.textSecondary }}>
                    {error}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Preview */}
          <AnimatePresence>
            {image && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative rounded-lg overflow-hidden"
                style={{ backgroundColor: palette.surface }}
              >
                <img
                  src={image}
                  alt="Receipt preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="absolute top-2 right-2 p-2 rounded-lg transition-all hover:shadow-md"
                  style={{ backgroundColor: `${palette.surface}cc` }}
                >
                  <Eye className="h-4 w-4" style={{ color: palette.text }} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Extracted Data */}
          <AnimatePresence>
            {extractedData && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 rounded-lg space-y-3"
                style={{
                  backgroundColor: `${palette.primary}15`,
                  borderLeft: `4px solid ${palette.primary}`,
                }}
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" style={{ color: palette.primary }} />
                  <p className="font-medium" style={{ color: palette.text }}>
                    Data Extracted Successfully
                  </p>
                  {extractedData.confidence && (
                    <span
                      className="ml-auto text-xs font-semibold px-2 py-1 rounded"
                      style={{
                        backgroundColor: palette.accent,
                        color: palette.surface,
                      }}
                    >
                      {Math.round(extractedData.confidence * 100)}%
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {extractedData.invoiceNumber && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.textSecondary }}>Invoice #:</span>
                      <span style={{ color: palette.text }} className="font-medium">
                        {extractedData.invoiceNumber}
                      </span>
                    </div>
                  )}

                  {extractedData.supplier && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.textSecondary }}>Supplier:</span>
                      <span style={{ color: palette.text }} className="font-medium">
                        {extractedData.supplier}
                      </span>
                    </div>
                  )}

                  {extractedData.date && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.textSecondary }}>Date:</span>
                      <span style={{ color: palette.text }} className="font-medium">
                        {new Date(extractedData.date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {extractedData.totalAmount && (
                    <div
                      className="flex justify-between pt-2 mt-2"
                      style={{ borderTopColor: palette.accent, borderTopWidth: '1px' }}
                    >
                      <span style={{ color: palette.textSecondary }} className="font-medium">
                        Total:
                      </span>
                      <span style={{ color: palette.primary }} className="font-bold text-lg">
                        R$ {extractedData.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {image && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={resetScanner}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all hover:shadow-md"
                style={{
                  backgroundColor: palette.surface,
                  color: palette.text,
                  border: `1px solid ${palette.accent}`,
                }}
              >
                Clear
              </button>
              {extractedData && (
                <button
                  onClick={() => {
                    if (onDataExtracted) {
                      onDataExtracted(extractedData);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-all hover:shadow-md"
                  style={{
                    backgroundColor: palette.primary,
                    color: palette.surface,
                  }}
                >
                  Use Data
                </button>
              )}
            </div>
          )}
        </div>
      </BentoItem>

      {/* Full Image Preview Modal */}
      <AnimatePresence>
        {previewOpen && image && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewOpen(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
              style={{ backgroundColor: palette.surface }}
            >
              <div
                className="sticky top-0 p-4 flex items-center justify-between border-b"
                style={{ borderBottomColor: palette.accent }}
              >
                <h3 className="font-semibold" style={{ color: palette.text }}>
                  Receipt Preview
                </h3>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" style={{ color: palette.text }} />
                </button>
              </div>
              <div className="p-4">
                <img src={image} alt="Receipt full preview" className="w-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
