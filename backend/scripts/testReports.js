// Manual Report Testing Script
// Tests report generation against actual database data
// Run: node scripts/testReports.js

require("../src/config/environment");
const reportService = require("../src/services/report.service");
const db = require("../src/config/database");

async function main() {
  console.log("🔍 Report Generation Test\n");

  try {
    // Find a park manager
    const manager = await db.user.findFirst({
      where: {
        role: "PARK_MANAGER",
        isActive: true,
        approvalStatus: "APPROVED",
      },
      include: {
        park: true,
      },
    });

    if (!manager) {
      console.log("❌ No active park manager found in database");
      console.log("   Create a park manager to test reports\n");
      return;
    }

    console.log(`✅ Testing with manager: ${manager.name}`);
    console.log(`   Park: ${manager.park?.name || "No park assigned"}`);
    console.log(`   Park ID: ${manager.parkId || "N/A"}\n`);

    // Test date range (last 30 days)
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const query = {
      from: from.toISOString(),
      to: to.toISOString(),
      period: "week",
    };

    console.log(`📅 Date Range: ${from.toISOString().split("T")[0]} to ${to.toISOString().split("T")[0]}\n`);

    // Test 1: Incident Report
    console.log("=== TEST 1: Incident Report ===");
    try {
      const incidentReport = await reportService.generateIncidentReport(
        manager,
        query
      );
      console.log(`✅ Report Type: ${incidentReport.reportType}`);
      console.log(`   Total Incidents: ${incidentReport.summary.totalIncidents}`);
      console.log(`   Incidents Returned: ${incidentReport.incidents.length}`);
      console.log(`   By Type: ${JSON.stringify(incidentReport.summary.byType.slice(0, 3))}`);
      console.log(`   By Status: ${JSON.stringify(incidentReport.summary.byStatus.slice(0, 3))}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 2: Patrol Report
    console.log("=== TEST 2: Patrol Operations Report ===");
    try {
      const patrolReport = await reportService.generatePatrolReport(
        manager,
        query
      );
      console.log(`✅ Report Type: ${patrolReport.reportType}`);
      console.log(`   Total Patrols: ${patrolReport.summary.totalPatrols}`);
      console.log(`   Patrols Returned: ${patrolReport.patrols.length}`);
      console.log(`   By Status: ${JSON.stringify(patrolReport.summary.byStatus.slice(0, 3))}`);
      console.log(`   By Type: ${JSON.stringify(patrolReport.summary.byType.slice(0, 3))}`);
      console.log(`   By Priority: ${JSON.stringify(patrolReport.summary.byPriority.slice(0, 3))}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 3: Conflict Trend Report
    console.log("=== TEST 3: Conflict Trend Report ===");
    try {
      const conflictReport = await reportService.generateConflictTrendReport(
        manager,
        query
      );
      console.log(`✅ Report Type: ${conflictReport.reportType}`);
      console.log(`   Total Reports: ${conflictReport.summary.totalReports}`);
      console.log(`   Conflict Reports: ${conflictReport.summary.conflictReports}`);
      console.log(`   Reports Returned: ${conflictReport.reports.length}`);
      console.log(`   By Type: ${JSON.stringify(conflictReport.summary.byType.slice(0, 3))}`);
      console.log(`   By Status: ${JSON.stringify(conflictReport.summary.byStatus.slice(0, 3))}`);
      console.log(`   Top Areas: ${JSON.stringify(conflictReport.summary.byArea.slice(0, 3))}`);

      // Verify no sensitive data exposed
      if (conflictReport.reports.length > 0) {
        const firstReport = conflictReport.reports[0];
        const hasSensitiveData =
          "reporterName" in firstReport ||
          "reporterPhone" in firstReport ||
          "description" in firstReport;
        if (hasSensitiveData) {
          console.log(`   ⚠️  WARNING: Sensitive data exposed in reports!`);
        } else {
          console.log(`   ✅ No sensitive community data exposed`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 4: Export Formats
    console.log("=== TEST 4: Export Formats ===");
    try {
      const { exportToCSV, exportToHTML } = require("../src/utils/export.util");
      const testReport = await reportService.generateIncidentReport(
        manager,
        query
      );

      const csv = exportToCSV(testReport);
      console.log(`✅ CSV Export: ${csv.split("\n").length} lines generated`);
      console.log(`   First line: ${csv.split("\n")[0]}`);

      const html = exportToHTML(testReport);
      console.log(`✅ HTML Export: ${html.length} characters generated`);
      console.log(`   Contains DOCTYPE: ${html.includes("<!DOCTYPE html>")}`);
      console.log(`   Contains WildGuard: ${html.includes("WildGuard")}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    // Test 5: Filters
    console.log("=== TEST 5: Filter Application ===");
    try {
      const filteredQuery = {
        ...query,
        type: "POACHING_SNARE",
        status: "RESOLVED",
      };
      const filteredReport = await reportService.generateIncidentReport(
        manager,
        filteredQuery
      );
      console.log(`✅ Filtered Report Generated`);
      console.log(`   Applied Type Filter: ${filteredReport.filters.type || "None"}`);
      console.log(`   Applied Status Filter: ${filteredReport.filters.status || "None"}`);
      console.log(`   Filtered Incidents: ${filteredReport.incidents.length}`);

      // Verify filtering worked
      if (filteredReport.incidents.length > 0) {
        const allMatchType = filteredReport.incidents.every(
          (inc) => inc.type === filteredQuery.type
        );
        const allMatchStatus = filteredReport.incidents.every(
          (inc) => inc.status === filteredQuery.status
        );
        console.log(`   Type Filter Applied: ${allMatchType ? "✅" : "❌"}`);
        console.log(`   Status Filter Applied: ${allMatchStatus ? "✅" : "❌"}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log("");

    console.log("✅ All report tests completed\n");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
