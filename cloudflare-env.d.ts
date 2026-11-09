declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    INITIAL_ADMIN_EMAIL?: string;
    RATE_LIMIT_SALT?: string;
    PUBLIC_FORM_ORIGIN?: string;
    TEAM_CODE_PEPPER?: string;
    INITIAL_ADMIN_CODE_HASH?: string;
    OWNER_RECOVERY_ID?: string;
    OWNER_RECOVERY_PROOF?: string;
    OWNER_RECOVERY_EXPIRES_AT?: string;
    BUCKET?: R2Bucket;
  }
}
