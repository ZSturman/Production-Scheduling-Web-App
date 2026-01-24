# Firestore Database Setup

## Error: 5 NOT_FOUND

If you're seeing this error:
```
Error: 5 NOT_FOUND: 
    at findUserOrganization (src/lib/server/auth.ts:82:6)
```

This means your Firestore database hasn't been created yet in the Firebase Console.

## Setup Steps

### 1. Create Firestore Database

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `production-schedule-manager`
3. Click on **Firestore Database** in the left sidebar (under "Build")
4. Click **Create database**
5. Choose a location (pick one close to your users):
   - `us-central` (Iowa) - Good for US users
   - `us-east1` (South Carolina) - Good for US East Coast
   - `europe-west1` (Belgium) - Good for European users
6. Select **Start in production mode** (you already have security rules in firebase.json)
7. Click **Enable**

### 2. Verify Service Account Permissions

Your service account should have these roles:
- **Cloud Datastore User** or **Editor** role

To verify:
1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
2. Find your service account: `firebase-adminsdk-fbsvc@production-schedule-manager.iam.gserviceaccount.com`
3. Ensure it has the **Firebase Admin SDK Administrator Service Agent** role

### 3. Test the Connection

After creating the database, restart your Next.js development server:

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

Navigate to `/setup` to create your first organization. The system will automatically create the necessary collections and documents.

## Database Structure

Once an organization is created, your Firestore will have this structure:

```
organizations/
  {orgId}/
    - name: string
    - createdAt: timestamp
    - configStatus: 'pending' | 'configured' | 'error'
    
    members/
      {userId}/
        - uid: string
        - email: string
        - role: 'owner' | 'admin' | 'viewer'
        - createdAt: timestamp
    
    products/
      {productId}/
        - jobNumber: string
        - quantity: number
        - etc...
    
    workCenters/
      {workCenterId}/
        - name: string
        - capacity: number
        - etc...
```

## Required Indexes

This application uses **collection group queries** to find users across organization member subcollections. Firestore requires an index exemption for this.

### Error: 9 FAILED_PRECONDITION

If you're seeing this error:
```
Error: 9 FAILED_PRECONDITION: 
    at findUserOrganization (src/lib/server/auth.ts:82:6)
```

This means you're missing the required Firestore index for the collection group query on `members.uid`.

### Fix Option 1: Deploy via Firebase CLI

Run this command from the project root:
```bash
firebase deploy --only firestore:indexes
```

This will create the index defined in `firestore.indexes.json`.

### Fix Option 2: Create Index Manually

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create index** under "Single field" exemptions
5. Configure:
   - **Collection group ID**: `members`
   - **Field path**: `uid`
   - **Collection group scope**: ✓ Enabled
6. Click **Create**

Note: Indexes may take a few minutes to build after creation.

## Common Issues

### "Permission Denied" Error

If you see permission denied after creating the database, check:
1. Service account has correct permissions
2. Security rules in `firebase.json` are correct
3. The service account JSON is valid in `.env.local`

### "Database Not Found" Error

- Make sure you created a **Firestore Database**, not a **Realtime Database**
- Ensure the database is in the same project as your service account

### Connection Timeout

- Check your network/firewall settings
- Verify the project ID in `.env.local` matches the Firebase Console
