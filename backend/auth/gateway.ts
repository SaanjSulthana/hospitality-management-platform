import { Gateway } from "encore.dev/api";
import { auth } from "./middleware";

// Configure the API gateway to use the auth handler
export const gateway = new Gateway({
	authHandler: auth,
});
