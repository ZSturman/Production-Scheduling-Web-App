import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  withOrg,
  createInvite,
  getOrganizationInvites,
} from '@/lib/server';
import type { InviteUserRequest } from '@/types';

// POST /api/organizations/invite - Create an invite
export const POST = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can invite users',
        },
      }, { status: 403 });
    }

    const body = await request.json() as InviteUserRequest;

    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required',
        },
      }, { status: 400 });
    }

    if (!body.role || !['viewer', 'planner', 'admin'].includes(body.role)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be viewer, planner, or admin',
        },
      }, { status: 400 });
    }

    const inviteCode = uuidv4();
    const invite = await createInvite(
      context.org!.orgId,
      context.org!.orgName,
      body.email.toLowerCase().trim(),
      body.role,
      inviteCode,
      context.user.uid
    );

    const origin = request.headers.get('origin') || '';
    const inviteLink = `${origin}/join/${inviteCode}`;

    return NextResponse.json({
      success: true,
      data: { invite, inviteLink },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create invite:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVITE_FAILED',
        message: 'Failed to create invite',
      },
    }, { status: 500 });
  }
});

// GET /api/organizations/invite - Get pending invites
export const GET = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can view invites',
        },
      }, { status: 403 });
    }

    const invites = await getOrganizationInvites(context.org!.orgId);

    return NextResponse.json({
      success: true,
      data: { invites },
    });
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
