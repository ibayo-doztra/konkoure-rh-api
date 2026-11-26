import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import AuditLog from '#models/audit_log'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import SocialAccount from '#models/social_account'
import SocialPost from '#models/social_post'
import Subscription from '#models/subscription'
import UserRole from '#models/user_role'
import entitlementService from '#modules/billing/services/entitlement_service'
import env from '#start/env'
import aiService from '#modules/integrations/services/ai_service'
import socialPostService from '#modules/integrations/services/social_post_service'
import { encryptToken } from '#modules/integrations/services/social_account_service'
import {
  facebookClient,
  linkedInClient,
  type Fetcher,
} from '#modules/integrations/providers/social_providers'
import { careersJobUrl } from '#modules/recruitment/careers_urls'
import { jobs, type JobName } from '#shared/queue/jobs'
import queueService from '#shared/queue/queue_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { hrSession, orgCall } from '#tests/helpers/hr'
import {
  createJob,
  createPublishedJob,
  createRecruitingOrganization,
} from '#tests/helpers/recruitment'

type Session = Awaited<ReturnType<typeof hrSession>>

interface Call {
  method: string
  url: URL
  body: string | null
}

/**
 * Fake LinkedIn and Facebook APIs (no network in tests): records the calls;
 * queue jobs are captured and run by `drain()`.
 */
function fakeSocial(options: { linkedinExpired?: boolean; refreshFails?: boolean } = {}) {
  const calls: Call[] = []
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  const fetcher: Fetcher = async (raw, init) => {
    const url = new URL(raw)
    const body = init.body ? String(init.body) : null
    calls.push({ method: init.method ?? 'GET', url, body })
    const path = url.pathname
    if (path === '/oauth/v2/accessToken') {
      const form = new URLSearchParams(body ?? '')
      if (form.get('grant_type') === 'refresh_token' && options.refreshFails) {
        return json(400, { error: 'invalid_grant', error_description: 'refresh token revoked' })
      }
      return json(200, {
        access_token: form.get('grant_type') === 'refresh_token' ? 'li-renewed' : 'li-token',
        expires_in: 60 * 24 * 3600,
        refresh_token: 'li-refresh',
        scope: 'r_organization_admin,w_organization_social',
      })
    }
    if (path === '/rest/organizationAcls') {
      return json(200, { elements: [{ organization: 'urn:li:organization:111' }] })
    }
    if (path === '/rest/organizations/111') {
      return json(200, { localizedName: 'Doztra SA', vanityName: 'doztra' })
    }
    if (path === '/rest/posts') {
      if (options.linkedinExpired) return json(401, { message: 'Expired access token' })
      return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:999' } })
    }
    if (path === '/v21.0/oauth/access_token') {
      return json(200, {
        access_token: url.searchParams.has('fb_exchange_token') ? 'fb-long' : 'fb-short',
      })
    }
    if (path === '/v21.0/me/accounts') {
      return json(200, {
        data: [
          { id: 'p1', name: 'Page Un', access_token: 'p1-token', tasks: ['CREATE_CONTENT'] },
          { id: 'p2', name: 'Page Deux', access_token: 'p2-token' },
        ],
      })
    }
    const feed = path.match(/^\/v21\.0\/([^/]+)\/feed$/)
    if (feed) return json(200, { id: `${feed[1]}_123` })
    return json(404, {})
  }

  const dispatched: Array<{ name: JobName; payload: unknown }> = []
  const originalDispatch = queueService.dispatch
  queueService.dispatch = (async (name: JobName, payload: unknown) => {
    dispatched.push({ name, payload })
  }) as typeof queueService.dispatch
  const originals = [linkedInClient.fetcher, facebookClient.fetcher] as const
  linkedInClient.fetcher = fetcher
  facebookClient.fetcher = fetcher
  return {
    calls,
    async drain() {
      while (dispatched.length > 0) {
        const job = dispatched.shift()!
        await (jobs[job.name].handle as (payload: unknown) => Promise<unknown>)(job.payload)
      }
    },
    restore() {
      linkedInClient.fetcher = originals[0]
      facebookClient.fetcher = originals[1]
      queueService.dispatch = originalDispatch
    },
  }
}

const accountsPath = '/integrations/social/accounts'

/** Runs the whole OAuth flow as `who` and returns the redirect target. */
async function connect(client: ApiClient, who: Session, org: Organization, provider: string) {
  const started = await expectStatus(
    orgCall(client, 'POST', accountsPath, who, org).json({ provider }),
    200
  )
  const authorizationUrl = new URL(started.body().data.authorizationUrl)
  const state = authorizationUrl.searchParams.get('state')!
  const response = await client
    .get(`/api/v1/oauth/social/${provider}/callback`)
    .qs({ code: 'the-code', state })
    .redirects(0)
  return { authorizationUrl, state, location: new URL(response.header('location')!) }
}

