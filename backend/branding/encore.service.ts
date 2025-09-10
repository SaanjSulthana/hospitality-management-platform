import { Service } from "encore.dev/service";

export default new Service("branding");

// Export all branding endpoints
export { getTheme } from "./get_theme";
export { updateTheme } from "./update_theme";
export { uploadLogo } from "./upload_logo";
export { serveLogo } from "./serve_logo";