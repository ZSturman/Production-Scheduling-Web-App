import { NextRequest, NextResponse } from 'next/server';
import { getInviteByCode } from '@/lib/server';

// GET /api/organizations/invite/[code] - Get invite details by code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const invite = await getInviteByCode(code);

    if (!invite) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVITE_NOT_FOUND',
          message: 'Invite not found or has expired',
        },
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        orgName: invite.orgName,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Failed to get invite:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_INVITE_FAILED',
        message: 'Failed to get invite details',
      },
    }, { status: 500 });
  }
}
