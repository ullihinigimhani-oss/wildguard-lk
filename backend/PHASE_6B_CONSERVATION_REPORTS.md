# Phase 6B: Conservation Reporting Documentation

## Overview

Conservation Reporting provides Park Managers with the ability to generate, preview, and export formatted reports based on operational data. All reports use actual database data and reuse existing analytics services.

## Implementation Summary

### Files Created

#### Backend Services
- `src/services/report.service.js` - Report generation service (reuses analytics)
- `src/validators/report.validator.js` - Query validation for reports
- `src/utils/export.util.js` - CSV and HTML export formatters
- `src/controllers/report.controller.js` - HTTP request handlers
- `src/routes/report.routes.js` - API route definitions

#### Tests
- `tests/report.service.test.js` - Service layer tests (12 tests, all passing)
- `tests/report.api.test.js` - API integration tests
- `scripts/testReports.js` - Manual testing script against real database

### API Endpoints

All endpoints require authentication and `PARK_MANAGER` role.

**Base URL**: `/api/reports`

#### 1. GET /api/reports/types
Get available report types and their descriptions.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "type": "INCIDENT",
      "name": "Incident Report",
      "description": "Detailed analysis of field incidents including types, statuses, and trends",
      "filters": ["dateRange", "area", "type", "status"]
    },
    {
      "type": "PATROL",
      "name": "Patrol Operations Report",
      "description": "Patrol activity overview including coverage, status, and operational metrics",
      "filters": ["dateRange", "area", "type", "status", "priority"]
    },
    {
      "type": "CONFLICT_TREND",
      "name": "Human-Wildlife Conflict Trend Report",
      "description": "Community-reported conflicts and trends by location and species",
      "filters": ["dateRange", "area", "type", "status"]
    }
  ]
}
```

#### 2. GET /api/reports/generate
Generate a report with preview data.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reportType | string | Yes | INCIDENT, PATROL, or CONFLICT_TREND |
| from | ISO8601 date | No | Start date for report period |
| to | ISO8601 date | No | End date for report period |
| period | string | No | Aggregation period: day, week, month (default: month) |
| area | string | No | Filter by location/area text |
| type | string | No | Filter by incident/patrol/report type |
| status | string | No | Filter by status |
| priority | string | No | Filter by priority (patrol reports only) |

**Example Request**:
```
GET /api/reports/generate?reportType=INCIDENT&from=2026-01-01&to=2026-12-31&type=POACHING_SNARE
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reportType": "INCIDENT_REPORT",
    "generatedAt": "2026-10-09T10:30:00.000Z",
    "generatedBy": {
      "name": "John Manager",
      "role": "PARK_MANAGER"
    },
    "filters": {
      "dateFrom": "2026-01-01T00:00:00.000Z",
      "dateTo": "2026-12-31T23:59:59.999Z",
      "type": "POACHING_SNARE",
      "status": null,
      "area": null
    },
    "summary": {
      "totalIncidents": 45,
      "byType": [
        { "key": "POACHING_SNARE", "count": 45 }
      ],
      "byStatus": [
        { "key": "RESOLVED", "count": 30 },
        { "key": "PENDING", "count": 10 },
        { "key": "UNDER_REVIEW", "count": 5 }
      ],
      "trend": [
        { "bucket": "2026-01-01T00:00:00.000Z", "label": "2026-01-01", "count": 5 },
        { "bucket": "2026-01-08T00:00:00.000Z", "label": "2026-01-08", "count": 3 }
      ]
    },
    "incidents": [
      {
        "id": "incident-123",
        "title": "Snare trap found",
        "type": "POACHING_SNARE",
        "status": "RESOLVED",
        "reportedAt": "2026-01-15T08:30:00.000Z",
        "occurredAt": "2026-01-15T06:00:00.000Z",
        "location": "Block 10, Yala",
        "reporterName": "Ranger Silva",
        "reporterRole": "RANGER",
        "patrolRoute": "Morning Patrol Route 3"
      }
    ]
  }
}
```

#### 3. GET /api/reports/export
Export a report in the specified format.

**Query Parameters**:
Same as `/generate` plus:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | No | JSON, CSV, or PDF (default: JSON) |

**Response**: File download with appropriate Content-Type and Content-Disposition headers.

- **JSON**: `application/json`, `.json` file
- **CSV**: `text/csv`, `.csv` file  
- **PDF**: `text/html`, `.html` file (client converts to PDF)

**Example Requests**:
```
GET /api/reports/export?reportType=PATROL&format=CSV&from=2026-01-01&to=2026-03-31
GET /api/reports/export?reportType=CONFLICT_TREND&format=PDF&from=2026-06-01&to=2026-06-30
```

## Report Types

### 1. Incident Report (`INCIDENT`)

**Purpose**: Detailed analysis of field incidents

**Data Sources**:
- Analytics Service: `analyticsService.incidents()`
- Database: `incident` table with reporter and patrol relations

**Summary Includes**:
- Total incident count
- Incidents by type (POACHING_SNARE, WILDLIFE_CONFLICT, etc.)
- Incidents by status (PENDING, RESOLVED, etc.)
- Trend over time (period-based aggregation)

**Detail Records**:
- Incident ID, title, type, status
- Reported date, occurred date
- Location (manual or coordinates)
- Reporter name and role
- Associated patrol route (if any)

**Filters Available**:
- Date range (from/to)
- Incident type
- Status
- Area/location text search

### 2. Patrol Operations Report (`PATROL`)

**Purpose**: Patrol activity and operational metrics

**Data Sources**:
- Analytics Service: `analyticsService.patrols()`
- Database: `patrol` table with ranger and creator relations

**Summary Includes**:
- Total patrol count
- Patrols by status (SCHEDULED, COMPLETED, etc.)
- Patrols by type (ROUTINE, ANTI_POACHING, etc.)
- Patrols by priority (LOW, MEDIUM, HIGH)
- Trend over time

**Detail Records**:
- Patrol ID, route name, type, priority, status
- Scheduled date, actual start/end times
- Location
- Assigned ranger name
- Created by (manager)
- Waypoint count
- Related incident count

**Filters Available**:
- Date range (from/to)
- Patrol type
- Status
- Priority
- Area/location text search

### 3. Human-Wildlife Conflict Trend Report (`CONFLICT_TREND`)

**Purpose**: Community-reported conflicts and trends

**Data Sources**:
- Analytics Service: `analyticsService.communityReports()`
- Database: `communityReport` table (NO reporter identity fields)

**Summary Includes**:
- Total report count
- Conflict report count (HUMAN_WILDLIFE_CONFLICT type)
- Reports by type
- Reports by status
- Reports by area (location-based aggregation)
- Trend over time

**Detail Records**:
- Report ID, type, species, status
- Submitted date
- Location (manual or coordinates)
- Anonymous flag
- **NO** reporter name, phone, or description (privacy protected)

**Filters Available**:
- Date range (from/to)
- Report type
- Status
- Area/location text search

## Security

### Authorization
- All report endpoints require authentication
- All report endpoints require `PARK_MANAGER` role
- Park managers can only access data for their assigned park (enforced by analytics service)

### Data Privacy
- Community report details **never** include:
  - Reporter name
  - Reporter phone
  - Report description
- Only aggregated and anonymized location data is shown
- Incident and patrol records show reporter names (internal staff only)

### Cache Control
- All responses include `Cache-Control: no-store` headers
- Reports are generated fresh for each request
- Export downloads are not cached

## Export Formats

### JSON
- Default format
- Full structured data
- Suitable for programmatic processing
- Content-Type: `application/json`

### CSV
- Tabular export format
- Includes report metadata, filters, summary tables, and detail records
- Suitable for spreadsheet analysis
- Special characters are properly escaped
- Content-Type: `text/csv`

**CSV Structure**:
```
Report Type,INCIDENT_REPORT
Generated At,2026-10-09T10:30:00.000Z
Generated By,John Manager (PARK_MANAGER)

