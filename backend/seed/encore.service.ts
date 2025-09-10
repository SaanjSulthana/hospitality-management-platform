import { Service } from "encore.dev/service";

export default new Service("seed");

// Export seed endpoints
export { seedData } from "./seed_data";