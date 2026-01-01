import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  findUserOrganization,
  getGoogleSheetsConfig,
} from '@/lib/server';

// GET /api/organizations/me - Get current user's organization
export const GET = withOrg(async (request, context) => {
  try {
    const orgData = await findUserOrganization(context.user.uid);
    
    if (!orgData) {
      return NextResponse.json({
        success: true,
        data: {
          organization: null,
          configStatus: 'not_joined',
          googleSheetsConfigured: false,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const { organization, member } = orgData;
    const sheetsConfig = await getGoogleSheetsConfig(organization.id);
    const googleSheetsConfigured = !!(sheetsConfig && sheetsConfig.spreadsheetId);

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          configStatus: googleSheetsConfigured ? 'configured' : 'needs_setup',
          memberCount: organization.memberCount || 1,
        },
        membership: {
          role: member.role,
          joinedAt: member.joinedAt,
        },
        configStatus: googleSheetsConfigured ? 'configured' : 'needs_setup',
        googleSheetsConfigured,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to get organization:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_ORG_FAILED',
        message: 'Failed to get organization',
      },
    }, { status: 500 });
  }
});
