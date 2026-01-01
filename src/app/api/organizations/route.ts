import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  withAuth, 
  withOrg,
  setUserCustomClaims,
  createOrganization,
  getOrganization,
  getOrganizationMembers,
  createInvite,
  getOrganizationInvites,
  findUserOrganization,
} from '@/lib/server';
import type { CreateOrganizationRequest } from '@/types';

// POST /api/organizations - Create a new organization
export const POST = withAuth(async (request, context) => {
  try {
    const body = await request.json() as CreateOrganizationRequest;

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'Organization name must be at least 2 characters',
        },
      }, { status: 400 });
    }

    // Check if user is already in an org
    const existingOrg = await findUserOrganization(context.user.uid);
    if (existingOrg) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_IN_ORG',
          message: 'You are already a member of an organization',
          details: { orgId: existingOrg.organization.id, orgName: existingOrg.organization.name },
        },
      }, { status: 400 });
    }

    const { organization, member } = await createOrganization(
      body.name.trim(),
      context.user.uid,
      context.user.email,
      context.user.displayName
    );

    await setUserCustomClaims(context.user.uid, {
      orgId: organization.id,
      role: 'admin',
    });

    return NextResponse.json({
      success: true,
      data: { organization, member },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create organization:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_ORG_FAILED',
        message: 'Failed to create organization',
      },
    }, { status: 500 });
  }
});

// GET /api/organizations - Get current user's organization
export const GET = withAuth(async (request, context) => {
  try {
    if (!context.org) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_ORGANIZATION',
          message: 'You are not a member of any organization',
        },
      }, { status: 404 });
    }

    const organization = await getOrganization(context.org.orgId);
    const members = await getOrganizationMembers(context.org.orgId);

    return NextResponse.json({
      success: true,
      data: {
        organization,
        members,
        currentMember: members.find(m => m.uid === context.user.uid),
        configStatus: context.org.configStatus,
        googleSheetsConfigured: !!context.org.googleSheetsConfig,
      },
    });
  } catch (error) {
    console.error('Failed to get organization:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_ORG_FAILED',
        message: 'Failed to get organization details',
      },
    }, { status: 500 });
  }
});
