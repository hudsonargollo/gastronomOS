# Implementation Plan: Receipt Scanning (Notai Adaptation)

## Overview

This implementation plan builds the receipt scanning system that adapts the Notai repository's heuristic parsing logic for GastronomOS's serverless edge architecture. The system transforms receipt images into structured data through AI-powered OCR, intelligent parsing, and product catalog matching.

## Tasks

- [x] 1. Database Schema for Receipt Processing
  - [x] 1.1 Extend Drizzle schema for receipt tables
    - Add receipt_processing_jobs, receipts, receipt_line_items tables
    - Add product_match_candidates and processing_stats tables
    - Define proper relationships and performance indexes
    - _Requirements: 6.1, 6.4, 10.1_

  - [ ]* 1.2 Write property test for data persistence and validation
    - **Property 6: Data Persistence and Validation**
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5**

  - [x] 1.3 Create receipt processing migrations
    - Generate migration files for receipt processing tables
    - Add constraints for data integrity and tenant isolation
    - Test migration rollback capabilities
    - _Requirements: 6.3, 8.3_

- [x] 2. Secure Upload Service
  - [x] 2.1 Implement UploadService class
    - Create R2 presigned URL generation with proper expiration
    - Add image file validation (type, size, format)
    - Implement upload confirmation and verification
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 Write property test for secure upload and access control
    - **Property 1: Secure Upload and Access Control**
    - **Validates: Requirements 1.1, 1.2, 1.5, 8.4**

  - [x] 2.3 Create upload API endpoints
    - POST /receipts/upload-url for presigned URL generation
    - POST /receipts/confirm-upload for upload verification
    - GET /receipts/upload-status/:id for status checking
    - _Requirements: 1.1, 1.4, 2.3_

- [x] 3. Asynchronous Processing Pipeline
  - [x] 3.1 Implement receipt processor worker
    - Create Cloudflare Queue consumer for receipt processing
    - Add job orchestration and status management
    - Implement retry logic with exponential backoff
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ]* 3.2 Write property test for asynchronous processing pipeline
    - **Property 2: Asynchronous Processing Pipeline**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**

  - [x] 3.3 Add processing status API endpoints
    - GET /receipts/processing/:jobId for status updates
    - POST /receipts/retry/:jobId for manual retry
    - GET /receipts/processing-stats for analytics
    - _Requirements: 2.3, 2.5, 10.4_

- [x] 4. OCR Service Integration
  - [x] 4.1 Implement OCRService class
    - Integrate Cloudflare Workers AI vision models
    - Add text extraction with bounding box coordinates
    - Implement image format validation and preprocessing
    - _Requirements: 3.1, 3.2, 3.4_

  - [ ]* 4.2 Write property test for OCR processing consistency
    - **Property 3: OCR Processing Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 4.3 Add OCR error handling and retry logic
    - Implement OCR failure detection and recovery
    - Add image quality enhancement for poor scans
    - Create OCR performance monitoring
    - _Requirements: 3.3, 7.1, 10.2_

  - [ ]* 4.4 Write unit tests for OCR operations
    - Test various image formats and quality levels
    - Test OCR error handling and retry scenarios
    - Test coordinate extraction accuracy
    - _Requirements: 3.3, 3.4_

  - [x] 4.5 Replace OCR placeholder in ReceiptProcessorWorker
    - Update performOCR method to use actual OCRService
    - Integrate with Cloudflare Workers AI vision models
    - Handle OCR errors and coordinate extraction
    - _Requirements: 3.1, 3.2_

- [x] 5. Notai Parser Adaptation
  - [x] 5.1 Port Notai parsing logic to TypeScript
    - Adapt Notai regex patterns for date extraction
    - Port total amount detection algorithms
    - Implement vendor name identification logic
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 5.2 Write property test for heuristic parsing accuracy
    - **Property 4: Heuristic Parsing Accuracy**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [x] 5.3 Implement line item extraction
    - Port Notai line item detection patterns
    - Add quantity, description, and price parsing
    - Implement adaptive parsing for various receipt formats
    - _Requirements: 4.4, 4.5_

  - [ ]* 5.4 Write unit tests for parsing algorithms
    - Test date extraction with various formats
    - Test amount detection with different currencies
    - Test line item parsing accuracy
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 5.5 Replace parsing placeholder in ReceiptProcessorWorker
    - Update parseReceiptText method to use actual Notai parser
    - Integrate with ported parsing algorithms
    - Handle parsing errors and confidence scoring
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [-] 6. Product Matching System
  - [x] 6.1 Complete ProductMatcher class implementation
    - Finish matchLineItems method implementation
    - Complete fuzzy matching and similarity scoring
    - Add manual override capabilities for unmatched items
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.2 Write property test for product matching intelligence
    - **Property 5: Product Matching Intelligence**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

  - [ ]* 6.3 Write unit tests for matching algorithms
    - Test fuzzy matching accuracy with various inputs
    - Test similarity scoring consistency
    - Test manual override functionality
    - _Requirements: 5.2, 5.4_

