import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { Product, ProductFilters, ApiResponse } from '@/types';

// GET /api/products - List all products
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: ProductFilters = {
      workCenter: searchParams.get('workCenter') || undefined,
      scheduleStatus: (searchParams.get('scheduleStatus') as ProductFilters['scheduleStatus']) || undefined,
      scheduleLocked: searchParams.get('scheduleLocked') === 'true' ? true : searchParams.get('scheduleLocked') === 'false' ? false : undefined,
      search: searchParams.get('search') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    let products = await sheetsClient.getAllProducts();

    // Apply filters
    if (filters.workCenter) {
      products = products.filter(p => p.workCenter === filters.workCenter);
    }
    if (filters.scheduleStatus) {
      products = products.filter(p => p.scheduleStatus === filters.scheduleStatus);
    }
    if (filters.scheduleLocked !== undefined) {
      products = products.filter(p => p.scheduleLocked === filters.scheduleLocked);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      products = products.filter(p =>
        p.jobNumber.toLowerCase().includes(searchLower) ||
        p.customer.toLowerCase().includes(searchLower) ||
        p.productText.toLowerCase().includes(searchLower)
      );
    }
    if (filters.startDate) {
      products = products.filter(p => p.scheduledStart && p.scheduledStart >= filters.startDate!);
    }
    if (filters.endDate) {
      products = products.filter(p => p.scheduledEnd && p.scheduledEnd <= filters.endDate!);
    }

    // Paginate
    const total = products.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

    const response: ApiResponse<{ products: Product[]; total: number; page: number; pageSize: number }> = {
      success: true,
      data: {
        products: paginatedProducts,
        total,
        page,
        pageSize,
      },
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: startIndex + pageSize < total,
          hasPrevious: page > 1,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get products:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_PRODUCTS_FAILED',
        message: 'Failed to get products',
      },
    }, { status: 500 });
  }
});

// POST /api/products - Create a new product
export const POST = withConfiguredOrg(async (request, context) => {
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

    const input = await request.json();

    if (!input.jobNumber) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job number is required',
        },
      }, { status: 400 });
    }

    if (!input.workCenter) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Work center is required',
        },
      }, { status: 400 });
    }

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const existingProducts = await sheetsClient.getAllProducts();

    if (existingProducts.some(p => p.jobNumber === input.jobNumber)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_JOB',
          message: `Job number ${input.jobNumber} already exists`,
        },
      }, { status: 400 });
    }

    const wcProducts = existingProducts.filter(p => p.workCenter === input.workCenter);
    const maxPriority = wcProducts.reduce((max, p) => Math.max(max, p.priority), 0);
    const priority = input.priority || maxPriority + 1;

    const product: Partial<Product> = {
      jobNumber: input.jobNumber,
      customer: input.customer,
      productText: input.productText,
      quantity: input.quantity,
      length: input.length,
      balanceQuantity: input.balanceQuantity,
      requestedShipDate: input.requestedShipDate,
      setupMinutes: input.setupMinutes,
      uph: input.uph,
      cut: input.cut || false,
      extrusion: input.extrusion || false,
      ground: input.ground || false,
      drawing: input.drawing || '',
      ends: input.ends || '_',
      workCenter: input.workCenter,
      priority,
      priorityUpdatedAt: new Date().toISOString(),
      scheduledStart: null,
      scheduledEnd: null,
      scheduleStatus: 'Unscheduled',
      scheduleLocked: false,
      lockReason: null,
      notes: input.notes,
      customerPO: input.customerPO,
      materialStatus: input.materialStatus,
      lotNumber: input.lotNumber,
    };

    const row = sheetsClient.productToRow(product);
    const rowIndex = await sheetsClient.appendRow(SHEET_NAMES.PRODUCTS, row);

    return NextResponse.json({
      success: true,
      data: { jobNumber: input.jobNumber, rowIndex },
      meta: { timestamp: new Date().toISOString() },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_PRODUCT_FAILED',
        message: 'Failed to create product',
      },
    }, { status: 500 });
  }
});
