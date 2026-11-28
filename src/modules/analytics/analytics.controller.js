// HTTP handlers for Member 8 analytics endpoints.
import * as analyticsService from "./analytics.service.js";
import { validateAnalyticsQuery } from "./analytics.validation.js";

export async function getDashboard(req, res, next) {
  try {
    const filters = validateAnalyticsQuery(req.query);
    const summary = await analyticsService.getDashboardSummary(filters);
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}

export async function exportSalesCsv(req, res, next) {
  try {
    const filters = validateAnalyticsQuery(req.query);
    const csv = await analyticsService.buildSalesReportCsv(filters);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ha-clothing-sales-${filters.from}-to-${filters.to}.csv"`,
    );
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}
