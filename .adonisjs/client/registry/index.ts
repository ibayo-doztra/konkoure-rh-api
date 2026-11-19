/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'health.show': {
    methods: ["GET","HEAD"],
    pattern: '/health',
    tokens: [[0,"health"]],
    types: placeholder as Registry['health.show']['types'],
  },
  'health.ready': {
    methods: ["GET","HEAD"],
    pattern: '/health/ready',
    tokens: [[0,"health"],[0,"ready"]],
    types: placeholder as Registry['health.ready']['types'],
  },
  'openapi.html': {
    methods: ["GET","HEAD"],
    pattern: '/docs',
    tokens: [[0,"docs"]],
    types: placeholder as Registry['openapi.html']['types'],
  },
  'openapi.json': {
    methods: ["GET","HEAD"],
    pattern: '/docs.json',
    tokens: [[0,"docs.json"]],
    types: placeholder as Registry['openapi.json']['types'],
  },
  'openapi.yaml': {
    methods: ["GET","HEAD"],
    pattern: '/docs.yaml',
    tokens: [[0,"docs.yaml"]],
    types: placeholder as Registry['openapi.yaml']['types'],
  },
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
  'auth.invitations.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/invitations/:token',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"invitations"],[1,"token"]],
    types: placeholder as Registry['auth.invitations.show']['types'],
  },
  'auth.invitations.accept': {
    methods: ["POST"],
    pattern: '/api/v1/auth/invitations/:token/accept',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"invitations"],[1,"token"],[0,"accept"]],
    types: placeholder as Registry['auth.invitations.accept']['types'],
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
  'organizations.store': {
    methods: ["POST"],
    pattern: '/api/v1/organizations',
    tokens: [[0,"api"],[0,"v1"],[0,"organizations"]],
    types: placeholder as Registry['organizations.store']['types'],
  },
  'org.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org',
    tokens: [[0,"api"],[0,"v1"],[0,"org"]],
    types: placeholder as Registry['org.show']['types'],
  },
  'org.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org',
    tokens: [[0,"api"],[0,"v1"],[0,"org"]],
    types: placeholder as Registry['org.update']['types'],
  },
  'org.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org',
    tokens: [[0,"api"],[0,"v1"],[0,"org"]],
    types: placeholder as Registry['org.destroy']['types'],
  },
  'org.settings.update': {
    methods: ["PUT"],
    pattern: '/api/v1/org/settings',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"settings"]],
    types: placeholder as Registry['org.settings.update']['types'],
  },
  'org.logo.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/logo',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"logo"]],
    types: placeholder as Registry['org.logo.store']['types'],
  },
  'org.entitlements.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/entitlements',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"entitlements"]],
    types: placeholder as Registry['org.entitlements.show']['types'],
  },
  'org.members.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/members',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"members"]],
    types: placeholder as Registry['org.members.index']['types'],
  },
  'org.members.roles.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org/members/:userId/roles',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"members"],[1,"userId"],[0,"roles"]],
    types: placeholder as Registry['org.members.roles.update']['types'],
  },
  'org.members.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/members/:userId',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"members"],[1,"userId"]],
    types: placeholder as Registry['org.members.destroy']['types'],
  },
  'org.invitations.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/invitations',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"invitations"]],
    types: placeholder as Registry['org.invitations.index']['types'],
  },
  'org.invitations.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/invitations',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"invitations"]],
    types: placeholder as Registry['org.invitations.store']['types'],
  },
  'org.invitations.resend': {
    methods: ["POST"],
    pattern: '/api/v1/org/invitations/:id/resend',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"invitations"],[1,"id"],[0,"resend"]],
    types: placeholder as Registry['org.invitations.resend']['types'],
  },
  'org.invitations.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/invitations/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"invitations"],[1,"id"]],
    types: placeholder as Registry['org.invitations.destroy']['types'],
  },
  'org.departments.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/departments',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"]],
    types: placeholder as Registry['org.departments.index']['types'],
  },
  'org.departments.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/departments',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"]],
    types: placeholder as Registry['org.departments.store']['types'],
  },
  'org.departments.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/departments/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"],[1,"id"]],
    types: placeholder as Registry['org.departments.show']['types'],
  },
  'org.departments.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org/departments/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"],[1,"id"]],
    types: placeholder as Registry['org.departments.update']['types'],
  },
  'org.departments.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/departments/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"],[1,"id"]],
    types: placeholder as Registry['org.departments.destroy']['types'],
  },
  'org.departments.employees': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/departments/:id/employees',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"departments"],[1,"id"],[0,"employees"]],
    types: placeholder as Registry['org.departments.employees']['types'],
  },
  'org.employees.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"]],
    types: placeholder as Registry['org.employees.index']['types'],
  },
  'org.employees.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/employees',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"]],
    types: placeholder as Registry['org.employees.store']['types'],
  },
  'org.employees.managers': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees/managers',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[0,"managers"]],
    types: placeholder as Registry['org.employees.managers']['types'],
  },
  'org.employees.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"]],
    types: placeholder as Registry['org.employees.show']['types'],
  },
  'org.employees.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org/employees/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"]],
    types: placeholder as Registry['org.employees.update']['types'],
  },
  'org.employees.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/employees/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"]],
    types: placeholder as Registry['org.employees.destroy']['types'],
  },
  'org.employees.restore': {
    methods: ["POST"],
    pattern: '/api/v1/org/employees/:id/restore',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"],[0,"restore"]],
    types: placeholder as Registry['org.employees.restore']['types'],
  },
  'org.employees.salary': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees/:id/salary',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"],[0,"salary"]],
    types: placeholder as Registry['org.employees.salary']['types'],
  },
  'org.employees.team': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees/:id/team',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"],[0,"team"]],
    types: placeholder as Registry['org.employees.team']['types'],
  },
  'org.employees.skills.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/employees/:id/skills',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"],[0,"skills"]],
    types: placeholder as Registry['org.employees.skills.index']['types'],
  },
  'org.employees.skills.replace': {
    methods: ["PUT"],
    pattern: '/api/v1/org/employees/:id/skills',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"employees"],[1,"id"],[0,"skills"]],
    types: placeholder as Registry['org.employees.skills.replace']['types'],
  },
  'org.contracts.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/contracts',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"]],
    types: placeholder as Registry['org.contracts.index']['types'],
  },
  'org.contracts.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/contracts',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"]],
    types: placeholder as Registry['org.contracts.store']['types'],
  },
  'org.contracts.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/contracts/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"],[1,"id"]],
    types: placeholder as Registry['org.contracts.show']['types'],
  },
  'org.contracts.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org/contracts/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"],[1,"id"]],
    types: placeholder as Registry['org.contracts.update']['types'],
  },
  'org.contracts.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/contracts/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"],[1,"id"]],
    types: placeholder as Registry['org.contracts.destroy']['types'],
  },
  'org.contracts.terminate': {
    methods: ["POST"],
    pattern: '/api/v1/org/contracts/:id/terminate',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"],[1,"id"],[0,"terminate"]],
    types: placeholder as Registry['org.contracts.terminate']['types'],
  },
  'org.contracts.document': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/contracts/:id/document',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"contracts"],[1,"id"],[0,"document"]],
    types: placeholder as Registry['org.contracts.document']['types'],
  },
  'org.skills.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/org/skills',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"skills"]],
    types: placeholder as Registry['org.skills.index']['types'],
  },
  'org.skills.store': {
    methods: ["POST"],
    pattern: '/api/v1/org/skills',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"skills"]],
    types: placeholder as Registry['org.skills.store']['types'],
  },
  'org.skills.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/org/skills/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"skills"],[1,"id"]],
    types: placeholder as Registry['org.skills.update']['types'],
  },
  'org.skills.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/org/skills/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"org"],[0,"skills"],[1,"id"]],
    types: placeholder as Registry['org.skills.destroy']['types'],
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
