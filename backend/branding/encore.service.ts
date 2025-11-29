import { Service } from "encore.dev/service";

export default new Service("branding");

// Export all branding endpoints
export { getTheme } from "./get_theme";
export { updateTheme } from "./update_theme";
export { uploadLogo } from "./upload_logo";
export { serveLogo } from "./serve_logo";

// Register realtime subscriber (buffers events for long-poll)
import "./branding_realtime_subscriber";

// Export realtime subscribe endpoint
export { subscribeBrandingRealtime } from "./subscribe_realtime";