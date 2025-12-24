# Manufacturing Production Scheduler

A web application for managing manufacturing production schedules using Google Sheets as the data source and system of record.

## Features

- **Automatic Scheduling**: Calculates job start/end times based on work center capacity, UPH (units per hour), and setup time
- **Priority Management**: Cascading priority system where most recent update wins within a work center
- **Gantt Visualization**: Interactive timeline view with color-coded status (On-Time/At-Risk/Late)
- **Schedule Locking**: Lock schedules to prevent recalculation, with visible lock reasons
- **Bidirectional Sync**: Changes in the app sync to Google Sheets and vice versa
- **Role-Based Access**: Viewer, Planner, and Admin roles via Firebase Authentication
- **In-Sheet Gantt**: Google Apps Script provides Gantt visualization directly in the spreadsheet

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Client   │────▶│  Express API    │────▶│  Google Sheets  │
│  (Cloud Run)    │     │  (Cloud Run)    │     │  (Data Source)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         └───────────────────────┼───────────────────────┐
                                 │                       │
                         ┌───────▼───────┐       ┌───────▼───────┐
                         │    Firebase   │       │  Apps Script  │
                         │     Auth      │       │  (In-Sheet)   │
                         └───────────────┘       └───────────────┘
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (Auth, Data)
│   │   ├── lib/            # API client, Firebase config
│   │   └── pages/          # Page components
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── middleware/     # Auth, error handling
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   └── ...
├── shared/                 # Shared types and utilities
│   └── src/types/          # TypeScript interfaces
├── apps-script/            # Google Apps Script
│   ├── Code.gs             # Main script
│   └── appsscript.json     # Manifest
└── deploy/                 # Deployment configs
    ├── Dockerfile.server
    ├── Dockerfile.client
    └── nginx.conf
```

## Prerequisites

- Node.js 20+
- Google Cloud Project with:
  - Cloud Run API enabled
  - Cloud Build API enabled
  - Secret Manager API enabled
- Google Sheets with appropriate structure
- Firebase project with Google Sign-In enabled
- Service account with Google Sheets API access

## Google Sheets Setup

Create a new Google Spreadsheet with the following sheets:

### Products Sheet

| Column | Description |
|--------|-------------|
| Job Number | Unique identifier |
| Customer | Customer name |
| Product Text | Product description |
| Balance Quantity | Quantity to produce |
| Requested Ship Date | Due date (YYYY-MM-DD) |
| Work Center | Assigned work center ID |
| Priority | Priority number (1 = highest) |
| UPH | Units per hour |
| Setup Time (hrs) | Setup time in hours |
| Ends Type | End type (Straight, Flange, etc.) |
| Scheduled Start | Calculated start date |
| Scheduled End | Calculated end date |
| Schedule Status | On-Time / At-Risk / Late |
| Schedule Locked | TRUE/FALSE |
| Lock Reason | Reason for locking |
| Priority Updated At | Timestamp of last priority change |
| Notes | Additional notes |

### Work Centers Sheet

| Column | Description |
|--------|-------------|
| ID | Unique identifier (e.g., STRAIGHT) |
| Name | Display name |
| Type | Category (cutting, welding, etc.) |
| Active | TRUE/FALSE |
| Default UPH | Default units per hour |
| Mon Start/End | Monday hours (e.g., 07:00/15:30) |
| Tue Start/End | Tuesday hours |
| Wed Start/End | Wednesday hours |
| Thu Start/End | Thursday hours |
| Fri Start/End | Friday hours |
| Sat Start/End | Saturday hours (empty if closed) |
| Sun Start/End | Sunday hours |

### Holidays Sheet

| Column | Description |
|--------|-------------|
| Date | Holiday date (YYYY-MM-DD) |
| Name | Holiday name |
| Affected Work Centers | Comma-separated IDs or "ALL" |

### Settings Sheet

| Column | Value |
|--------|-------|
| atRiskBufferDays | 2 |
| syncIntervalSeconds | 60 |
| defaultPriorityPosition | end |

## Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd WebBasedManufacturingProductionSchedulingSystem
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Google Sheets
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

5. Start development servers:
```bash
npm run dev
```

The client will be available at `http://localhost:5173` and the API at `http://localhost:3001`.

## Deployment to Google Cloud Run

### 1. Store Secrets in Secret Manager

```bash
# Google Sheets credentials
gcloud secrets create scheduler-google-credentials \
  --data-file=google-credentials.json

# Firebase credentials
gcloud secrets create scheduler-firebase-credentials \
  --data-file=firebase-credentials.json
```

### 2. Configure Cloud Build Trigger

Create a trigger in Cloud Build connected to your repository. Set substitution variables:
- `_SPREADSHEET_ID`: Your Google Sheets ID
- `_FIREBASE_API_KEY`: Firebase API key
- `_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `_FIREBASE_PROJECT_ID`: Firebase project ID
- etc.

### 3. Deploy

Push to your repository or manually trigger the build:
```bash
gcloud builds submit --config=cloudbuild.yaml
```

## Google Apps Script Setup

1. Open your Google Sheet
2. Go to Extensions > Apps Script
3. Copy contents of `apps-script/Code.gs` into the editor
4. Copy contents of `apps-script/appsscript.json` to Project Settings > appsscript.json
5. Run `setupTriggers` from the Scheduler menu
6. Optionally set `CONFIG.API_URL` to enable API-based recalculation

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List products |
| GET | `/api/products/:jobNumber` | Get product |
| PUT | `/api/products/:jobNumber` | Update product |
| POST | `/api/products/:jobNumber/lock` | Lock schedule |
| POST | `/api/products/:jobNumber/unlock` | Unlock schedule |
| POST | `/api/products/reorder` | Bulk reorder priorities |
| GET | `/api/work-centers` | List work centers |
| GET | `/api/holidays` | List holidays |
| POST | `/api/schedule/recalculate` | Recalculate schedules |
| GET | `/api/schedule/gantt` | Get Gantt data |
| GET | `/api/schedule/summary` | Get summary stats |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/sync/status` | Get sync status |
| POST | `/api/sync/trigger` | Trigger sync |

## Scheduling Algorithm

1. **Filter** jobs by work center
2. **Sort** by priority (ascending, 1 = highest)
3. **Calculate** required hours: `(Balance Qty ÷ UPH) + Setup Time`
4. **Forward Schedule** from current date/time
5. **Split** multi-day jobs across working hours
6. **Skip** holidays and non-working days
7. **Calculate Status** based on scheduled end vs. due date:
   - On-Time: Ends before (due date - buffer days)
   - At-Risk: Ends within buffer days of due date
   - Late: Ends after due date

## Priority Cascade

When a job's priority is changed:
1. The new priority takes effect immediately
2. Other jobs in the same work center shift to maintain sequence
3. `priorityUpdatedAt` timestamp is updated
4. "Most recent update wins" - if two jobs have the same priority, the one updated last keeps its position

## License

MIT
