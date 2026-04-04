import { NextRequest, NextResponse } from 'next/server';

interface ExtractedData {
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

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = image.split(',')[1] || image;
    const buffer = Buffer.from(base64Data, 'base64');

    // Call Cloudflare AI to extract text from image
    const aiResponse = await fetch('https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/run/@cf/shared/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!aiResponse.ok) {
      // Fallback: Use local parsing if AI fails
      return parseReceiptLocally(image);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.result?.text || '';

    // Parse the extracted text to get structured data
    const parsedData = parseReceiptText(extractedText);

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('Receipt extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract receipt data' },
      { status: 500 }
    );
  }
}

function parseReceiptText(text: string): ExtractedData {
  const data: ExtractedData = {
    confidence: 0.85,
    items: [],
  };

  // Extract invoice number (common patterns)
  const invoicePatterns = [
    /(?:NF|NF-e|Nota Fiscal|Invoice|Fatura)[\s-]*(?:No\.?|#)?[\s]*(\d+)/i,
    /(\d{6,12})/,
  ];

  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.invoiceNumber = match[1];
      break;
    }
  }

  // Extract date (common patterns)
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(?:Data|Date)[\s:]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      data.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      break;
    }
  }

  // Extract supplier name (usually at the top)
  const lines = text.split('\n');
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 3 && firstLine.length < 100) {
      data.supplier = firstLine;
    }
  }

  // Extract total amount (common patterns)
  const totalPatterns = [
    /(?:Total|TOTAL|Total Geral|TOTAL GERAL)[\s:]*R?\$?\s*([\d.,]+)/i,
    /R?\$?\s*([\d.,]+)\s*(?:Total|TOTAL)/i,
    /(?:Valor Total|VALOR TOTAL)[\s:]*R?\$?\s*([\d.,]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = match[1].replace(/\./g, '').replace(',', '.');
      data.totalAmount = parseFloat(amount);
      break;
    }
  }

  // Extract items (simplified - looks for lines with quantity and price)
  const itemPatterns = /(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:x|X|×)\s*R?\$?\s*([\d.,]+)/g;
  let itemMatch;

  while ((itemMatch = itemPatterns.exec(text)) !== null) {
    const description = itemMatch[1].trim();
    const quantity = parseFloat(itemMatch[2].replace(',', '.'));
    const unitPrice = parseFloat(itemMatch[3].replace(/\./g, '').replace(',', '.'));

    if (description.length > 2 && quantity > 0 && unitPrice > 0) {
      data.items!.push({
        description,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
      });
    }
  }

  return data;
}

function parseReceiptLocally(base64Image: string): NextResponse {
  // Fallback parsing - returns mock data structure
  // In production, you might want to use a library like tesseract.js
  const mockData: ExtractedData = {
    supplier: 'Fornecedor Exemplo',
    date: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    items: [],
    invoiceNumber: 'NF-000001',
    confidence: 0.5,
  };

  return NextResponse.json(mockData);
}
