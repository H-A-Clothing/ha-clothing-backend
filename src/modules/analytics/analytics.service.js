// Business logic and CSV report builder for store analytics.
import * as analyticsRepo from "./analytics.repository.js";

export async function getDashboardSummary(filters) {
  const [overview, salesTrend, statusBreakdown, topProducts, categorySales] =
    await Promise.all([
      analyticsRepo.getOverviewMetrics(filters),
      analyticsRepo.getSalesTrend(filters),
      analyticsRepo.getOrderStatusBreakdown(filters),
      analyticsRepo.getTopProducts(filters),
      analyticsRepo.getCategorySales(filters),
    ]);

  return {
    range: { from: filters.from, to: filters.to },
    overview,
    salesTrend,
    statusBreakdown,
    topProducts,
    categorySales,
  };
}

export function formatSalesTrendToCsv(rows) {
  const header = "Date,Completed Orders,Revenue";
  const lines = rows.map((row) => `${row.date},${row.orders},${row.revenue}`);
  return [header, ...lines].join("\n");
}

export async function buildSalesReportCsv(filters) {
  const trend = await analyticsRepo.getSalesTrend(filters);
  return formatSalesTrendToCsv(trend);
}