FILTERS
Date From,2026-01-01
Date To,2026-12-31

SUMMARY
Total Incidents,45

By Type
Type,Count
POACHING_SNARE,30
WILDLIFE_CONFLICT,15

INCIDENTS
ID,Title,Type,Status,Reported At,Location,Reporter
incident-123,"Snare found",POACHING_SNARE,RESOLVED,2026-01-15,...
```

### PDF (HTML)
- Formatted HTML document suitable for PDF conversion
- Includes WildGuard branding and styling
- Tables and charts for summary data
- Detail records (limited to first 50 for performance)
- Content-Type: `text/html`
- Frontend can convert to PDF using browser print API

**HTML includes**:
- Report header with metadata
- Styled summary tables
- Detail record tables
- WildGuard conservation branding
- Print-friendly CSS

## Testing

### Automated Tests

#### Service Tests (`tests/report.service.test.js`)
✅ **12 tests passing**

Tests include:
- Generate reports with no data
- Generate reports with actual data
- Filter by type, status, date range
- Route to correct report generator
- Error handling for invalid inputs
- Privacy: verify no sensitive community data exposed

Run:
```bash
npm test -- report.service.test.js
```

### Manual Testing

#### Test Script (`scripts/testReports.js`)
Comprehensive manual test against actual database:

```bash
node scripts/testReports.js
```

Tests:
- All three report types
- Export formats (CSV, HTML)
- Filter application
- Data privacy compliance
- Date range handling

**Prerequisites**:
- Database must have at least one active PARK_MANAGER
- Database should have some incidents, patrols, and community reports

### API Testing with Postman/curl

**Get Report Types**:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/reports/types
```

**Generate Incident Report**:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/reports/generate?reportType=INCIDENT&from=2026-01-01&to=2026-12-31"
```

**Export CSV**:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/reports/export?reportType=PATROL&format=CSV&from=2026-01-01&to=2026-12-31" \
  -o patrol_report.csv
```

