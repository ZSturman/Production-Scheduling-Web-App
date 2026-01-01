import { NextRequest, NextResponse } from 'next/server';
import { 
  withAuth,
  acceptInvite,
  setUserCustomClaims,
} from '@/lib/server';
import type { JoinOrganizationRequest } from '@/types';

// POST /api/organizations/join - Join an organization via invite code
export const POST = withAuth(async (request, context) => {
  try {
    const body = await request.json() as JoinOrganizationRequest;

    if (!body.inviteCode) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_INVITE_CODE',
          message: 'Invite code is required',
        },
      }, { status: 400 });
    }

    // Check if user is already in an org
    if (context.org) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_IN_ORG',
          message: 'You are already a member of an organization',
        },
      }, { status: 400 });
    }

    const result = await acceptInvite(
      body.inviteCode,
      context.user.uid,
      context.user.email,
      context.user.displayName
    );

    if (!result) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVITE_NOT_FOUND',
          message: 'Invite not found or has expired',
        },
      }, { status: 404 });
    }

    await setUserCustomClaims(context.user.uid, {
      orgId: result.organization.id,
      role: result.member.role,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to join organization:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'JOIN_FAILED',
        message: 'Failed to join organization',
      },
    }, { status: 500 });
  }
});
