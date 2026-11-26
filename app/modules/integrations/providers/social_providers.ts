import { DateTime } from 'luxon'
import env from '#start/env'

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>
export type WiredProvider = 'linkedin' | 'facebook'

const TIMEOUT_MS = 15_000

type Json = Record<string, unknown>
const obj = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

/** A page granted by the OAuth flow, with the token that publishes on it. */
export interface ConnectedAccount {
  accountId: string
  accountName: string
  accessToken: string
  refreshToken: string | null
  expiresAt: DateTime | null
  scopes: string[]
  metadata: Record<string, unknown>
}

export interface PublishInput {
  accountId: string
  accessToken: string
  content: string
  link: string
  title: string
}

export interface PublishResult {
  externalPostId: string
  externalUrl: string | null
}

export interface RefreshedToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: DateTime | null
}

/**
 * A provider refused the call. `expired`: the token is no longer valid, the
 * account must be reconnected. The message is the provider's, for diagnosis
 * (08 §8); it never contains a token.
 */
export class SocialProviderError extends Error {
  constructor(
    message: string,
    readonly expired = false
  ) {
    super(message.slice(0, 500))
  }
}

/** HTTP base shared by the providers; `fetcher` is replaced by a fake in tests. */
abstract class ProviderClient {
  abstract readonly provider: WiredProvider
  fetcher: Fetcher = (url, init) => fetch(url, init)

  protected abstract credentials(): { clientId?: string; clientSecret?: string }

  get configured() {
    const { clientId, clientSecret } = this.credentials()
    return Boolean(clientId && clientSecret)
  }

  protected requireCredentials() {
    const { clientId, clientSecret } = this.credentials()
    if (!clientId || !clientSecret) throw new SocialProviderError('not_configured')
    return { clientId, clientSecret }
  }

  protected async call(url: string, init: RequestInit = {}) {
    let response: Response
    try {
      response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      throw new SocialProviderError(`unreachable: ${(error as Error).message}`)
    }
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    return { response, body: obj(body) }
  }

  abstract authorizationUrl(state: string, redirectUri: string): string
  abstract connect(code: string, redirectUri: string): Promise<ConnectedAccount[]>
  abstract publish(input: PublishInput): Promise<PublishResult>
  /** Renews a token that expires; null when the provider's tokens do not expire. */
  abstract refresh(refreshToken: string | null): Promise<RefreshedToken | null>
}

const expiresIn = (seconds: unknown) =>
  typeof seconds === 'number' && seconds > 0 ? DateTime.now().plus({ seconds }) : null

/**
 * LinkedIn company pages (decision of 2026-11-26): Community Management API,
 * scopes `r_organization_admin` (pages the member administers) and
 * `w_organization_social` (posting as the page). One account per page.
 */
export class LinkedInClient extends ProviderClient {
  readonly provider = 'linkedin' as const
  static readonly SCOPES = ['r_organization_admin', 'w_organization_social']
  static readonly VERSION = '202411'

  protected credentials() {
    return {
      clientId: env.get('LINKEDIN_CLIENT_ID'),
      clientSecret: env.get('LINKEDIN_CLIENT_SECRET')?.release(),
    }
  }

