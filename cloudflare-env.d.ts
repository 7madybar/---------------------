declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    INITIAL_ADMIN_EMAIL?: string;
    RATE_LIMIT_SALT?: string;
    PUBLIC_FORM_ORIGIN?: string;
    TEAM_CODE_PEPPER?: string;
    INITIAL_ADMIN_CODE_HASH?: string;
    BUCKET?: R2Bucket;
  }
}
