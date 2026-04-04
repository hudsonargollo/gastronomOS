'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Camera,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
  Download,
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
      <Card className="border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Camera className="h-5 w-5 text-orange-500" />
              <span>Receipt Scanner</span>
            </CardTitle>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload a photo of your receipt or nota fiscal to automatically extract purchase information
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Upload Area */}
          {!image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleUploadClick}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <Upload className="h-6 w-6 text-blue-500" />
                  <span className="text-sm font-medium">Upload Photo</span>
                </Button>

                <Button
                  onClick={handleCameraClick}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-green-50 hover:border-green-300 transition-colors"
                >
                  <Camera className="h-6 w-6 text-green-500" />
                  <span className="text-sm font-medium">Take Photo</span>
                </Button>
              </div>

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

              <p className="text-xs text-slate-400 text-center">
                Supported formats: JPG, PNG, WebP (Max 10MB)
              </p>
            </motion.div>
          )}

          {/* Loading State */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 space-y-3"
              >
                <Loader className="h-8 w-8 text-orange-500 animate-spin" />
                <p className="text-sm font-medium text-slate-600">
                  Scanning receipt...
                </p>
                <p className="text-xs text-slate-500">
                  Using AI to extract purchase information
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
                className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-3"
              >
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
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
                className="space-y-3"
              >
                <div className="relative bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src={image}
                    alt="Receipt preview"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
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
                className="space-y-3 bg-green-50 border border-green-200 rounded-lg p-4"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">Data Extracted Successfully</p>
                  {extractedData.confidence && (
                    <Badge variant="secondary" className="ml-auto">
                      {Math.round(extractedData.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {extractedData.invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Invoice #:</span>
                      <span className="font-medium text-slate-900">
                        {extractedData.invoiceNumber}
                      </span>
                    </div>
                  )}

                  {extractedData.supplier && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Supplier:</span>
                      <span className="font-medium text-slate-900">
                        {extractedData.supplier}
                      </span>
                    </div>
                  )}

                  {extractedData.date && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium text-slate-900">
                        {new Date(extractedData.date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {extractedData.totalAmount && (
                    <div className="flex justify-between pt-2 border-t border-green-200">
                      <span className="text-slate-600 font-medium">Total:</span>
                      <span className="font-bold text-green-700">
                        R$ {extractedData.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {extractedData.items && extractedData.items.length > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      Items ({extractedData.items.length})
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {extractedData.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="text-xs flex justify-between bg-white/50 p-2 rounded"
                        >
                          <span className="text-slate-700 flex-1 truncate">
                            {item.description}
                          </span>
                          <span className="text-slate-600 ml-2">
                            {item.quantity}x R$ {item.unitPrice.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {image && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={resetScanner}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              {extractedData && (
                <Button
                  onClick={() => {
                    if (onDataExtracted) {
                      onDataExtracted(extractedData);
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Use Data
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
            >
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-semibold">Receipt Preview</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
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
