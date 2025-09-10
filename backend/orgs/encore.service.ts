import { Service } from "encore.dev/service";

export default new Service("orgs");

// Export all organization endpoints
export { create } from "./create";
export { invite } from "./invite";