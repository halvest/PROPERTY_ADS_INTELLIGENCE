/**
 * Embedded Signup v5 is the current stable flow.
 * Business-app onboarding is on by default, so featureType is not sent.
 * app_only_install keeps a granular token and skips phone registration.
 */
export const EMBEDDED_SIGNUP_EXTRAS = {
  version: "v5",
  features: [{ name: "app_only_install" }],
} as const;
