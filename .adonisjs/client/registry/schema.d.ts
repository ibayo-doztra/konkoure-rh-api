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
