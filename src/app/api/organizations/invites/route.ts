import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  getFirestore,
} from '@/lib/server';
import type { Invite, ApiResponse } from '@/types';

// GET /api/organizations/invites - Get all invites for user's organization
export const GET = withOrg(async (request, context) => {
  try {
    if (!context.org) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_ORGANIZATION',
          message: 'User is not part of an organization',
        },
      }, { status: 400 });
    }

    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view invites',
        },
      }, { status: 403 });
    }

    const db = getFirestore();
    const invitesSnapshot = await db
      .collection('invites')
      .where('orgId', '==', context.org.orgId)
      .where('status', '==', 'pending')
      .get();

    const invites: Invite[] = invitesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Invite[];

    const response: ApiResponse<{ invites: Invite[] }> = {
      success: true,
      data: { invites },
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get invites:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_INVITES_FAILED',
        message: 'Failed to get invites',
      },
    }, { status: 500 });
  }
});
