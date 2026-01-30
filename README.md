# Manufacturing Production Scheduling System

A web-based manufacturing scheduling application built with Next.js, Firebase, and Google Sheets integration.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env.local

# Start development server
npm run dev
```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file with the following variables:

```env
# Firebase (get from Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (service account JSON, base64 encoded)
GOOGLE_APPLICATION_CREDENTIALS_JSON=...

# Encryption key for Google Sheets credentials
ENCRYPTION_KEY=...
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Base64 Encode Service Account

```bash
cat service-account.json | base64
```

## Features

- **Multi-tenant Organizations** - Each organization has isolated data
- **Google Sheets Integration** - Read/write production data from Google Sheets
- **Production Scheduling** - Automatic schedule calculation with work center capacity
- **Gantt Chart View** - Visual timeline of production jobs
- **Job Locking** - Lock jobs to fixed time slots
- **Holiday Management** - Configure holidays that affect scheduling
- **Role-Based Access** - Admin, Planner, and Viewer roles

## Architecture

This is a unified Next.js application that handles both frontend and API routes:

```
client-next/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API route handlers (server-side)
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (dashboard)/     # Main application pages
│   │   └── (onboarding)/    # Setup/onboarding pages
│   ├── contexts/            # React contexts (Auth, Data)
│   ├── lib/
│   │   ├── server/          # Server-only code (Firebase Admin, Sheets API)
│   │   └── firebase.ts      # Client-side Firebase
│   └── types/               # TypeScript type definitions
```

## Deployment

### Firebase Hosting + Cloud Run

1. Build the Docker image:
```bash
docker build -t manufacturing-scheduler .
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy manufacturing-scheduler \
  --image gcr.io/YOUR_PROJECT/manufacturing-scheduler \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. Configure Firebase Hosting to route to Cloud Run:
```bash
firebase deploy --only hosting
```

### Environment Variables in Cloud Run

Set these in the Cloud Run console or via CLI:
- `ENCRYPTION_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (optional if using Cloud Run service account)

## Google Sheets Setup

### Prerequisites

1. **Enable Google Sheets API** in your Google Cloud project:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** > **Library**
   - Search for "Google Sheets API" and click **Enable**
   - ⚠️ **This step is REQUIRED** - the service account won't work without it!

2. **Create a Service Account**:
   - Go to **IAM & Admin** > **Service Accounts**
   - Create a new service account with Editor role
   - Download the JSON key file

3. **Create and Share Google Sheet**:
   - Create a Google Sheet with these tabs:
     - **Products** - Production job data
     - **WorkCenters** - Manufacturing work centers and schedules
     - **Holidays** - Company holidays
     - **Settings** - Application settings (optional)
   - Share the sheet with your service account email (from JSON file)
   - Grant Editor access

See [SHEETS_TEMPLATE.md](docs/SHEETS_TEMPLATE.md) for detailed setup instructions and column requirements.

## Development

```bash
# Run development server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
```

## License

Private - All rights reserved.
