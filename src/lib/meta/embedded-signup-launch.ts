/**
 * Embedded Signup v5 is the current stable flow.
 * Business-app onboarding is on by default, so featureType is not sent.
 * app_only_install is omitted: it skips phone registration and the live
 * dialog rejects that feature for this login configuration.
 */
export const EMBEDDED_SIGNUP_EXTRAS = {
  version: "v5",
} as const;