- [x] 7. Error Handling and Quality Control
  - [x] 7.1 Implement comprehensive error handling
    - Add detailed error logging for all processing stages
    - Create manual review flagging system
    - Implement data reasonableness validation
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 7.2 Write property test for error handling and quality control
    - **Property 7: Error Handling and Quality Control**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [x] 7.3 Add quality control API endpoints
    - GET /receipts/manual-review for flagged items
    - POST /receipts/:id/approve for manual approval
    - GET /receipts/quality-stats for monitoring
    - _Requirements: 7.2, 7.5_

- [x] 8. Privacy and Security Implementation
  - [x] 8.1 Implement privacy protection measures
    - Ensure in-memory-only OCR text processing
    - Add secure data retention policies
    - Implement tenant isolation for receipt storage
    - _Requirements: 3.5, 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write property test for privacy and security protection
    - **Property 8: Privacy and Security Protection**
    - **Validates: Requirements 3.5, 8.1, 8.2, 8.3, 8.5**

  - [x] 8.3 Add secure access controls
    - Implement authenticated receipt image access
    - Add receipt data deletion capabilities
    - Create access audit logging
    - _Requirements: 1.5, 8.4, 8.5_

- [x] 9. Purchase Order Integration
  - [x] 9.1 Implement PO matching system
    - Create receipt-to-PO matching algorithms
    - Add variance detection between receipts and POs
    - Implement automatic and manual linking
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 9.2 Write property test for purchase order integration
    - **Property 9: Purchase Order Integration**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

  - [x] 9.3 Add PO integration API endpoints
    - POST /receipts/:id/link-po for manual linking
    - GET /receipts/:id/po-matches for match suggestions
    - GET /receipts/variances for discrepancy reporting
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 10. Analytics and Monitoring System
  - [x] 10.1 Implement processing analytics
    - Create success rate and error tracking
    - Add OCR accuracy and parsing effectiveness monitoring
    - Implement processing time metrics collection
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 10.2 Write property test for analytics and monitoring
    - **Property 10: Analytics and Monitoring**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

  - [x] 10.3 Add analytics API endpoints
    - GET /analytics/receipt-processing for dashboard data
    - GET /analytics/parsing-accuracy for quality metrics
    - GET /analytics/processing-trends for performance analysis
    - _Requirements: 10.3, 10.5_

- [-] 11. Receipt Management Interface
  - [x] 11.1 Complete receipt management endpoints
    - Finish truncated route handlers in receipts.ts
    - Add missing manual match and review endpoints
    - Complete receipt data retrieval and filtering
    - _Requirements: 6.1, 8.5_

  - [ ]* 11.2 Write integration tests for receipt management
    - Test complete receipt processing workflow
    - Test receipt data retrieval and filtering
    - Test receipt update and deletion operations
    - _Requirements: 6.1, 6.4_

  - [x] 11.3 Add receipt image serving
    - Implement secure receipt image access
    - Add image thumbnail generation
    - Create image download capabilities
    - _Requirements: 1.5, 6.4, 8.4_

- [x] 12. Queue Consumer Integration
  - [x] 12.1 Add queue consumer to main worker
    - Export handleReceiptProcessingQueue function
    - Integrate queue consumer with Cloudflare Workers
    - Add proper error handling for queue processing
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 12.2 Add queue configuration
    - Configure Cloudflare Queue bindings in wrangler.toml
    - Set up queue routing and message handling
    - Add queue monitoring and metrics
    - _Requirements: 2.1, 2.3_

- [x] 13. Checkpoint - Core Receipt Processing Validation
  - Ensure complete receipt processing pipeline works correctly
  - Verify OCR accuracy and parsing effectiveness
  - Confirm product matching and PO integration functionality
  - Ask the user if questions arise about receipt processing logic

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate processing consistency across diverse receipt formats
- Unit tests validate specific parsing scenarios and edge cases
- The system must maintain strict privacy protection for all receipt data
- All receipt processing operations must be properly audited and monitored
- OCR and parsing accuracy must be continuously measured and improved
- Most core functionality has been implemented, remaining tasks focus on completing ProductMatcher and receipt management endpoints