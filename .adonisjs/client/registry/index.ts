/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'auth.register': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"register"]],
    types: placeholder as Registry['auth.register']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"login"]],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.refresh': {
    methods: ["POST"],
    pattern: '/api/v1/auth/refresh',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"refresh"]],
    types: placeholder as Registry['auth.refresh']['types'],
  },
  'auth.forgotPassword': {
    methods: ["POST"],
    pattern: '/api/v1/auth/forgot-password',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"forgot-password"]],
    types: placeholder as Registry['auth.forgotPassword']['types'],
  },
  'auth.resetPassword': {
    methods: ["POST"],
    pattern: '/api/v1/auth/reset-password',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"reset-password"]],
    types: placeholder as Registry['auth.resetPassword']['types'],
  },
  'auth.verifyEmail': {
    methods: ["POST"],
    pattern: '/api/v1/auth/verify-email',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"verify-email"]],
    types: placeholder as Registry['auth.verifyEmail']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"logout"]],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.logoutAll': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout-all',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"logout-all"]],
    types: placeholder as Registry['auth.logoutAll']['types'],
  },
  'auth.resendVerification': {
    methods: ["POST"],
    pattern: '/api/v1/auth/resend-verification',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"resend-verification"]],
    types: placeholder as Registry['auth.resendVerification']['types'],
  },
  'me.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me',
    tokens: [[0,"api"],[0,"v1"],[0,"me"]],
    types: placeholder as Registry['me.show']['types'],
  },
  'me.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/me',
    tokens: [[0,"api"],[0,"v1"],[0,"me"]],
    types: placeholder as Registry['me.update']['types'],
  },
  'me.changePassword': {
    methods: ["POST"],
    pattern: '/api/v1/me/password',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"password"]],
    types: placeholder as Registry['me.changePassword']['types'],
  },
  'me.sessions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me/sessions',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"sessions"]],
    types: placeholder as Registry['me.sessions']['types'],
  },
  'me.revokeSession': {
    methods: ["DELETE"],
    pattern: '/api/v1/me/sessions/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"sessions"],[1,"id"]],
    types: placeholder as Registry['me.revokeSession']['types'],
  },
  'me.organizations': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me/organizations',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"organizations"]],
    types: placeholder as Registry['me.organizations']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
