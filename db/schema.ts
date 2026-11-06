import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const members = sqliteTable('members', {
  email: text('email').primaryKey(), userId: text('user_id').unique(), name: text('name').notNull(),
  role: text('role').notNull(), active: integer('active').notNull().default(1), createdAt: integer('created_at').notNull(),
});
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(), role: text('role').notNull(), category: text('category').notNull(),
  message: text('message').notNull(), name: text('name'), status: text('status').notNull().default('new'),
  createdAt: integer('created_at').notNull(), fingerprint: text('fingerprint').notNull(),
}, t => [index('submission_date').on(t.createdAt), index('submission_filters').on(t.role,t.category,t.status)]);
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(), submissionId: text('submission_id').notNull().references(()=>submissions.id),
  authorId: text('author_id').notNull(), authorName: text('author_name').notNull(), body: text('body').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('comment_submission').on(t.submissionId)]);
export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(), ipHash: text('ip_hash').notNull(), createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('challenge_expiry').on(t.expiresAt)]);
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('rate_expiry').on(t.expiresAt)]);
