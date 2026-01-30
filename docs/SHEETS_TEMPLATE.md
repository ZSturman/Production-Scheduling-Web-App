# Google Sheets Template Setup

This document describes how to set up the Google Sheets template for the Manufacturing Scheduler.

## Quick Setup

1. Create a new Google Spreadsheet
2. Create the following sheets (tabs):
   - Products
   - Work Centers
   - Holidays
   - Settings
   - Schedule View (will be auto-populated by Apps Script)

## Sheet Structures

### Products Sheet

Copy this header row (tab-separated):

```
Job Number	Customer	Product Text	Balance Quantity	Requested Ship Date	Work Center	Priority	UPH	Setup Time (hrs)	Ends Type	Scheduled Start	Scheduled End	Schedule Status	Schedule Locked	Lock Reason	Priority Updated At	Notes
```

Sample data (tab-separated):
```
J001	ABC Corp	Steel Rod 10mm	1000	2025-02-15	STRAIGHT	1	100	0.5	Straight				FALSE		
J002	XYZ Inc	Steel Rod 15mm	500	2025-02-20	STRAIGHT	2	80	0.75	Straight				FALSE		
J003	DEF Ltd	Flanged Tube 20mm	200	2025-02-18	FLANGE	1	50	1	Flange				FALSE		
```

### Work Centers Sheet

Copy this header row (tab-separated):

```
ID	Name	Type	Active	Default UPH	Mon Start	Mon End	Tue Start	Tue End	Wed Start	Wed End	Thu Start	Thu End	Fri Start	Fri End	Sat Start	Sat End	Sun Start	Sun End
```

Sample data (18 default work centers, tab-separated):
```
STRAIGHT	Straight Cutting	Cutting	TRUE	100	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
ANGLED	Angled Cutting	Cutting	TRUE	80	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
FLANGE	Flange Forming	Forming	TRUE	50	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
SWAGE	Swaging	Forming	TRUE	60	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
WELD_MIG	MIG Welding	Welding	TRUE	40	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
WELD_TIG	TIG Welding	Welding	TRUE	30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
WELD_SPOT	Spot Welding	Welding	TRUE	100	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
BEND	Bending	Forming	TRUE	70	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
DRILL	Drilling	Machining	TRUE	80	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
LATHE	Lathe	Machining	TRUE	50	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
MILL	Milling	Machining	TRUE	45	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
GRIND	Grinding	Finishing	TRUE	90	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
POLISH	Polishing	Finishing	TRUE	85	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
PAINT	Painting	Finishing	TRUE	60	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
POWDER	Powder Coating	Finishing	TRUE	55	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
ASSEMBLE	Assembly	Assembly	TRUE	75	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
INSPECT	Quality Inspection	QC	TRUE	120	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
PACK	Packaging	Shipping	TRUE	150	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30	07:00	15:30			
```

### Holidays Sheet

Copy this header row (tab-separated):

```
Date	Name	Affected Work Centers
```

Sample data (tab-separated):
```
2025-01-01	New Year's Day	ALL
2025-01-20	MLK Day	ALL
2025-02-17	Presidents' Day	ALL
2025-05-26	Memorial Day	ALL
2025-07-04	Independence Day	ALL
2025-09-01	Labor Day	ALL
2025-11-27	Thanksgiving	ALL
2025-11-28	Day After Thanksgiving	ALL
2025-12-24	Christmas Eve	ALL
2025-12-25	Christmas Day	ALL
2025-12-31	New Year's Eve	ALL
```

### Settings Sheet

Create a 2-column key-value format:

| Setting | Value |
|---------|-------|
| atRiskBufferDays | 2 |
| syncIntervalSeconds | 60 |
| defaultPriorityPosition | end |

## Service Account Setup

### Step 1: Enable Google Sheets API

**⚠️ CRITICAL: You must enable the API before the service account will work!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **Library**
4. Search for "Google Sheets API"
5. Click on **Google Sheets API**
6. Click **Enable**
7. Wait 1-2 minutes for the API to fully activate

### Step 2: Create Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g., "production-scheduler")
4. Click **Create and Continue**
5. Grant role: **Editor** or **Owner** (recommended)
6. Click **Done**

### Step 3: Create and Download JSON Key

1. Click on your newly created service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Click **Create** - the JSON file will download automatically
6. Save this file securely (e.g., `service-account.json`)

### Step 4: Share Google Sheet with Service Account

1. Open your service account JSON file
2. Find the `client_email` field (e.g., `production-scheduler@your-project.iam.gserviceaccount.com`)
3. Open your Google Sheet
4. Click **Share** button
5. Paste the service account email
6. Grant **Editor** access
7. Uncheck "Notify people" (service accounts don't need notifications)
8. Click **Share**

### Troubleshooting

**Error: "Google Sheets API has not been used in project ... or it is disabled"**
- Go to the [API enable link](https://console.developers.google.com/apis/api/sheets.googleapis.com/overview) for your project
- Click **Enable**
- Wait 1-2 minutes and try again

**Error: "The caller does not have permission"**
- Verify the service account email has Editor access to your spreadsheet
- Check that you're sharing with the correct email from the JSON file

**Error: "Requested entity was not found"**
- Double-check your spreadsheet ID in the URL
- Ensure the spreadsheet hasn't been deleted or moved
5. Copy the Spreadsheet ID from the URL

## Column Formatting Suggestions

### Products Sheet
- Balance Quantity: Number format
- Requested Ship Date: Date format (YYYY-MM-DD)
- Priority: Number format
- UPH: Number format
- Setup Time: Number format (0.00)
- Schedule Locked: Checkbox or TRUE/FALSE
- Scheduled Start/End: Date-time format

### Conditional Formatting
Add conditional formatting to Schedule Status column:
- Green fill for "On-Time"
- Yellow fill for "At-Risk"  
- Red fill for "Late"

## Data Validation

### Products Sheet
- Work Center: Dropdown from Work Centers!$A$2:$A
- Ends Type: Dropdown list (Straight, Flange, Swaged, Other)
- Schedule Locked: Checkbox

### Work Centers Sheet
- Active: Checkbox
- Type: Dropdown list (Cutting, Forming, Welding, Machining, Finishing, Assembly, QC, Shipping, Other)
