/**
 * Visual Regression Testing Utilities
 * Utilities for visual regression testing and UI consistency validation
 */

import { render, RenderResult } from '@testing-library/react';
import html2canvas from 'html2canvas';
import React from 'react';

// Visual regression test configuration
export const visualRegressionConfig = {
  // Screenshot configuration
  screenshot: {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    quality: 80,
    format: 'png' as const,
  },
  
  // Comparison thresholds
  comparison: {
    threshold: 0.1, // 10% difference threshold
    pixelThreshold: 100, // Maximum different pixels
    includeAA: false, // Include anti-aliasing in comparison
  },
  
  // Viewport configurations for responsive testing
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1200, height: 800 },
    wide: { width: 1920, height: 1080 },
  },
  
  // Animation handling
  animation: {
    disableAnimations: true,
    waitForAnimations: 500, // ms to wait for animations to complete
  },
};

// Screenshot utilities
export class ScreenshotCapture {
  private canvas: HTMLCanvasElement | null = null;
  
  async captureElement(element: HTMLElement, options: Partial<typeof visualRegressionConfig.screenshot> = {}): Promise<string> {
    const config = { ...visualRegressionConfig.screenshot, ...options };
    
    try {
      this.canvas = await html2canvas(element, {
        width: config.width,
        height: config.height,
        scale: config.deviceScaleFactor,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      
      return this.canvas.toDataURL(`image/${config.format}`, config.quality / 100);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw error;
    }
  }
  
  async captureFullPage(options: Partial<typeof visualRegressionConfig.screenshot> = {}): Promise<string> {
    const body = document.body;
    return this.captureElement(body, options);
  }
  
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}

// Image comparison utilities
export class ImageComparison {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }
  
  async compareImages(
    image1: string, 
    image2: string, 
    threshold: number = visualRegressionConfig.comparison.threshold
  ): Promise<{
    match: boolean;
    difference: number;
    diffImage?: string;
  }> {
    const img1 = await this.loadImage(image1);
    const img2 = await this.loadImage(image2);
    
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return {
        match: false,
        difference: 1,
      };
    }
    
    this.canvas.width = img1.width;
    this.canvas.height = img1.height;
    
    // Draw first image
    this.ctx.drawImage(img1, 0, 0);
    const data1 = this.ctx.getImageData(0, 0, img1.width, img1.height);
    
    // Draw second image
    this.ctx.drawImage(img2, 0, 0);
    const data2 = this.ctx.getImageData(0, 0, img2.width, img2.height);
    
    // Compare pixels
    const diff = this.calculatePixelDifference(data1, data2);
    const match = diff.percentage <= threshold;
    
    let diffImage: string | undefined;
    if (!match) {
      diffImage = this.createDiffImage(data1, data2);
    }
    
    return {
      match,
      difference: diff.percentage,
      diffImage,
    };
  }
  
  private async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  private calculatePixelDifference(data1: ImageData, data2: ImageData): {
    differentPixels: number;
    totalPixels: number;
    percentage: number;
  } {
    let differentPixels = 0;
    const totalPixels = data1.width * data1.height;
    
    for (let i = 0; i < data1.data.length; i += 4) {
      const r1 = data1.data[i];
      const g1 = data1.data[i + 1];
      const b1 = data1.data[i + 2];
      const a1 = data1.data[i + 3];
      
      const r2 = data2.data[i];
      const g2 = data2.data[i + 1];
      const b2 = data2.data[i + 2];
      const a2 = data2.data[i + 3];
      
      const deltaR = Math.abs(r1 - r2);
      const deltaG = Math.abs(g1 - g2);
      const deltaB = Math.abs(b1 - b2);
      const deltaA = Math.abs(a1 - a2);
      
      if (deltaR > 10 || deltaG > 10 || deltaB > 10 || deltaA > 10) {
        differentPixels++;
      }
    }
    
    return {
      differentPixels,
      totalPixels,
      percentage: differentPixels / totalPixels,
    };
  }
  
