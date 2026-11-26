import type SocialAccount from '#models/social_account'
import type SocialPost from '#models/social_post'

/** A social account, never its tokens (08 §8). */
export function socialAccountDto(account: SocialAccount) {
  return {
    id: account.id,
    provider: account.provider,
    accountId: account.accountId,
    accountName: account.accountName,
    status: account.status,
    scopes: account.scopes,
    tokenExpiresAt: account.tokenExpiresAt?.toISO() ?? null,
    connectedBy: account.connectedBy,
    createdAt: account.createdAt.toISO(),
    updatedAt: account.updatedAt.toISO(),
  }
}

/** `accountName`: null once the account was disconnected. */
/** What a recruiter needs to choose where to publish (decision of 2026-11-26). */
export function socialAccountSummaryDto(account: SocialAccount) {
  return {
    id: account.id,
    provider: account.provider,
    accountName: account.accountName,
    status: account.status,
  }
}

export function socialPostDto(post: SocialPost, accountName: string | null) {
  return {
    id: post.id,
    jobId: post.jobId,
    socialAccountId: post.socialAccountId,
    accountName,
    provider: post.provider,
    content: post.content,
    status: post.status,
    externalPostId: post.externalPostId,
    externalUrl: post.externalUrl,
    errorMessage: post.errorMessage,
    publishedAt: post.publishedAt?.toISO() ?? null,
    createdAt: post.createdAt.toISO(),
  }
}
