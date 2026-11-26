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

export function socialPostDto(post: SocialPost) {
  return {
    id: post.id,
    jobId: post.jobId,
    socialAccountId: post.socialAccountId,
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
