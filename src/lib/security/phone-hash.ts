import crypto from "node:crypto";

/**
 * Deterministic HMAC of an E.164 phone number.
 * The same salt and digit normalization as CRM import, so a WhatsApp wa_id
 * can be compared with a CRM contact without storing another raw number.
 */
export function hashPhoneNumber(phone: string, secretSalt?: string): string {
  const salt =
    secretSalt ||
    process.env.PHONE_HASH_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("PHONE_HASH_SECRET wajib dikonfigurasi di production.");
        })()
      : "property_ads_salt");
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }
  return crypto.createHmac("sha256", salt).update(cleanPhone).digest("hex");
}
