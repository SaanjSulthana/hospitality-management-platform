import { Service } from "encore.dev/service";

export default new Service("auth");

// Export all auth endpoints
export { login } from "./login";
export { signup } from "./signup";
export { logout } from "./logout";
export { refresh } from "./refresh";
export { me } from "./me";
export { forgotPassword } from "./forgot_password";
export { resetPassword } from "./reset_password";