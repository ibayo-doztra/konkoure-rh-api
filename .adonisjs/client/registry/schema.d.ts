/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
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
