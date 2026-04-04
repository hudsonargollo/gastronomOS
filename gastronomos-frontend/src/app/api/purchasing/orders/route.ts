import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.supplier || !data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Supplier and items are required' },
        { status: 400 }
      );
    }

    // In a real application, you would save this to a database
    // For now, we'll return a success response with the data
    const order = {
      id: `PO-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // TODO: Save to database
    // await db.purchaseOrders.create(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch from database
    // const orders = await db.purchaseOrders.findAll();

    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}