  private createDiffImage(data1: ImageData, data2: ImageData): string {
    const diffData = this.ctx.createImageData(data1.width, data1.height);
    
    for (let i = 0; i < data1.data.length; i += 4) {
      const r1 = data1.data[i];
      const g1 = data1.data[i + 1];
      const b1 = data1.data[i + 2];
      
      const r2 = data2.data[i];
      const g2 = data2.data[i + 1];
      const b2 = data2.data[i + 2];
      
      const deltaR = Math.abs(r1 - r2);
      const deltaG = Math.abs(g1 - g2);
      const deltaB = Math.abs(b1 - b2);
      
      if (deltaR > 10 || deltaG > 10 || deltaB > 10) {
        // Highlight differences in red
        diffData.data[i] = 255;     // R
        diffData.data[i + 1] = 0;   // G
        diffData.data[i + 2] = 0;   // B
        diffData.data[i + 3] = 255; // A
      } else {
        // Keep original pixel
        diffData.data[i] = r1;
        diffData.data[i + 1] = g1;
        diffData.data[i + 2] = b1;
        diffData.data[i + 3] = 255;
      }
    }
    
    this.ctx.putImageData(diffData, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}

// Visual regression test helpers
export const visualRegressionHelpers = {
  // Render component and capture screenshot
  renderAndCapture: async (
    component: React.ReactElement,
    options: {
      viewport?: keyof typeof visualRegressionConfig.viewports;
      waitForAnimations?: boolean;
      disableAnimations?: boolean;
    } = {}
  ): Promise<{
    renderResult: RenderResult;
    screenshot: string;
    element: HTMLElement;
  }> => {
    // Set viewport if specified
    if (options.viewport) {
      const viewport = visualRegressionConfig.viewports[options.viewport];
      Object.assign(document.documentElement.style, {
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
      });
    }
    
    // Disable animations if requested
    if (options.disableAnimations ?? visualRegressionConfig.animation.disableAnimations) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    const renderResult = render(component);
    
    // Wait for animations to complete
    if (options.waitForAnimations) {
      await new Promise(resolve => 
        setTimeout(resolve, visualRegressionConfig.animation.waitForAnimations)
      );
    }
    
    const capture = new ScreenshotCapture();
    const screenshot = await capture.captureElement(renderResult.container);
    
    return {
      renderResult,
      screenshot,
      element: renderResult.container,
    };
  },
  
  // Compare component screenshots
  compareComponentScreenshots: async (
    component1: React.ReactElement,
    component2: React.ReactElement,
    options: {
      threshold?: number;
      viewport?: keyof typeof visualRegressionConfig.viewports;
    } = {}
  ) => {
    const { screenshot: screenshot1 } = await visualRegressionHelpers.renderAndCapture(
      component1, 
      { viewport: options.viewport }
    );
    
    const { screenshot: screenshot2 } = await visualRegressionHelpers.renderAndCapture(
      component2, 
      { viewport: options.viewport }
    );
    
    const comparison = new ImageComparison();
    return comparison.compareImages(
      screenshot1, 
      screenshot2, 
      options.threshold ?? visualRegressionConfig.comparison.threshold
    );
  },
  
  // Test responsive design consistency
  testResponsiveConsistency: async (
    component: React.ReactElement,
    viewports: Array<keyof typeof visualRegressionConfig.viewports> = ['mobile', 'tablet', 'desktop']
  ) => {
    const screenshots: Record<string, string> = {};
    
    for (const viewport of viewports) {
      const { screenshot } = await visualRegressionHelpers.renderAndCapture(component, { viewport });
      screenshots[viewport] = screenshot;
    }
    
    return screenshots;
  },
  
  // Test theme consistency
  testThemeConsistency: async (
    component: React.ReactElement,
    themes: Array<{ name: string; className: string }>
  ) => {
    const screenshots: Record<string, string> = {};
    
    for (const theme of themes) {
      // Apply theme
      document.body.className = theme.className;
      
      const { screenshot } = await visualRegressionHelpers.renderAndCapture(component);
      screenshots[theme.name] = screenshot;
      
      // Clean up theme
      document.body.className = '';
    }
    
    return screenshots;
  },
  
  // Test animation states
  testAnimationStates: async (
    component: React.ReactElement,
    states: Array<{ name: string; trigger: () => Promise<void> }>
  ) => {
    const screenshots: Record<string, string> = {};
    
    const { renderResult } = await visualRegressionHelpers.renderAndCapture(component, {
      disableAnimations: false,
    });
    
    for (const state of states) {
      await state.trigger();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for state change
      
      const capture = new ScreenshotCapture();
      const screenshot = await capture.captureElement(renderResult.container);
      screenshots[state.name] = screenshot;
    }
    
    return screenshots;
  },
};

// Visual regression test assertions
export const visualRegressionAssertions = {
  // Assert visual match
  assertVisualMatch: (
    comparisonResult: { match: boolean; difference: number },
    threshold: number = visualRegressionConfig.comparison.threshold
  ) => {
    expect(comparisonResult.match).toBe(true);
    expect(comparisonResult.difference).toBeLessThanOrEqual(threshold);
  },
  
  // Assert visual difference (for testing changes)
  assertVisualDifference: (
    comparisonResult: { match: boolean; difference: number },
    minDifference: number = 0.01
  ) => {
    expect(comparisonResult.match).toBe(false);
    expect(comparisonResult.difference).toBeGreaterThanOrEqual(minDifference);
  },
  
  // Assert responsive consistency
  assertResponsiveConsistency: async (
    screenshots: Record<string, string>,
    maxDifference: number = 0.05
  ) => {
    const comparison = new ImageComparison();
    const viewports = Object.keys(screenshots);
    
    for (let i = 0; i < viewports.length - 1; i++) {
      for (let j = i + 1; j < viewports.length; j++) {
        const result = await comparison.compareImages(
          screenshots[viewports[i]],
          screenshots[viewports[j]]
        );
        
        // Allow some difference for responsive layouts
        expect(result.difference).toBeLessThanOrEqual(maxDifference);
      }
    }
  },
};

// Mock storage for baseline images (in real implementation, this would be file-based)
export class BaselineStorage {
  private baselines: Map<string, string> = new Map();
  
  async saveBaseline(key: string, screenshot: string): Promise<void> {
    this.baselines.set(key, screenshot);
  }
  
  async getBaseline(key: string): Promise<string | null> {
    return this.baselines.get(key) || null;
  }
  
  async hasBaseline(key: string): Promise<boolean> {
    return this.baselines.has(key);
  }
  
  async deleteBaseline(key: string): Promise<void> {
    this.baselines.delete(key);
  }
  
  async listBaselines(): Promise<string[]> {
    return Array.from(this.baselines.keys());
  }
}

// Complete visual regression test suite
export const runVisualRegressionTest = async (
  testName: string,
  component: React.ReactElement,
  options: {
    updateBaseline?: boolean;
    threshold?: number;
    viewport?: keyof typeof visualRegressionConfig.viewports;
  } = {}
) => {
  const storage = new BaselineStorage();
  const { screenshot } = await visualRegressionHelpers.renderAndCapture(component, {
    viewport: options.viewport,
  });
  
  const baselineKey = `${testName}-${options.viewport || 'default'}`;
  
  if (options.updateBaseline || !(await storage.hasBaseline(baselineKey))) {
    await storage.saveBaseline(baselineKey, screenshot);
    return { isBaseline: true, match: true, difference: 0 };
  }
  
  const baseline = await storage.getBaseline(baselineKey);
  if (!baseline) {
    throw new Error(`No baseline found for ${baselineKey}`);
  }
  
  const comparison = new ImageComparison();
  const result = await comparison.compareImages(
    baseline,
    screenshot,
    options.threshold ?? visualRegressionConfig.comparison.threshold
  );
  
  return {
    isBaseline: false,
    ...result,
  };
};

export default {
  visualRegressionConfig,
  ScreenshotCapture,
  ImageComparison,
  visualRegressionHelpers,
  visualRegressionAssertions,
  BaselineStorage,
  runVisualRegressionTest,
};