**Export HTML/PDF**:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/reports/export?reportType=CONFLICT_TREND&format=PDF&from=2026-06-01&to=2026-06-30" \
  -o conflict_report.html
```

## Architecture

### Service Layer Reuse
The report service **reuses** the existing analytics service rather than duplicating aggregation logic:

```javascript
// Report service calls analytics service
const analytics = await analyticsService.incidents(user, {
  from: filters.from?.toISOString(),
  to: filters.to?.toISOString(),
  period: filters.period,
  area: filters.area,
  type: filters.type,
  status: filters.status,
});
```

This ensures:
- Consistent aggregation logic
- Single source of truth for KPIs
- Reduced code duplication
- Easier maintenance

### Data Flow

```
Client Request
    ↓
Report Routes (/api/reports/*)
    ↓
Report Controller (validates reportType, format)
    ↓
Report Service (orchestrates generation)
    ↓
├─→ Analytics Service (aggregated summaries)
│       ↓
│   Analytics Repository (optimized queries)
│
└─→ Direct DB Queries (detail records)
    ↓
Export Util (formatters)
    ↓
HTTP Response (JSON/CSV/HTML)
```

### Database Queries
- **Aggregations**: Via analytics service (optimized, tested)
- **Detail records**: Direct Prisma queries with selected fields only
- **Park scoping**: Applied automatically where user has parkId
- **Date filtering**: Applied at database level for performance

## Error Handling

All errors return structured JSON:

```json
{
  "success": false,
  "message": "Error message",
  "validationError": true,  // if validation error
  "fields": {               // validation errors only
    "reportType": "Invalid report type"
  }
}
```

Common errors:
- `400`: Invalid query parameters (date format, unknown type, etc.)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (not PARK_MANAGER role)
- `500`: Internal server error

## Frontend Integration

### React/Mobile Implementation Pattern

```typescript
// 1. Fetch available report types
const reportTypes = await fetch('/api/reports/types', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 2. Let user select report type and filters
const [reportType, setReportType] = useState('INCIDENT');
const [dateFrom, setDateFrom] = useState('2026-01-01');
const [dateTo, setDateTo] = useState('2026-12-31');
const [filters, setFilters] = useState({});

// 3. Generate preview
const preview = await fetch(
  `/api/reports/generate?reportType=${reportType}&from=${dateFrom}&to=${dateTo}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);

// 4. Display summary and charts
<ReportSummary data={preview.data.summary} />
<ReportChart trend={preview.data.summary.trend} />
<ReportTable records={preview.data.incidents || preview.data.patrols || preview.data.reports} />

// 5. Export to file
const exportUrl = `/api/reports/export?reportType=${reportType}&format=CSV&from=${dateFrom}&to=${dateTo}`;
window.open(exportUrl, '_blank'); // Browser handles download

// 6. Convert HTML to PDF (optional)
const htmlResponse = await fetch(
  `/api/reports/export?reportType=${reportType}&format=PDF&from=${dateFrom}&to=${dateTo}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const html = await htmlResponse.text();
// Use library like jsPDF, html2pdf, or browser print API
```

## Performance Considerations

### Query Optimization
- Analytics queries use indexed fields (parkId, status, dates)
- Detail queries limit selected fields
- Date ranges applied at database level
- No N+1 queries (uses includes for relations)

### Export Limits
- HTML/PDF exports limit detail records to 50 rows
- Full data available in CSV and JSON formats
- Trend data aggregated by period (not per-record)

### Caching
- Reports are generated fresh (no caching)
- Cache-Control: no-store prevents stale data
- Consider implementing report caching if performance becomes an issue

## Future Enhancements

Potential improvements (not implemented):
1. **Scheduled Reports**: Email reports on schedule
2. **Report Templates**: Custom report layouts
3. **Chart Generation**: Server-side chart images
4. **PDF Generation**: Native PDF (requires library like puppeteer)
5. **Report History**: Save and retrieve past reports
6. **Custom Filters**: User-defined filter combinations
7. **Comparative Reports**: Year-over-year comparisons
8. **Export to Excel**: Native .xlsx format

## Compliance and Privacy

### Community Data Protection
The system protects community reporter privacy:
- ✅ No reporter names in conflict trend reports
- ✅ No phone numbers exposed
- ✅ No report descriptions (may contain sensitive info)
- ✅ Only aggregated location data shown
- ✅ Anonymous flag preserved

### Staff Data
Internal staff (rangers, managers) are not anonymous:
- Incident reporter names shown (rangers)
- Patrol ranger names shown
- Manager names shown

This is appropriate for internal operational reports.

## Conclusion

Phase 6B Conservation Reporting is **complete and tested**:
- ✅ 3 report types implemented
- ✅ Generate and preview functionality
- ✅ Export in JSON, CSV, and HTML formats
- ✅ Reuses existing analytics services
- ✅ Protected by authentication and authorization
- ✅ Community data privacy maintained
- ✅ Automated tests passing
- ✅ Manual test script provided
- ✅ Comprehensive documentation

Ready for frontend integration.
