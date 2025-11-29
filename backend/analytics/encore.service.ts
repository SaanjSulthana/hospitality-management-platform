import { Service } from "encore.dev/service";

export default new Service("analytics");

// Export all analytics endpoints
export { getOverview } from "./overview";

// Register aggregators/subscribers for realtime
import "./analytics_realtime_aggregator";
import "./analytics_realtime_subscriber";

// Export subscribe endpoint
export { subscribeAnalyticsRealtime } from "./subscribe_realtime";