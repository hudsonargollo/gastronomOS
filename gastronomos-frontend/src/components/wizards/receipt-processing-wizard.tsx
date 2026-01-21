/**
 * Receipt Processing Wizard
 * Multi-step wizard for processing receipts with upload and verification steps
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Check, X, AlertCircle, Eye, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Wizard, createWizardConfig } from '@/components/ui/wizard';
import { WizardConfig } from '@/contexts/wizard-context';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';

// Types
interface ReceiptFile {
  file: File;
  preview: string;
  id: string;
}

interface ProcessingJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REQUIRES_REVIEW';
  progress?: number;
  errorMessage?: string;
  receipt?: ProcessedReceipt;
}

interface ProcessedReceipt {
  id: string;
  vendorName?: string;
  transactionDate?: string;
  totalAmountCents?: number;
  subtotalCents?: number;
  taxCents?: number;
  currency?: string;
  confidenceScore?: number;
  requiresManualReview?: boolean;
  lineItems: ReceiptLineItem[];
}

interface ReceiptLineItem {
  id: string;
  description: string;
  quantity?: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
  matchedProductId?: string;
  matchedProduct?: {
    id: string;
    name: string;
    sku?: string;
  };
  matchConfidence?: number;
  requiresManualReview?: boolean;
}

interface PurchaseOrder {
  id: string;
  poNumber?: string;
  supplier: {
    id: string;
    name: string;
  };
  status: string;
  totalCostCents?: number;
  lineItems: POLineItem[];
}

interface POLineItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku?: string;
  };
  quantityOrdered: number;
  unitPriceCents: number;
  quantityReceived?: number;
}

interface ReceiptProcessingData {
  files: ReceiptFile[];
  processingJobs: ProcessingJob[];
  verifiedReceipts: ProcessedReceipt[];
  linkedPurchaseOrders: { [receiptId: string]: string };
  notes?: string;
}

// Step 1: File Upload
interface FileUploadProps {
  stepData?: { files?: ReceiptFile[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function FileUploadStep({ stepData, onDataChange }: FileUploadProps) {
  const [files, setFiles] = useState<ReceiptFile[]>(stepData?.files || []);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    onDataChange?.({ files });
  }, [files, onDataChange]);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: ReceiptFile[] = [];
    
    Array.from(fileList).forEach((file) => {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const id = Math.random().toString(36).substr(2, 9);
        const preview = URL.createObjectURL(file);
        newFiles.push({ file, preview, id });
      }
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      // Clean up object URLs
      const removed = prev.find(f => f.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Upload className="w-5 h-5" />
        <span>Upload receipt images or PDF files for processing</span>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              "hover:border-primary hover:bg-primary/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Upload Receipt Files</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop files here, or click to select files
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports: JPG, PNG, PDF (Max 10MB per file)
            </p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <Button asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select Files
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Files ({files.length})</CardTitle>
            <CardDescription>
              Review your uploaded receipt files before processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((fileData) => (
                <motion.div
                  key={fileData.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={transitions.default}
                  className="relative group"
                >
                  <Card className="overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      {fileData.file.type.startsWith('image/') ? (
                        <img
                          src={fileData.preview}
                          alt={fileData.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate" title={fileData.file.name}>
                        {fileData.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </CardContent>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(fileData.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm mt-2">Upload receipt files to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Step 2: Processing
interface ProcessingProps {
  stepData?: { processingJobs?: ProcessingJob[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ProcessingStep({ stepData, wizardData, onDataChange }: ProcessingProps) {
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>(stepData?.processingJobs || []);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const files = wizardData?.['file-upload']?.files || [];

  useEffect(() => {
    onDataChange?.({ processingJobs });
  }, [processingJobs, onDataChange]);

  useEffect(() => {
    if (files.length > 0 && processingJobs.length === 0) {
      startProcessing();
    }
  }, [files]);

  const startProcessing = async () => {
    if (isProcessing || files.length === 0) return;

    setIsProcessing(true);
    const jobs: ProcessingJob[] = [];

    try {
      for (const fileData of files) {
        // Upload file and start processing
        const response = await apiClient.uploadReceipt(fileData.file, {
          autoProcess: true,
        });

        if (response.success) {
          const job: ProcessingJob = {
            id: response.data.job.id,
            status: 'PROCESSING',
            progress: 0,
          };
          jobs.push(job);
          setProcessingJobs([...jobs]);

          // Poll for job completion
          pollJobStatus(job.id);
        }
      }
    } catch (error) {
      console.error('Failed to start processing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await apiClient.getReceiptJob(jobId);
        
        if (response.success) {
          const job = response.data.job;
          
          setProcessingJobs(prev => prev.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: job.status,
                  progress: job.status === 'COMPLETED' ? 100 : Math.min(90, attempts * 3),
                  errorMessage: job.errorMessage,
                  receipt: job.receipt,
                }
              : j
          ));

          if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'REQUIRES_REVIEW') {
            return; // Stop polling
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Poll every second
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
      }
    };

    poll();
  };

  const retryProcessing = (jobId: string) => {
    setProcessingJobs(prev => prev.map(j => 
      j.id === jobId 
        ? { ...j, status: 'PROCESSING', progress: 0, errorMessage: undefined }
        : j
    ));
    pollJobStatus(jobId);
  };

  const allJobsCompleted = processingJobs.length > 0 && processingJobs.every(job => 
    job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'REQUIRES_REVIEW'
  );

  const successfulJobs = processingJobs.filter(job => job.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <RefreshCw className="w-5 h-5" />
        <span>Processing uploaded receipt files</span>
      </div>

      {/* Processing Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Processing Status</CardTitle>
          <CardDescription>
            {processingJobs.length} file{processingJobs.length !== 1 ? 's' : ''} being processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processingJobs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Starting processing...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {processingJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">File {index + 1}</span>
                      <Badge 
                        variant={
                          job.status === 'COMPLETED' ? 'default' :
                          job.status === 'FAILED' ? 'destructive' :
                          job.status === 'REQUIRES_REVIEW' ? 'secondary' :
                          'outline'
                        }
                      >
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {job.status === 'FAILED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryProcessing(job.id)}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </Button>
                    )}
                  </div>

                  {job.status === 'PROCESSING' && (
                    <div className="space-y-2">
                      <Progress value={job.progress || 0} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Processing receipt data...
                      </p>
                    </div>
                  )}

                  {job.status === 'COMPLETED' && job.receipt && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Processing completed</span>
                      </div>
                      <div className="text-sm space-y-1">
                        {job.receipt.vendorName && (
                          <p><span className="font-medium">Vendor:</span> {job.receipt.vendorName}</p>
                        )}
                        {job.receipt.totalAmountCents && (
                          <p><span className="font-medium">Total:</span> ${(job.receipt.totalAmountCents / 100).toFixed(2)}</p>
                        )}
                        {job.receipt.lineItems && (
                          <p><span className="font-medium">Items:</span> {job.receipt.lineItems.length}</p>
                        )}
                        {job.receipt.confidenceScore && (
                          <p><span className="font-medium">Confidence:</span> {(job.receipt.confidenceScore * 100).toFixed(1)}%</p>
                        )}
                      </div>
                    </div>
                  )}

                  {job.status === 'REQUIRES_REVIEW' && (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Manual review required</span>
                    </div>
                  )}

                  {job.status === 'FAILED' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600">
                        <X className="w-4 h-4" />
                        <span className="text-sm font-medium">Processing failed</span>
                      </div>
                      {job.errorMessage && (
                        <p className="text-sm text-red-600">{job.errorMessage}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Summary */}
      {allJobsCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          <Card className={cn(
            "border-2",
            successfulJobs.length === processingJobs.length 
              ? "border-green-200 bg-green-50" 
              : "border-yellow-200 bg-yellow-50"
          )}>
            <CardContent className="p-4">
              <div className={cn(
                "flex items-center gap-2",
                successfulJobs.length === processingJobs.length 
                  ? "text-green-700" 
                  : "text-yellow-700"
              )}>
                {successfulJobs.length === processingJobs.length ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">
                  {successfulJobs.length} of {processingJobs.length} files processed successfully
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// Step 3: Verification
interface VerificationProps {
  stepData?: { verifiedReceipts?: ProcessedReceipt[]; linkedPurchaseOrders?: { [key: string]: string } };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function VerificationStep({ stepData, wizardData, onDataChange }: VerificationProps) {
  const [verifiedReceipts, setVerifiedReceipts] = useState<ProcessedReceipt[]>(stepData?.verifiedReceipts || []);
  const [linkedPurchaseOrders, setLinkedPurchaseOrders] = useState<{ [key: string]: string }>(
    stepData?.linkedPurchaseOrders || {}
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const processingJobs = wizardData?.['processing']?.processingJobs || [];
  const successfulReceipts = processingJobs
    .filter((job: ProcessingJob) => job.status === 'COMPLETED' && job.receipt)
    .map((job: ProcessingJob) => job.receipt);

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  useEffect(() => {
    if (successfulReceipts.length > 0 && verifiedReceipts.length === 0) {
      setVerifiedReceipts(successfulReceipts);
    }
  }, [successfulReceipts]);

  useEffect(() => {
    onDataChange?.({ verifiedReceipts, linkedPurchaseOrders });
  }, [verifiedReceipts, linkedPurchaseOrders, onDataChange]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPurchaseOrders();
      setPurchaseOrders(response.purchaseOrders || []);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReceiptField = (receiptId: string, field: string, value: any) => {
    setVerifiedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { ...receipt, [field]: value }
        : receipt
    ));
  };

  const updateLineItem = (receiptId: string, lineItemId: string, field: string, value: any) => {
    setVerifiedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? {
            ...receipt,
            lineItems: receipt.lineItems.map(item =>
              item.id === lineItemId
                ? { ...item, [field]: value }
                : item
            )
          }
        : receipt
    ));
  };

  const linkPurchaseOrder = (receiptId: string, poId: string) => {
    setLinkedPurchaseOrders(prev => ({
      ...prev,
      [receiptId]: poId,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Eye className="w-5 h-5" />
        <span>Verify and correct the processed receipt data</span>
      </div>

      {verifiedReceipts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No receipts to verify</p>
            <p className="text-sm mt-2">Complete processing first</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {verifiedReceipts.map((receipt, receiptIndex) => (
            <motion.div
              key={receipt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.default}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Receipt {receiptIndex + 1}</span>
                    {receipt.requiresManualReview && (
                      <Badge variant="secondary">Requires Review</Badge>
                    )}
                  </CardTitle>
                  {receipt.confidenceScore && (
                    <CardDescription>
                      Confidence: {(receipt.confidenceScore * 100).toFixed(1)}%
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Receipt Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor Name</Label>
                      <Input
                        value={receipt.vendorName || ''}
                        onChange={(e) => updateReceiptField(receipt.id, 'vendorName', e.target.value)}
                        placeholder="Enter vendor name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction Date</Label>
                      <Input
                        type="date"
                        value={receipt.transactionDate || ''}
                        onChange={(e) => updateReceiptField(receipt.id, 'transactionDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={receipt.totalAmountCents ? (receipt.totalAmountCents / 100).toFixed(2) : ''}
                        onChange={(e) => updateReceiptField(receipt.id, 'totalAmountCents', 
                          Math.round(parseFloat(e.target.value) * 100) || 0
                        )}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tax Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={receipt.taxCents ? (receipt.taxCents / 100).toFixed(2) : ''}
                        onChange={(e) => updateReceiptField(receipt.id, 'taxCents', 
                          Math.round(parseFloat(e.target.value) * 100) || 0
                        )}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Link to Purchase Order */}
                  <div className="space-y-2">
                    <Label>Link to Purchase Order (Optional)</Label>
                    <Select
                      value={linkedPurchaseOrders[receipt.id] || ''}
                      onValueChange={(value) => linkPurchaseOrder(receipt.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a purchase order to link" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No purchase order</SelectItem>
                        {purchaseOrders.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.poNumber || po.id} - {po.supplier.name} 
                            {po.totalCostCents && ` ($${(po.totalCostCents / 100).toFixed(2)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Line Items */}
                  {receipt.lineItems && receipt.lineItems.length > 0 && (
                    <div className="space-y-4">
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-3">Line Items ({receipt.lineItems.length})</h4>
                        <div className="space-y-3">
                          {receipt.lineItems.map((item, itemIndex) => (
                            <div key={item.id} className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium">Item {itemIndex + 1}</h5>
                                {item.requiresManualReview && (
                                  <Badge variant="outline" className="text-xs">
                                    Needs Review
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Description</Label>
                                  <Input
                                    value={item.description}
                                    onChange={(e) => updateLineItem(receipt.id, item.id, 'description', e.target.value)}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Quantity</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.quantity || ''}
                                    onChange={(e) => updateLineItem(receipt.id, item.id, 'quantity', 
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Total Price ($)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.totalPriceCents ? (item.totalPriceCents / 100).toFixed(2) : ''}
                                    onChange={(e) => updateLineItem(receipt.id, item.id, 'totalPriceCents', 
                                      Math.round(parseFloat(e.target.value) * 100) || 0
                                    )}
                                    className="text-sm"
                                  />
                                </div>
                              </div>

                              {item.matchedProduct && (
                                <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                                  <div className="flex items-center gap-2 text-green-700">
                                    <Check className="w-3 h-3" />
                                    <span className="font-medium">
                                      Matched to: {item.matchedProduct.name}
                                    </span>
                                    {item.matchConfidence && (
                                      <Badge variant="outline" className="text-xs">
                                        {(item.matchConfidence * 100).toFixed(0)}% confidence
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 4: Final Review
interface FinalReviewProps {
  stepData?: { notes?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function FinalReviewStep({ stepData, wizardData, onDataChange }: FinalReviewProps) {
  const [notes, setNotes] = useState(stepData?.notes || '');
  
  const verifiedReceipts = wizardData?.['verification']?.verifiedReceipts || [];
  const linkedPurchaseOrders = wizardData?.['verification']?.linkedPurchaseOrders || {};
  
  useEffect(() => {
    onDataChange?.({ notes });
  }, [notes, onDataChange]);

  const totalAmount = verifiedReceipts.reduce((sum: number, receipt: ProcessedReceipt) => 
    sum + (receipt.totalAmountCents || 0), 0
  );

  const linkedCount = Object.keys(linkedPurchaseOrders).filter(key => linkedPurchaseOrders[key]).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-5 h-5" />
        <span>Review processed receipts before finalizing</span>
      </div>

      {/* Processing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Processing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{verifiedReceipts.length}</div>
              <div className="text-sm text-muted-foreground">Receipts Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${(totalAmount / 100).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Amount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{linkedCount}</div>
              <div className="text-sm text-muted-foreground">Linked to POs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {verifiedReceipts.reduce((sum: number, receipt: ProcessedReceipt) => 
                  sum + (receipt.lineItems?.length || 0), 0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Line Items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Details */}
      {verifiedReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {verifiedReceipts.map((receipt: ProcessedReceipt, index: number) => (
                <div key={receipt.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Receipt {index + 1}</h4>
                    <div className="flex items-center gap-2">
                      {receipt.requiresManualReview && (
                        <Badge variant="secondary">Reviewed</Badge>
                      )}
                      {linkedPurchaseOrders[receipt.id] && (
                        <Badge variant="outline">Linked to PO</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Vendor:</span>
                      <p className="font-medium">{receipt.vendorName || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <p className="font-medium">{receipt.transactionDate || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <p className="font-medium">
                        ${receipt.totalAmountCents ? (receipt.totalAmountCents / 100).toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items:</span>
                      <p className="font-medium">{receipt.lineItems?.length || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Processing Notes (Optional)</CardTitle>
          <CardDescription>
            Add any notes about the receipt processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter any notes about the processed receipts..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Main Receipt Processing Wizard Component
interface ReceiptProcessingWizardProps {
  onComplete?: (data: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function ReceiptProcessingWizard({ onComplete, onCancel, className }: ReceiptProcessingWizardProps) {
  const handleComplete = async (wizardData: Record<string, any>) => {
    try {
      const fileData = wizardData['file-upload'];
      const processingData = wizardData['processing'];
      const verificationData = wizardData['verification'];
      const reviewData = wizardData['final-review'];

      // Finalize receipt processing
      for (const receipt of verificationData?.verifiedReceipts || []) {
        await apiClient.verifyReceipt(receipt.id, {
          vendorName: receipt.vendorName,
          transactionDate: receipt.transactionDate,
          totalAmountCents: receipt.totalAmountCents,
          taxCents: receipt.taxCents,
          lineItems: receipt.lineItems,
          linkedPoId: verificationData?.linkedPurchaseOrders?.[receipt.id],
          notes: reviewData?.notes,
        });
      }

      // Call completion callback
      onComplete?.({
        files: fileData?.files || [],
        processingJobs: processingData?.processingJobs || [],
        verifiedReceipts: verificationData?.verifiedReceipts || [],
        linkedPurchaseOrders: verificationData?.linkedPurchaseOrders || {},
        notes: reviewData?.notes,
      });
    } catch (error) {
      console.error('Failed to complete receipt processing:', error);
      throw error;
    }
  };

  const wizardConfig: WizardConfig = createWizardConfig(
    'receipt-processing-wizard',
    'Process Receipts',
    [
      {
        id: 'file-upload',
        title: 'Upload Files',
        description: 'Upload receipt images or PDF files',
        component: FileUploadStep,
        validation: (data) => data?.files?.length > 0,
      },
      {
        id: 'processing',
        title: 'Processing',
        description: 'AI processing of receipt data',
        component: ProcessingStep,
        validation: (data) => {
          const jobs = data?.processingJobs || [];
          return jobs.length > 0 && jobs.every((job: ProcessingJob) => 
            job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'REQUIRES_REVIEW'
          );
        },
      },
      {
        id: 'verification',
        title: 'Verification',
        description: 'Verify and correct processed data',
        component: VerificationStep,
        validation: (data) => data?.verifiedReceipts?.length > 0,
      },
      {
        id: 'final-review',
        title: 'Final Review',
        description: 'Review and finalize processing',
        component: FinalReviewStep,
        validation: () => true, // Notes are optional
      },
    ],
    {
      onComplete: handleComplete,
      onCancel,
      allowBackNavigation: true,
      persistState: true,
    }
  );

  return (
    <div className={className}>
      <Wizard
        config={wizardConfig}
        persistenceKey="receipt-processing-wizard"
        showProgress={true}
        showNavigation={true}
        navigationVariant="full"
        stepVariant="card"
        animated={true}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    </div>
  );
}

export default ReceiptProcessingWizard;