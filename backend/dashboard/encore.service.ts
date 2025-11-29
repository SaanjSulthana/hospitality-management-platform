import { Service } from "encore.dev/service";

export default new Service("dashboard");

// Register aggregators (subscribe to source topics and publish dashboard events)
import "./dashboard_realtime_aggregator";

// Register subscriber that buffers dashboard events for long-poll
import "./dashboard_realtime_subscriber";

// Export subscribe endpoint
export { subscribeDashboardRealtime } from "./subscribe_realtime";