  private headers(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'LinkedIn-Version': LinkedInClient.VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    }
  }

  authorizationUrl(state: string, redirectUri: string) {
    const { clientId } = this.requireCredentials()
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: LinkedInClient.SCOPES.join(' '),
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${query}`
  }

  private async token(form: Record<string, string>) {
    const { clientId, clientSecret } = this.requireCredentials()
    const { response, body } = await this.call('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...form, client_id: clientId, client_secret: clientSecret }),
    })
    if (!response.ok || typeof body.access_token !== 'string') {
      throw new SocialProviderError(
        `token: ${str(body.error_description) ?? str(body.error) ?? response.status}`,
        response.status === 400 || response.status === 401
      )
    }
    return {
      accessToken: body.access_token as string,
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      expiresAt: expiresIn(body.expires_in),
      scopes: typeof body.scope === 'string' ? body.scope.split(/[ ,]+/).filter(Boolean) : [],
    }
  }

  async connect(code: string, redirectUri: string) {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })
    const acl = await this.call(
      'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
      { headers: this.headers(token.accessToken) }
    )
    if (!acl.response.ok) {
      throw new SocialProviderError(`pages: ${str(acl.body.message) ?? acl.response.status}`)
    }
    const urns = arr(acl.body.elements)
      .map((element) => str(obj(element).organization))
      .filter((urn): urn is string => urn !== undefined)
    const accounts: ConnectedAccount[] = []
    for (const urn of [...new Set(urns)]) {
      const id = urn.split(':').at(-1)!
      const page = await this.call(
        `https://api.linkedin.com/rest/organizations/${encodeURIComponent(id)}`,
        { headers: this.headers(token.accessToken) }
      )
      accounts.push({
        accountId: urn,
        accountName: str(page.body.localizedName) ?? `LinkedIn ${id}`,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scopes: token.scopes,
        metadata: { vanityName: page.body.vanityName ?? null },
      })
    }
    return accounts
  }

  async publish(input: PublishInput) {
    const { response, body } = await this.call('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: { ...this.headers(input.accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: input.accountId,
        commentary: input.content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: { article: { source: input.link, title: input.title } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    })
    const id = response.headers.get('x-restli-id')
    if (!response.ok || !id) {
      throw new SocialProviderError(
        `publish: ${str(body.message) ?? response.status}`,
        response.status === 401
      )
    }
    return { externalPostId: id, externalUrl: `https://www.linkedin.com/feed/update/${id}` }
  }

  async refresh(refreshToken: string | null) {
    if (!refreshToken) throw new SocialProviderError('no_refresh_token', true)
    const token = await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken })
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? refreshToken,
      expiresAt: token.expiresAt,
    }
  }
}

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Facebook pages (decision of 2026-11-26): one account per page granted, with
 * its page token, obtained from a long-lived user token so it does not expire.
 */
export class FacebookClient extends ProviderClient {
  readonly provider = 'facebook' as const
  static readonly SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']

  protected credentials() {
    return {
      clientId: env.get('FACEBOOK_APP_ID'),
      clientSecret: env.get('FACEBOOK_APP_SECRET')?.release(),
    }
  }

  private failure(step: string, response: Response, body: Json) {
    const error = obj(body.error)
    // 190: invalid or expired token; 102: session expired.
    const expired = error.code === 190 || error.code === 102 || response.status === 401
    return new SocialProviderError(`${step}: ${str(error.message) ?? response.status}`, expired)
  }

  authorizationUrl(state: string, redirectUri: string) {
    const { clientId } = this.requireCredentials()
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: FacebookClient.SCOPES.join(','),
    })
    return `https://www.facebook.com/v21.0/dialog/oauth?${query}`
  }

  async connect(code: string, redirectUri: string) {
    const { clientId, clientSecret } = this.requireCredentials()
    const short = await this.call(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })}`
    )
    if (!short.response.ok || typeof short.body.access_token !== 'string') {
      throw this.failure('token', short.response, short.body)
    }
    const long = await this.call(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: short.body.access_token,
      })}`
    )
    if (!long.response.ok || typeof long.body.access_token !== 'string') {
      throw this.failure('token', long.response, long.body)
    }
    const pages = await this.call(
      `${GRAPH}/me/accounts?${new URLSearchParams({
        fields: 'id,name,access_token,tasks',
        limit: '100',
        access_token: long.body.access_token,
      })}`
    )
    if (!pages.response.ok) throw this.failure('pages', pages.response, pages.body)
    const accounts: ConnectedAccount[] = []
    for (const entry of arr(pages.body.data)) {
      const page = obj(entry)
      const id = str(page.id)
      const token = str(page.access_token)
      if (!id || !token) continue
      accounts.push({
        accountId: id,
        accountName: str(page.name) ?? `Facebook ${id}`,
        accessToken: token,
        refreshToken: null,
        expiresAt: null,
        scopes: FacebookClient.SCOPES,
        metadata: { tasks: arr(page.tasks).filter((task) => typeof task === 'string') },
      })
    }
    return accounts
  }

  async publish(input: PublishInput) {
    const { response, body } = await this.call(
      `${GRAPH}/${encodeURIComponent(input.accountId)}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          message: input.content,
          link: input.link,
          access_token: input.accessToken,
        }),
      }
    )
    if (!response.ok || typeof body.id !== 'string') {
      throw this.failure('publish', response, body)
    }
    return { externalPostId: body.id, externalUrl: `https://www.facebook.com/${body.id}` }
  }

  /** Page tokens from a long-lived user token do not expire. */
  async refresh() {
    return null
  }
}

export const linkedInClient = new LinkedInClient()
export const facebookClient = new FacebookClient()

/** Wired providers; `twitter` stays in the enum without a client (decision of 2026-11-26). */
export const socialProviders: Record<WiredProvider, ProviderClient> = {
  linkedin: linkedInClient,
  facebook: facebookClient,
}

export type { ProviderClient }
