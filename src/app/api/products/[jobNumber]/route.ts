import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  PriorityService,
} from '@/lib/server';

// GET /api/products/[jobNumber] - Get a single product
export const GET = withConfiguredOrg(async (
  request: NextRequest,
  context,
  params?: { params: Promise<{ jobNumber: string }> }
) => {
  try {
    const { jobNumber } = await (params?.params || Promise.resolve({ jobNumber: '' }));
    
    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const products = await sheetsClient.getAllProducts();
    const product = products.find(p => p.jobNumber === jobNumber);

    if (!product) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product ${jobNumber} not found`,
        },
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: product,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to get product:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_PRODUCT_FAILED',
        message: 'Failed to get product',
      },
    }, { status: 500 });
  }
});

// PATCH /api/products/[jobNumber] - Update a product
export const PATCH = withConfiguredOrg(async (
  request: NextRequest,
  context,
  params?: { params: Promise<{ jobNumber: string }> }
) => {
  try {
    if (!['planner', 'admin'].includes(context.user.role)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      }, { status: 403 });
    }

    const { jobNumber } = await (params?.params || Promise.resolve({ jobNumber: '' }));
    const input = await request.json();

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const products = await sheetsClient.getAllProducts();
    const product = products.find(p => p.jobNumber === jobNumber);

    if (!product) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product ${jobNumber} not found`,
        },
      }, { status: 404 });
    }

    // Handle work center change
    if (input.workCenter && input.workCenter !== product.workCenter) {
      const priorityService = new PriorityService(sheetsClient);
      await priorityService.moveToWorkCenter(
        jobNumber,
        product.workCenter,
        input.workCenter,
        input.priority
      );
    }

    // Handle priority change within same work center
    if (input.priority && input.priority !== product.priority && !input.workCenter) {
      const priorityService = new PriorityService(sheetsClient);
      await priorityService.updatePriority(jobNumber, input.priority, product.workCenter);
    }

    // Update the product
    const updatedProduct = { ...product, ...input };
    await sheetsClient.updateProduct(updatedProduct);

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_PRODUCT_FAILED',
        message: 'Failed to update product',
      },
    }, { status: 500 });
  }
});
