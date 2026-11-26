/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health.show': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['show']>>>
    }
  }
  'health.ready': {
    methods: ["GET","HEAD"]
    pattern: '/health/ready'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['ready']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['ready']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/health/controllers/health_controller').default['ready']>>>
    }
  }
  'openapi.html': {
    methods: ["GET","HEAD"]
    pattern: '/docs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'openapi.json': {
    methods: ["GET","HEAD"]
    pattern: '/docs.json'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'openapi.yaml': {
    methods: ["GET","HEAD"]
    pattern: '/docs.yaml'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'auth.register': {
    methods: ["POST"]
    pattern: '/api/v1/auth/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').registerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').registerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['register']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.refresh': {
    methods: ["POST"]
    pattern: '/api/v1/auth/refresh'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').refreshValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').refreshValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['refresh']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['refresh']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.forgotPassword': {
    methods: ["POST"]
    pattern: '/api/v1/auth/forgot-password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['forgotPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['forgotPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['forgotPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.resetPassword': {
    methods: ["POST"]
    pattern: '/api/v1/auth/reset-password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').resetPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resetPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resetPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resetPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.verifyEmail': {
    methods: ["POST"]
    pattern: '/api/v1/auth/verify-email'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/auth_validator').verifyEmailValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/auth_validator').verifyEmailValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['verifyEmail']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['verifyEmail']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['verifyEmail']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.invitations.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/invitations/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').invitationTokenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['invitation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['invitation']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['invitation']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.invitations.accept': {
    methods: ["POST"]
    pattern: '/api/v1/auth/invitations/:token/accept'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').acceptInvitationValidator)>>
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').acceptInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['acceptInvitation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['acceptInvitation']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['acceptInvitation']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logout']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logout']>>>
    }
  }
  'auth.logoutAll': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout-all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logoutAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logoutAll']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['logoutAll']>>>
    }
  }
  'auth.resendVerification': {
    methods: ["POST"]
    pattern: '/api/v1/auth/resend-verification'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resendVerification']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resendVerification']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/auth/controllers/auth_controller').default['resendVerification']>>>
    }
  }
  'me.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['show']>>>
    }
  }
  'me.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/me'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/users/validators/me_validator').deleteMeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/users/validators/me_validator').deleteMeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/me'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/users/validators/me_validator').updateMeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/users/validators/me_validator').updateMeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.changePassword': {
    methods: ["POST"]
    pattern: '/api/v1/me/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/users/validators/me_validator').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/users/validators/me_validator').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['changePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['changePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['changePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.sessions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/sessions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['sessions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['sessions']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['sessions']>>>
    }
  }
  'me.revokeSession': {
    methods: ["DELETE"]
    pattern: '/api/v1/me/sessions/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/users/validators/me_validator').sessionIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/users/validators/me_validator').sessionIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['revokeSession']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['revokeSession']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['revokeSession']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.export': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/export'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['export']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['export']>>>
    }
  }
  'me.organizations': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/organizations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['organizations']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['organizations']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/users/controllers/me_controller').default['organizations']>>>
    }
  }
  'me.notifications.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/notifications'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/notifications/validators/notification_validator').listNotificationsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.notifications.readAll': {
    methods: ["POST"]
    pattern: '/api/v1/me/notifications/read-all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['readAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['readAll']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['readAll']>>>
    }
  }
  'me.notifications.read': {
    methods: ["POST"]
    pattern: '/api/v1/me/notifications/:id/read'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/notifications/validators/notification_validator').notificationIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/notifications/validators/notification_validator').notificationIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['read']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['read']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/notifications/controllers/notifications_controller').default['read']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organizations.store': {
    methods: ["POST"]
    pattern: '/api/v1/organizations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/organization_validator').createOrganizationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/organization_validator').createOrganizationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/organizations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/organizations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/organizations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['show']>>>
    }
  }
  'org.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/organization_validator').updateOrganizationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/organization_validator').updateOrganizationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/organization_validator').deleteOrganizationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/organization_validator').deleteOrganizationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.settings.update': {
    methods: ["PUT"]
    pattern: '/api/v1/org/settings'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/organization_validator').updateOrganizationSettingsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/organization_validator').updateOrganizationSettingsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['updateSettings']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['updateSettings']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['updateSettings']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.logo.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/logo'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/organization_validator').organizationLogoValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/organization_validator').organizationLogoValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['uploadLogo']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['uploadLogo']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/current_organization_controller').default['uploadLogo']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.entitlements.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/entitlements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/entitlements_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/entitlements_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/entitlements_controller').default['show']>>>
    }
  }
  'org.billing.subscription': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/subscription'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['subscription']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['subscription']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['subscription']>>>
    }
  }
  'org.billing.plans': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/plans'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['plans']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['plans']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['plans']>>>
    }
  }
  'org.billing.usage': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/usage'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['usage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['usage']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['usage']>>>
    }
  }
  'org.billing.payments.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/billing/validators/billing_validator').listPaymentsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payments']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payments']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payments']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.billing.payments.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/payments/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/billing/validators/billing_validator').paymentIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payment']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['payment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.billing.invoices.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/billing/validators/billing_validator').listInvoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoices']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoices']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.billing.invoices.pdf': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/billing/invoices/:id/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/billing/validators/billing_validator').invoiceIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoicePdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoicePdf']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['invoicePdf']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.billing.checkout': {
    methods: ["POST"]
    pattern: '/api/v1/org/billing/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/billing/validators/billing_validator').checkoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/billing/validators/billing_validator').checkoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['checkout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['checkout']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['checkout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.billing.cancel': {
    methods: ["POST"]
    pattern: '/api/v1/org/billing/cancel'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['cancel']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['cancel']>>>
    }
  }
  'org.billing.resume': {
    methods: ["POST"]
    pattern: '/api/v1/org/billing/resume'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['resume']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['resume']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/billing_controller').default['resume']>>>
    }
  }
  'org.dashboard.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/dashboard/validators/dashboard_validator').dashboardValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/dashboard/controllers/dashboard_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/dashboard/controllers/dashboard_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/dashboard/controllers/dashboard_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.members.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/members'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/organizations/validators/member_validator').listMembersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.members.roles.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/members/:userId/roles'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/member_validator').updateMemberRolesValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/member_validator').updateMemberRolesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['updateRoles']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['updateRoles']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['updateRoles']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.members.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/members/:userId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/organizations/validators/member_validator').memberIdValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/organizations/validators/member_validator').memberIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/organizations/controllers/members_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.invitations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/invitations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').listInvitationsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.invitations.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/invitations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').createInvitationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').createInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.invitations.resend': {
    methods: ["POST"]
    pattern: '/api/v1/org/invitations/:id/resend'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').invitationIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').invitationIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['resend']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['resend']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.invitations.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/invitations/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').invitationIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/invitations/validators/invitation_validator').invitationIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/invitations/controllers/invitations_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/departments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').paginationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/departments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/department_validator').createDepartmentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/department_validator').createDepartmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/departments/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/department_validator').departmentIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/departments/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/department_validator').updateDepartmentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/department_validator').updateDepartmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/departments/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/department_validator').deleteDepartmentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/department_validator').deleteDepartmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.departments.employees': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/departments/:id/employees'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').nestedEmployeesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['employees']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['employees']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/departments_controller').default['employees']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').listEmployeesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').createEmployeeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').createEmployeeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.managers': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/managers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').paginationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['managers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['managers']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['managers']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.directory': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/directory'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').directoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['directory']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['directory']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['directory']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.import.preview': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/import/preview'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').importPreviewValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').importPreviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['preview']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['preview']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['preview']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.import.commit': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/import/commit'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').importCommitValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').importCommitValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['commit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['commit']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['commit']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.export': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/export'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').exportEmployeesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').exportEmployeesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employee_transfers_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/employees/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').updateEmployeeValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').updateEmployeeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/employees/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.restore': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/:id/restore'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['restore']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['restore']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.salary': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/salary'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['salary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['salary']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['salary']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.team': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/team'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').nestedEmployeesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['team']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['team']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['team']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.documents.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/documents'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documents']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documents']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documents']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.documents.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/:id/documents'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').addDocumentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').addDocumentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['storeDocument']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['storeDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['storeDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.documents.url': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/documents/:docId/url'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; docId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').documentIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documentUrl']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documentUrl']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['documentUrl']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.documents.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/employees/:id/documents/:docId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').documentIdValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; docId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').documentIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroyDocument']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroyDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['destroyDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.photo': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/:id/photo'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/employee_validator').photoValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/employee_validator').photoValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['photo']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['photo']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/employees_controller').default['photo']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.skills.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/skills'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').employeeIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['ofEmployee']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['ofEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['ofEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.skills.replace': {
    methods: ["PUT"]
    pattern: '/api/v1/org/employees/:id/skills'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/skill_validator').replaceEmployeeSkillsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/skill_validator').replaceEmployeeSkillsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['replaceOfEmployee']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['replaceOfEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['replaceOfEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.leaveBalance': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/leave-balance'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').employeeBalanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['ofEmployee']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['ofEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['ofEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/contracts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/contract_validator').listContractsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/contracts'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/contract_validator').createContractValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/contract_validator').createContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/contracts/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/contracts/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/contract_validator').updateContractValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/contract_validator').updateContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/contracts/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.terminate': {
    methods: ["POST"]
    pattern: '/api/v1/org/contracts/:id/terminate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/contract_validator').terminateContractValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/contract_validator').terminateContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['terminate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['terminate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['terminate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.document': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/contracts/:id/document'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['document']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['document']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['document']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.contracts.document.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/contracts/:id/document'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractDocumentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/contract_validator').contractDocumentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['uploadDocument']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['uploadDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/contracts_controller').default['uploadDocument']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.skills.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/skills'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/hr/validators/employee_validator').paginationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.skills.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/skills'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/skill_validator').createSkillValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/skill_validator').createSkillValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.skills.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/skills/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/skill_validator').updateSkillValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/skill_validator').updateSkillValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.skills.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/skills/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/hr/validators/skill_validator').skillIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/hr/validators/skill_validator').skillIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/hr/controllers/skills_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/leaves'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').listLeavesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').createLeaveValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').createLeaveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.calendar': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/leaves/calendar'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').calendarValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['calendar']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['calendar']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['calendar']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.balances.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/leaves/balances'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').listBalancesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.balances.adjust': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves/balances/adjust'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').adjustBalanceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').adjustBalanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['adjust']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['adjust']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leave_balances_controller').default['adjust']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/leaves/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/leaves/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').updateLeaveValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').updateLeaveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.approve': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves/:id/approve'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['approve']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['approve']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['approve']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.reject': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves/:id/reject'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').rejectLeaveValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').rejectLeaveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['reject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['reject']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['reject']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.cancel': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves/:id/cancel'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['cancel']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['cancel']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.attachment.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/leaves/:id/attachment'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').attachmentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').attachmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attach']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attach']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attach']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.leaves.attachment.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/leaves/:id/attachment'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').leaveIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attachment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attachment']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/leaves_controller').default['attachment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.holidays.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/holidays'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/leaves/validators/leave_validator').listHolidaysValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.holidays.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/holidays'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').createHolidayValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').createHolidayValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.holidays.import': {
    methods: ["POST"]
    pattern: '/api/v1/org/holidays/import'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').importHolidaysValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').importHolidaysValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['import']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['import']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['import']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.holidays.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/holidays/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').updateHolidayValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').updateHolidayValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.holidays.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/holidays/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/leaves/validators/leave_validator').holidayIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/leaves/validators/leave_validator').holidayIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/leaves/controllers/holidays_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.cycles.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/cycles'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listCyclesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['cycles']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['cycles']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['cycles']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.cycles.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/cycles'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createCycleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createCycleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storeCycle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storeCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storeCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.cycles.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/cycles/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateCycleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateCycleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updateCycle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updateCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updateCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.cycles.open': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/cycles/:id/open'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['openCycle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['openCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['openCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.cycles.close': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/cycles/:id/close'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['closeCycle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['closeCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['closeCycle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.plans.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/plans'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listPlansValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['plans']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['plans']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['plans']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.plans.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/plans'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createPlanValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createPlanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storePlan']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storePlan']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['storePlan']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.plans.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/plans/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updatePlanValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updatePlanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updatePlan']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updatePlan']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['updatePlan']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.plans.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/plans/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['destroyPlan']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['destroyPlan']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/performance_setup_controller').default['destroyPlan']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/goals'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listGoalsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/goals'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createGoalValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createGoalValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/goals/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/goals/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateGoalValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateGoalValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/goals/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.progress': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/goals/:id/progress'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').goalProgressValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').goalProgressValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['progress']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['progress']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['progress']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.activities.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/goals/:id/activities'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['activities']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['activities']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['activities']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.activities.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/goals/:id/activities'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createActivityValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createActivityValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['storeActivity']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['storeActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['storeActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.activities.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/goals/:id/activities/:activityId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateActivityValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; activityId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateActivityValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['updateActivity']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['updateActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['updateActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.goals.activities.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/goals/:id/activities/:activityId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').activityIdValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; activityId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').activityIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroyActivity']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroyActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['destroyActivity']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.activities.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/activities'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listActivitiesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['allActivities']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['allActivities']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/goals_controller').default['allActivities']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/okrs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listOkrsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createOkrValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createOkrValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.suggest': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs/suggest'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').suggestOkrValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').suggestOkrValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['suggest']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['suggest']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['suggest']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/okrs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/okrs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateOkrValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateOkrValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/okrs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.keyResults': {
    methods: ["PUT"]
    pattern: '/api/v1/org/performance/okrs/:id/key-results'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').replaceKeyResultsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').replaceKeyResultsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['replaceKeyResults']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['replaceKeyResults']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['replaceKeyResults']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.keyResults.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/okrs/:id/key-results/:krId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateKeyResultValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; krId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').updateKeyResultValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['updateKeyResult']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['updateKeyResult']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['updateKeyResult']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.submit': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs/:id/submit'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['submit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['submit']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['submit']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.validate': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs/:id/validate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').validateOkrValidator)>|InferInput<(typeof import('#modules/performance/services/okr_service').default)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').validateOkrValidator)>|InferInput<(typeof import('#modules/performance/services/okr_service').default)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['validate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['validate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['validate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.requestRevision': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs/:id/request-revision'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').requestRevisionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').requestRevisionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['requestRevision']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['requestRevision']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['requestRevision']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.checkins.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/okrs/:id/checkins'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['checkins']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['checkins']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['checkins']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.okrs.checkins.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/okrs/:id/checkins'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createCheckinValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createCheckinValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['storeCheckin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['storeCheckin']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/okrs_controller').default['storeCheckin']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/reviews'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listReviewsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').openReviewsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').openReviewsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/reviews/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.self': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/reviews/:id/self'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').selfReviewValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').selfReviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveSelf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveSelf']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveSelf']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.submitSelf': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews/:id/submit-self'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['submitSelf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['submitSelf']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['submitSelf']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.manager': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/reviews/:id/manager'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').managerReviewValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').managerReviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveManager']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveManager']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['saveManager']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.validate': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews/:id/validate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>|InferInput<(typeof import('#modules/performance/services/review_service').default)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>|InferInput<(typeof import('#modules/performance/services/review_service').default)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['validate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['validate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['validate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.sendBack': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews/:id/send-back'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').sendBackReviewValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').sendBackReviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sendBack']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sendBack']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sendBack']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.sign': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews/:id/sign'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sign']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sign']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['sign']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.aiSummary': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/reviews/:id/ai-summary'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['aiSummary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['aiSummary']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['aiSummary']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.reviews.talent': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/performance/reviews/:id/talent'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').talentReviewValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').talentReviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['talent']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['talent']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/reviews_controller').default['talent']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.feedback.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/feedback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listFeedbackValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.feedback.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/feedback'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createFeedbackValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createFeedbackValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.feedback.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/feedback/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.achievements.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/performance/achievements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/performance/validators/performance_validator').listAchievementsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['achievements']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['achievements']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['achievements']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.achievements.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/performance/achievements'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').createAchievementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').createAchievementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['storeAchievement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['storeAchievement']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['storeAchievement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.performance.achievements.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/performance/achievements/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/performance/validators/performance_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroyAchievement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroyAchievement']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/performance/controllers/feedback_controller').default['destroyAchievement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.nineBox': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/talents/9box'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/talents/validators/talent_validator').nineBoxValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/nine_box_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/nine_box_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/nine_box_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.skillsMatrix.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/talents/skills-matrix'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/talents/validators/talent_validator').skillsMatrixValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.skillsMatrix.update': {
    methods: ["PUT"]
    pattern: '/api/v1/org/talents/skills-matrix'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/talents/validators/talent_validator').updateSkillsMatrixValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/talents/validators/talent_validator').updateSkillsMatrixValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/skills_matrix_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.succession.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/talents/succession'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/talents/validators/talent_validator').listSuccessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.succession.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/talents/succession'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/talents/validators/talent_validator').createSuccessionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/talents/validators/talent_validator').createSuccessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.succession.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/talents/succession/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/talents/validators/talent_validator').updateSuccessionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/talents/validators/talent_validator').updateSuccessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.talents.succession.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/talents/succession/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/talents/validators/talent_validator').successionIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/talents/validators/talent_validator').successionIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/talents/controllers/succession_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/job_validator').listJobsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').createJobValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').createJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/jobs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/recruitment/jobs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').updateJobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').updateJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/recruitment/jobs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.publish': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/publish'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['publish']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['publish']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['publish']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.close': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/close'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['close']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['close']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['close']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.duplicate': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/duplicate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['duplicate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['duplicate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['duplicate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.qr': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/jobs/:id/qr'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/job_validator').jobIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['qr']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['qr']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['qr']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.generate': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/generate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/job_validator').generateJobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/job_validator').generateJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/jobs_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.social_posts.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/jobs/:id/social-posts'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/integrations/validators/social_validator').jobSocialPostsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.social_posts.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/social-posts'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/integrations/validators/social_validator').createSocialPostsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/integrations/validators/social_validator').createSocialPostsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.jobs.social_posts.suggest': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/jobs/:id/social-posts/suggest'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/integrations/validators/social_validator').suggestSocialPostValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/integrations/validators/social_validator').suggestSocialPostValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['suggest']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['suggest']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_posts_controller').default['suggest']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/candidates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').listCandidatesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/candidates'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').createCandidateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').createCandidateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/candidates/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').candidateIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/recruitment/candidates/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').updateCandidateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').updateCandidateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/recruitment/candidates/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').candidateIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').candidateIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.stage': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/candidates/:id/stage'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').stageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').stageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['stage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['stage']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['stage']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.hire': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/candidates/:id/hire'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').hireValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').hireValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['hire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['hire']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['hire']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.documents.url': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/candidates/:id/documents/:key/url'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; key: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').documentUrlValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['documentUrl']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['documentUrl']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['documentUrl']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.notes.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/candidates/:id/notes'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').candidateIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['notes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['notes']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['notes']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.notes.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/candidates/:id/notes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').noteValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').noteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['storeNote']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['storeNote']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['storeNote']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.notes.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/recruitment/candidates/:id/notes/:noteId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').noteIdValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; noteId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').noteIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroyNote']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroyNote']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['destroyNote']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.candidates.events': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/candidates/:id/events'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').candidateIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['events']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['events']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/candidates_controller').default['events']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.webhooks.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/recruitment/webhooks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['show']>>>
    }
  }
  'org.recruitment.webhooks.update': {
    methods: ["PUT"]
    pattern: '/api/v1/org/recruitment/webhooks'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').updateWebhookConfigValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').updateWebhookConfigValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.recruitment.webhooks.ping': {
    methods: ["POST"]
    pattern: '/api/v1/org/recruitment/webhooks/ping'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').pingWebhookValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').pingWebhookValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['ping']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['ping']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/recruitment_webhooks_controller').default['ping']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.integrations.social_accounts.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/integrations/social/accounts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['index']>>>
    }
  }
  'org.integrations.social_accounts.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/integrations/social/accounts'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/integrations/validators/social_validator').connectSocialAccountValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/integrations/validators/social_validator').connectSocialAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.integrations.social_accounts.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/integrations/social/accounts/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/integrations/validators/social_validator').socialAccountIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/integrations/validators/social_validator').socialAccountIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.zones.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/zones'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['zones']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['zones']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['zones']>>>
    }
  }
  'org.timeclock.zones.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/zones'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createZoneValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createZoneValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeZone']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeZone']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeZone']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.zones.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/timeclock/zones/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').updateZoneValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').updateZoneValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateZone']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateZone']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateZone']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.zones.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/timeclock/zones/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroyZone']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroyZone']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroyZone']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.schedules.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/schedules'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['schedules']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['schedules']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['schedules']>>>
    }
  }
  'org.timeclock.schedules.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/schedules'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createScheduleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createScheduleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeSchedule']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeSchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeSchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.schedules.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/timeclock/schedules/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').updateScheduleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').updateScheduleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateSchedule']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateSchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['updateSchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.schedules.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/timeclock/schedules/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroySchedule']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroySchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['destroySchedule']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.punch': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/punch'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').punchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').punchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['punch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['punch']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['punch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.logs.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/logs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').listLogsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['logs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['logs']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['logs']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.logs.export': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/logs/export'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').exportLogsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').exportLogsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.attendance.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/attendance'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').listAttendanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.today': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/today'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['today']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['today']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/attendance_controller').default['today']>>>
    }
  }
  'org.timeclock.logs.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/org/timeclock/logs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').correctLogValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').correctLogValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['correct']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['correct']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['correct']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.logs.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/timeclock/logs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.badgeEvents': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/badge-events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').badgeEventsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badgeEvents']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badgeEvents']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badgeEvents']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.devices.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/device-tokens'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['devices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['devices']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['devices']>>>
    }
  }
  'org.timeclock.devices.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/device-tokens'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createDeviceTokenValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').createDeviceTokenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeDevice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['storeDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.devices.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/timeclock/device-tokens/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['device']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['device']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['device']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.devices.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/timeclock/device-tokens/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeDevice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.badge.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/org/employees/:id/badge'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badge']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['badge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.badge.store': {
    methods: ["POST"]
    pattern: '/api/v1/org/employees/:id/badge'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').assignBadgeValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').assignBadgeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['assignBadge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['assignBadge']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['assignBadge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.employees.badge.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/org/employees/:id/badge'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeBadge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeBadge']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_setup_controller').default['revokeBadge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.scan': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/scan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').scanValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').scanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['scan']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['scan']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['scan']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'org.timeclock.sync': {
    methods: ["POST"]
    pattern: '/api/v1/org/timeclock/sync'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').syncValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/timeclock/validators/timeclock_validator').syncValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['sync']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['sync']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/timeclock/controllers/timeclock_controller').default['sync']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.careers.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/careers/:orgSlug'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orgSlug: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/job_validator').careersPageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['page']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['page']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['page']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.careers.jobs.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/careers/:orgSlug/jobs/:jobSlug'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { orgSlug: ParamValue; jobSlug: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/recruitment/validators/job_validator').careersJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['job']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['job']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['job']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.careers.jobs.apply.check': {
    methods: ["POST"]
    pattern: '/api/v1/public/careers/:orgSlug/jobs/:jobSlug/apply/check'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').applyCheckValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { orgSlug: ParamValue; jobSlug: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').applyCheckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['check']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['check']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['check']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.careers.jobs.apply': {
    methods: ["POST"]
    pattern: '/api/v1/public/careers/:orgSlug/jobs/:jobSlug/apply'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').applyValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { orgSlug: ParamValue; jobSlug: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/candidate_validator').applyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['apply']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['apply']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/careers_controller').default['apply']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.plans': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/plans'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['plans']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['plans']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['plans']>>>
    }
  }
  'public.demoRequests.store': {
    methods: ["POST"]
    pattern: '/api/v1/public/demo-requests'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').createDemoRequestValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').createDemoRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/demo_requests_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/demo_requests_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/demo_requests_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.payments.checkout': {
    methods: ["POST"]
    pattern: '/api/v1/public/payments/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/billing/validators/billing_validator').presignupCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/billing/validators/billing_validator').presignupCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['checkout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['checkout']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['checkout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.payments.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/public/payments/:ref'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { ref: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/billing/validators/billing_validator').presignupReferenceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'public.payments.claim': {
    methods: ["POST"]
    pattern: '/api/v1/public/payments/:ref/claim'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/billing/validators/billing_validator').claimValidator)>>
      paramsTuple: [ParamValue]
      params: { ref: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/billing/validators/billing_validator').claimValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['claim']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['claim']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/public_payments_controller').default['claim']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'webhooks.n8n.scoring': {
    methods: ["POST"]
    pattern: '/api/v1/webhooks/n8n/scoring'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').n8nScoringQueryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/recruitment/validators/webhook_validator').n8nScoringQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/n8n_webhook_controller').default['scoring']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/n8n_webhook_controller').default['scoring']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/recruitment/controllers/n8n_webhook_controller').default['scoring']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'webhooks.djomy': {
    methods: ["POST"]
    pattern: '/api/v1/webhooks/djomy/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/billing/controllers/djomy_webhook_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/billing/controllers/djomy_webhook_controller').default['handle']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/billing/controllers/djomy_webhook_controller').default['handle']>>>
    }
  }
  'oauth.social.callback': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/oauth/social/:provider/callback'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { provider: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/integrations/validators/social_validator').socialCallbackValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['callback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['callback']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/integrations/controllers/social_accounts_controller').default['callback']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['dashboard']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['dashboard']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['dashboard']>>>
    }
  }
  'platform.organizations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/organizations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').listOrganizationsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.organizations.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/organizations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.organizations.subscription.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/platform/organizations/:id/subscription'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateSubscriptionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateSubscriptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['updateSubscription']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['updateSubscription']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['updateSubscription']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.organizations.suspend': {
    methods: ["POST"]
    pattern: '/api/v1/platform/organizations/:id/suspend'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['suspend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['suspend']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['suspend']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.organizations.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/platform/organizations/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['reactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['reactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.organizations.restore': {
    methods: ["POST"]
    pattern: '/api/v1/platform/organizations/:id/restore'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['restore']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_organizations_controller').default['restore']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.plans.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/plans'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['index']>>>
    }
  }
  'platform.plans.store': {
    methods: ["POST"]
    pattern: '/api/v1/platform/plans'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').createPlanValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').createPlanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.plans.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/platform/plans/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').updatePlanValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').updatePlanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.plans.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/platform/plans/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_plans_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.users.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').listUsersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.users.roles.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/platform/users/:id/roles'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateUserRolesValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateUserRolesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['updateRoles']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['updateRoles']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['updateRoles']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.users.ban': {
    methods: ["POST"]
    pattern: '/api/v1/platform/users/:id/ban'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').reasonValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').reasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['ban']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['ban']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['ban']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.users.unban': {
    methods: ["POST"]
    pattern: '/api/v1/platform/users/:id/unban'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['unban']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['unban']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['unban']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.users.impersonate': {
    methods: ["POST"]
    pattern: '/api/v1/platform/users/:id/impersonate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').reasonValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').reasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['impersonate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['impersonate']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['impersonate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.admins.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/admins'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['admins']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['admins']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['admins']>>>
    }
  }
  'platform.admins.store': {
    methods: ["POST"]
    pattern: '/api/v1/platform/admins'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').grantAdminValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').grantAdminValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['grantAdmin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['grantAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['grantAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.admins.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/platform/admins/:userId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').adminUserIdValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').adminUserIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['revokeAdmin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['revokeAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_users_controller').default['revokeAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.settings.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['settings']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['settings']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['settings']>>>
    }
  }
  'platform.settings.update': {
    methods: ["PUT"]
    pattern: '/api/v1/platform/settings'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateSettingsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateSettingsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateSettings']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateSettings']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateSettings']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.payments.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').listPlatformPaymentsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['payments']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['payments']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['payments']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.payments.reconcile': {
    methods: ["POST"]
    pattern: '/api/v1/platform/payments/:id/reconcile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').idValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['reconcile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['reconcile']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['reconcile']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.demoRequests.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/demo-requests'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').listDemoRequestsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['demoRequests']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['demoRequests']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['demoRequests']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.demoRequests.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/platform/demo-requests/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateDemoRequestValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/platform/validators/platform_validator').updateDemoRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateDemoRequest']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateDemoRequest']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['updateDemoRequest']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.logs': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/logs/:kind'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { kind: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#modules/platform/validators/platform_validator').logsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['logs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['logs']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['logs']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'platform.health': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/platform/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['health']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['health']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#modules/platform/controllers/platform_operations_controller').default['health']>>>
    }
  }
}

export namespace Route {
  export type Request<Name extends keyof typeof routes> = RouteWithRegistry.Request<typeof routes, Name>
  export type Response<Name extends keyof typeof routes> = RouteWithRegistry.Response<typeof routes, Name>
  export type Params<Name extends keyof typeof routes> = RouteWithRegistry.Params<typeof routes, Name>
  export type Body<Name extends keyof typeof routes> = RouteWithRegistry.Body<typeof routes, Name>
  export type Query<Name extends keyof typeof routes> = RouteWithRegistry.Query<typeof routes, Name>
  export type Error<Name extends keyof typeof routes> = RouteWithRegistry.Error<typeof routes, Name>
}

export namespace Path {
  export type Request<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Request<typeof routes, M, P>
  export type Response<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Response<typeof routes, M, P>
  export type Params<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Params<typeof routes, M, P>
  export type Body<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Body<typeof routes, M, P>
  export type Query<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Query<typeof routes, M, P>
  export type Error<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Error<typeof routes, M, P>
}
