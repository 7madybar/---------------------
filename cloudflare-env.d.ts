declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    INITIAL_ADMIN_EMAIL?: string;
    RATE_LIMIT_SALT?: string;
    BUCKET?: R2Bucket;
  }
}