const front = (query: string) =>
  `${env.get('WEB_APP_URL').replace(/\/$/, '')}/app/settings/integrations?${query}`

test.group('Social accounts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    const fake = fakeSocial()
    return () => fake.restore()
  })

  test('LinkedIn: O H connects the company page; tokens are encrypted and never returned', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])

    const { authorizationUrl, state, location } = await connect(client, owner, org, 'linkedin')
    assert.equal(authorizationUrl.host, 'www.linkedin.com')
    assert.equal(
      authorizationUrl.searchParams.get('scope'),
      'r_organization_admin w_organization_social'
    )
    assert.equal(
      authorizationUrl.searchParams.get('redirect_uri'),
      `${env.get('APP_URL').replace(/\/$/, '')}/api/v1/oauth/social/linkedin/callback`
    )
    assert.equal(location.toString(), front('connected=linkedin&count=1'))

    const list = await expectStatus(orgCall(client, 'GET', accountsPath, owner, org), 200)
    assert.lengthOf(list.body().data, 1)
    const [account] = list.body().data
    assert.include(account, {
      provider: 'linkedin',
      accountId: 'urn:li:organization:111',
      accountName: 'Doztra SA',
      status: 'active',
      connectedBy: owner.user.id,
    })
    assert.isNotNull(account.tokenExpiresAt)
    assert.notProperty(account, 'accessTokenEncrypted')
    assert.notInclude(JSON.stringify(list.body()), 'li-token')
    const row = await SocialAccount.findOrFail(account.id)
    assert.notEqual(row.accessTokenEncrypted, 'li-token')
    assert.exists(
      await AuditLog.query()
        .where('organization_id', org.id)
        .where('action', 'social_account.connected')
        .first()
    )

    // The state is single use.
    const replay = await client
      .get('/api/v1/oauth/social/linkedin/callback')
      .qs({ code: 'the-code', state })
      .redirects(0)
    assert.equal(replay.header('location'), front('error=invalid_state'))

    await expectStatus(orgCall(client, 'GET', accountsPath, manager, org), 403)

    // A recruiter lists the accounts to publish on, in the reduced view only.
    const recruiter = await hrSession(client, org, ['recruiter'])
    const reduced = await expectStatus(orgCall(client, 'GET', accountsPath, recruiter, org), 200)
    assert.deepEqual(reduced.body().data, [
      { id: account.id, provider: 'linkedin', accountName: 'Doztra SA', status: 'active' },
    ])
    await expectStatus(
      orgCall(client, 'POST', accountsPath, recruiter, org).json({ provider: 'linkedin' }),
      403
    )
    await expectStatus(
      orgCall(client, 'DELETE', `${accountsPath}/${account.id}`, recruiter, org),
      403
    )
    await expectStatus(
      orgCall(client, 'POST', accountsPath, manager, org).json({ provider: 'linkedin' }),
      403
    )
  })

  test('Facebook: one account per page, reconnecting updates them', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])

    const first = await connect(client, hr, org, 'facebook')
    assert.equal(first.location.toString(), front('connected=facebook&count=2'))
    await connect(client, hr, org, 'facebook')
    const rows = await SocialAccount.query().where('organization_id', org.id).orderBy('account_id')
    assert.deepEqual(
      rows.map((row) => [row.accountId, row.accountName, row.tokenExpiresAt]),
      [
        ['p1', 'Page Un', null],
        ['p2', 'Page Deux', null],
      ]
    )
  })

  test('callback refusals: denied, wrong provider, forged state, lost role', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const start = async () => {
      const started = await expectStatus(
        orgCall(client, 'POST', accountsPath, hr, org).json({ provider: 'linkedin' }),
        200
      )
      return new URL(started.body().data.authorizationUrl).searchParams.get('state')!
    }
    const back = async (provider: string, query: Record<string, string>) => {
      const response = await client
        .get(`/api/v1/oauth/social/${provider}/callback`)
        .qs(query)
        .redirects(0)
      return response.header('location')
    }

    assert.equal(
      await back('linkedin', { error: 'user_cancelled_login', state: await start() }),
      front('error=denied')
    )
    assert.equal(
      await back('facebook', { code: 'x', state: await start() }),
      front('error=invalid_state')
    )
    assert.equal(
      await back('linkedin', { code: 'x', state: 'forged' }),
      front('error=invalid_state')
    )

    const state = await start()
    await UserRole.query().where('user_id', hr.user.id).where('organization_id', org.id).delete()
    assert.equal(await back('linkedin', { code: 'x', state }), front('error=forbidden'))
    assert.lengthOf(await SocialAccount.query().where('organization_id', org.id), 0)
  })

  test('without the integrations module: accounts and publication are refused', async ({
    client,
  }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createPublishedJob(org)
    // jsonb column: written serialized.
    await Subscription.query()
      .where('organization_id', org.id)
      .update({ modules_override: JSON.stringify(['hr', 'recruitment']) })
    await entitlementService.invalidate(org.id)

    await expectStatus(orgCall(client, 'GET', accountsPath, owner, org), 403)
    await expectStatus(
      orgCall(client, 'GET', `/recruitment/jobs/${job.id}/social-posts`, owner, org),
      403
    )
    await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${job.id}/social-posts`, owner, org).json({
        accountIds: [job.id],
        content: 'Nous recrutons',
      }),
      403
    )
  })

  test('503 without credentials, 422 for an unwired network', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    Object.defineProperty(linkedInClient, 'configured', { get: () => false, configurable: true })
    try {
      await expectStatus(
        orgCall(client, 'POST', accountsPath, owner, org).json({ provider: 'linkedin' }),
        503
      )
    } finally {
      Reflect.deleteProperty(linkedInClient, 'configured')
    }
    await expectStatus(
      orgCall(client, 'POST', accountsPath, owner, org).json({ provider: 'twitter' }),
      422
    )
  })

  test('DELETE removes the account, its posts stay; another tenant gets 404', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const stranger = await hrSession(client, other, ['owner'])
    await connect(client, owner, org, 'linkedin')
    const account = await SocialAccount.query().where('organization_id', org.id).firstOrFail()
    const job = await createPublishedJob(org)
    const post = await SocialPost.create({
      organizationId: org.id,
      jobId: job.id,
      socialAccountId: account.id,
      provider: 'linkedin',
      content: 'Nous recrutons',
      mediaUrls: [],
      status: 'published',
    })

    await expectStatus(
      orgCall(client, 'DELETE', `${accountsPath}/${account.id}`, stranger, other),
      404
    )
    await expectStatus(orgCall(client, 'DELETE', `${accountsPath}/${account.id}`, owner, org), 204)
    assert.isNull(await SocialAccount.find(account.id))
    await post.refresh()
    assert.isNull(post.socialAccountId)
    assert.equal(post.provider, 'linkedin')
  })
})

test.group('POST /org/recruitment/jobs/:id/social-posts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('publishes the offer with its careers link on each account', async ({ client, assert }) => {
    const fake = fakeSocial()
    try {
      const org = await createRecruitingOrganization()
      const owner = await hrSession(client, org, ['owner'])
      const recruiter = await hrSession(client, org, ['recruiter'])
      await connect(client, owner, org, 'linkedin')
      await connect(client, owner, org, 'facebook')
      const linkedin = await SocialAccount.query()
        .where('organization_id', org.id)
        .where('provider', 'linkedin')
        .firstOrFail()
      const page = await SocialAccount.query()
        .where('organization_id', org.id)
        .where('account_id', 'p1')
        .firstOrFail()
      const job = await createPublishedJob(org)
      fake.calls.length = 0

      const response = await expectStatus(
        orgCall(client, 'POST', `/recruitment/jobs/${job.id}/social-posts`, recruiter, org).json({
          accountIds: [linkedin.id, page.id],
          content: 'Nous recrutons un comptable !',
        }),
        202
      )
      const posts = response.body().data
      assert.lengthOf(posts, 2)
      assert.deepEqual(
        posts.map((post: { status: string }) => post.status),
        ['pending', 'pending']
      )

      await fake.drain()
      const link = careersJobUrl(org.slug, job.slug)
      const rows = await SocialPost.query().where('job_id', job.id).orderBy('provider')
      assert.deepEqual(
        rows.map((row) => [row.provider, row.status, row.externalPostId, row.externalUrl]),
        [
          ['facebook', 'published', 'p1_123', 'https://www.facebook.com/p1_123'],
          [
            'linkedin',
            'published',
            'urn:li:share:999',
            'https://www.linkedin.com/feed/update/urn:li:share:999',
          ],
        ]
      )
      const linkedinCall = fake.calls.find((call) => call.url.pathname === '/rest/posts')!
      const sent = JSON.parse(linkedinCall.body!)
      assert.equal(sent.author, 'urn:li:organization:111')
      assert.equal(sent.content.article.source, link)
      const facebookCall = new URLSearchParams(
        fake.calls.find((call) => call.url.pathname === '/v21.0/p1/feed')!.body!
      )
      assert.equal(facebookCall.get('link'), link)
      assert.equal(facebookCall.get('access_token'), 'p1-token')
      assert.equal(facebookCall.get('message'), 'Nous recrutons un comptable !')
    } finally {
      fake.restore()
    }
  })

  test('GET lists the publications of the offer with their final state', async ({
    client,
    assert,
  }) => {
    const fake = fakeSocial({ linkedinExpired: true })
    try {
      const org = await createRecruitingOrganization()
      const other = await createRecruitingOrganization('Autre')
      const owner = await hrSession(client, org, ['owner'])
      const recruiter = await hrSession(client, org, ['recruiter'])
      const employee = await hrSession(client, org, ['employee'])
      const stranger = await hrSession(client, other, ['owner'])
      await connect(client, owner, org, 'linkedin')
      await connect(client, owner, org, 'facebook')
      const accounts = await SocialAccount.query().where('organization_id', org.id)
      const ids = accounts.map((account) => account.id)
      const job = await createPublishedJob(org)
      const empty = await createPublishedJob(org)
      const path = `/recruitment/jobs/${job.id}/social-posts`

      await expectStatus(
        orgCall(client, 'POST', path, recruiter, org).json({ accountIds: ids, content: 'Go' }),
        202
      )
      const pending = await expectStatus(orgCall(client, 'GET', path, recruiter, org), 200)
      assert.deepEqual(
        pending.body().data.map((post: { status: string }) => post.status),
        ['pending', 'pending', 'pending']
      )

      await fake.drain()
      const done = await expectStatus(orgCall(client, 'GET', path, recruiter, org), 200)
      const byProvider = (provider: string) =>
        done.body().data.filter((post: { provider: string }) => post.provider === provider)
      assert.lengthOf(byProvider('facebook'), 2)
      for (const post of byProvider('facebook')) {
        assert.equal(post.status, 'published')
        assert.match(post.externalUrl, /^https:\/\/www\.facebook\.com\//)
        assert.isNotNull(post.publishedAt)
      }
      assert.sameMembers(
        byProvider('facebook').map((post: { accountName: string }) => post.accountName),
        ['Page Un', 'Page Deux']
      )
      const [linkedin] = byProvider('linkedin')
      assert.equal(linkedin.accountName, 'Doztra SA')
      assert.equal(linkedin.status, 'failed')
      assert.include(linkedin.errorMessage, 'Expired access token')

      const none = await expectStatus(
        orgCall(client, 'GET', `/recruitment/jobs/${empty.id}/social-posts`, owner, org),
        200
      )
      assert.deepEqual(none.body().data, [])
      await expectStatus(orgCall(client, 'GET', path, employee, org), 403)
      await expectStatus(orgCall(client, 'GET', path, stranger, other), 404)
    } finally {
      fake.restore()
    }
  })

  test('refuses a draft offer, a foreign account and the employee role', async ({
    client,
    assert,
  }) => {
    const fake = fakeSocial()
    try {
      const org = await createRecruitingOrganization()
      const other = await createRecruitingOrganization('Autre')
      const owner = await hrSession(client, org, ['owner'])
      const employee = await hrSession(client, org, ['employee'])
      const foreignOwner = await hrSession(client, other, ['owner'])
      await connect(client, owner, org, 'linkedin')
      await connect(client, foreignOwner, other, 'linkedin')
      const mine = await SocialAccount.query().where('organization_id', org.id).firstOrFail()
      const foreign = await SocialAccount.query().where('organization_id', other.id).firstOrFail()
      const draft = await createJob(org)
      const published = await createPublishedJob(org)
      const post = (who: Session, jobId: string, accountIds: string[]) =>
        orgCall(client, 'POST', `/recruitment/jobs/${jobId}/social-posts`, who, org).json({
          accountIds,
          content: 'Nous recrutons',
        })

      const conflict = await expectStatus(post(owner, draft.id, [mine.id]), 409)
      assert.equal(errorOf(conflict).details[0].rule, 'notPublished')
      const invalid = await expectStatus(post(owner, published.id, [foreign.id]), 422)
      assert.equal(errorOf(invalid).details[0].field, 'accountIds')
      await expectStatus(post(employee, published.id, [mine.id]), 403)
      await expectStatus(
        orgCall(client, 'POST', `/recruitment/jobs/${published.id}/social-posts`, owner, org).json({
          accountIds: [],
          content: '',
        }),
        422
      )
      assert.lengthOf(await SocialPost.query().where('organization_id', org.id), 0)
    } finally {
      fake.restore()
    }
  })

  test('an expired token fails the post, expires the account and notifies O H', async ({
    client,
    assert,
  }) => {
    const fake = fakeSocial({ linkedinExpired: true })
    try {
      const org = await createRecruitingOrganization()
      const owner = await hrSession(client, org, ['owner'])
      const hr = await hrSession(client, org, ['hr_admin'])
      await connect(client, owner, org, 'linkedin')
      const account = await SocialAccount.query().where('organization_id', org.id).firstOrFail()
      const job = await createPublishedJob(org)

      await expectStatus(
        orgCall(client, 'POST', `/recruitment/jobs/${job.id}/social-posts`, hr, org).json({
          accountIds: [account.id],
          content: 'Nous recrutons',
        }),
        202
      )
      await fake.drain()
      const post = await SocialPost.query().where('job_id', job.id).firstOrFail()
      assert.equal(post.status, 'failed')
      assert.include(post.errorMessage!, 'Expired access token')
      await account.refresh()
      assert.equal(account.status, 'expired')
      const notified = await Notification.query()
        .where('organization_id', org.id)
        .where('type', 'social_account.expired')
        .orderBy('user_id')
      assert.sameMembers(
        notified.map((row) => row.userId),
        [owner.user.id, hr.user.id]
      )
      // An expired account can no longer be chosen.
      await expectStatus(
        orgCall(client, 'POST', `/recruitment/jobs/${job.id}/social-posts`, hr, org).json({
          accountIds: [account.id],
          content: 'Encore',
        }),
        422
      )
    } finally {
      fake.restore()
    }
  })

  test('suggest: AI text for one credit, nothing stored', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const job = await createPublishedJob(org)
    const fake = fakeSocial()
    const original = aiService.completer
    const requests: string[] = []
    aiService.completer = async (request) => {
      requests.push(JSON.stringify(request))
      return JSON.stringify({ content: 'Rejoignez-nous comme comptable ! #emploi #Conakry' })
    }
    try {
      const response = await expectStatus(
        orgCall(
          client,
          'POST',
          `/recruitment/jobs/${job.id}/social-posts/suggest`,
          recruiter,
          org
        ).json({
          provider: 'linkedin',
        }),
        200
      )
      assert.equal(
        response.body().data.content,
        'Rejoignez-nous comme comptable ! #emploi #Conakry'
      )
      assert.lengthOf(requests, 1)
      assert.include(requests[0], 'social media posts announcing job offers')
      assert.lengthOf(await SocialPost.query().where('organization_id', org.id), 0)
      await fake.drain()
    } finally {
      aiService.completer = original
      fake.restore()
    }
  })
})

test.group('social.refresh-tokens', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function linkedinAccount(org: Organization, expiresInDays: number) {
    return SocialAccount.create({
      organizationId: org.id,
      provider: 'linkedin',
      accountId: 'urn:li:organization:111',
      accountName: 'Doztra SA',
      accessTokenEncrypted: encryptToken('li-old'),
      refreshTokenEncrypted: encryptToken('li-refresh'),
      tokenExpiresAt: DateTime.now().plus({ days: expiresInDays }),
      scopes: [],
      metadata: {},
    })
  }

  test('renews tokens expiring within 7 days, leaves the others', async ({ client, assert }) => {
    const fake = fakeSocial()
    try {
      const org = await createRecruitingOrganization()
      await hrSession(client, org, ['owner'])
      const soon = await linkedinAccount(org, 3)
      const later = await linkedinAccount(await createRecruitingOrganization('Plus tard'), 30)

      assert.equal(await socialPostService.refreshTokens(), 1)
      await soon.refresh()
      await later.refresh()
      assert.isAbove(soon.tokenExpiresAt!.diffNow('days').days, 50)
      assert.isBelow(later.tokenExpiresAt!.diffNow('days').days, 31)
    } finally {
      fake.restore()
    }
  })

  test('a refused renewal expires the account and notifies the owners', async ({
    client,
    assert,
  }) => {
    const fake = fakeSocial({ refreshFails: true })
    try {
      const org = await createRecruitingOrganization()
      const owner = await hrSession(client, org, ['owner'])
      const account = await linkedinAccount(org, 2)

      assert.equal(await socialPostService.refreshTokens(), 0)
      await account.refresh()
      assert.equal(account.status, 'expired')
      const notification = await Notification.query()
        .where('user_id', owner.user.id)
        .where('type', 'social_account.expired')
        .firstOrFail()
      assert.equal(notification.organizationId, org.id)
    } finally {
      fake.restore()
    }
  })
})
