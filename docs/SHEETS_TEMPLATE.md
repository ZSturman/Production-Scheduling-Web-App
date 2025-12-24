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

Copy this header row:

```
Job Number | Customer | Product Text | Balance Quantity | Requested Ship Date | Work Center | Priority | UPH | Setup Time (hrs) | Ends Type | Scheduled Start | Scheduled End | Schedule Status | Schedule Locked | Lock Reason | Priority Updated At | Notes
```

Sample data:
```
J001 | ABC Corp | Steel Rod 10mm | 1000 | 2025-02-15 | STRAIGHT | 1 | 100 | 0.5 | Straight | | | | FALSE | | |
J002 | XYZ Inc | Steel Rod 15mm | 500 | 2025-02-20 | STRAIGHT | 2 | 80 | 0.75 | Straight | | | | FALSE | | |
J003 | DEF Ltd | Flanged Tube 20mm | 200 | 2025-02-18 | FLANGE | 1 | 50 | 1 | Flange | | | | FALSE | | |
```

### Work Centers Sheet

Copy this header row:

```
ID | Name | Type | Active | Default UPH | Mon Start | Mon End | Tue Start | Tue End | Wed Start | Wed End | Thu Start | Thu End | Fri Start | Fri End | Sat Start | Sat End | Sun Start | Sun End
```

Sample data (18 default work centers):
```
STRAIGHT | Straight Cutting | Cutting | TRUE | 100 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
ANGLED | Angled Cutting | Cutting | TRUE | 80 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
FLANGE | Flange Forming | Forming | TRUE | 50 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
SWAGE | Swaging | Forming | TRUE | 60 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
WELD_MIG | MIG Welding | Welding | TRUE | 40 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
WELD_TIG | TIG Welding | Welding | TRUE | 30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
WELD_SPOT | Spot Welding | Welding | TRUE | 100 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
BEND | Bending | Forming | TRUE | 70 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
DRILL | Drilling | Machining | TRUE | 80 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
LATHE | Lathe | Machining | TRUE | 50 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
MILL | Milling | Machining | TRUE | 45 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
GRIND | Grinding | Finishing | TRUE | 90 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
POLISH | Polishing | Finishing | TRUE | 85 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
PAINT | Painting | Finishing | TRUE | 60 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
POWDER | Powder Coating | Finishing | TRUE | 55 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
ASSEMBLE | Assembly | Assembly | TRUE | 75 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
INSPECT | Quality Inspection | QC | TRUE | 120 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
PACK | Packaging | Shipping | TRUE | 150 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | 07:00 | 15:30 | | | |
```

### Holidays Sheet

Copy this header row:

```
Date | Name | Affected Work Centers
```

Sample data:
```
2025-01-01 | New Year's Day | ALL
2025-01-20 | MLK Day | ALL
2025-02-17 | Presidents' Day | ALL
2025-05-26 | Memorial Day | ALL
2025-07-04 | Independence Day | ALL
2025-09-01 | Labor Day | ALL
2025-11-27 | Thanksgiving | ALL
2025-11-28 | Day After Thanksgiving | ALL
2025-12-24 | Christmas Eve | ALL
2025-12-25 | Christmas Day | ALL
2025-12-31 | New Year's Eve | ALL
```

### Settings Sheet

Create a 2-column key-value format:

| Setting | Value |
|---------|-------|
| atRiskBufferDays | 2 |
| syncIntervalSeconds | 60 |
| defaultPriorityPosition | end |

## Service Account Setup

1. Go to Google Cloud Console
2. Create a new Service Account
3. Download the JSON key file
4. Share the Google Sheet with the service account email (Editor access)
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
