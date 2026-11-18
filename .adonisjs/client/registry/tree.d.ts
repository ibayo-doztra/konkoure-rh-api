/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    show: typeof routes['health.show']
    ready: typeof routes['health.ready']
  }
  openapi: {
    html: typeof routes['openapi.html']
    json: typeof routes['openapi.json']
    yaml: typeof routes['openapi.yaml']
  }
  auth: {
    register: typeof routes['auth.register']
    login: typeof routes['auth.login']
    refresh: typeof routes['auth.refresh']
    forgotPassword: typeof routes['auth.forgotPassword']
    resetPassword: typeof routes['auth.resetPassword']
    verifyEmail: typeof routes['auth.verifyEmail']
    invitations: {
      show: typeof routes['auth.invitations.show']
      accept: typeof routes['auth.invitations.accept']
    }
    logout: typeof routes['auth.logout']
    logoutAll: typeof routes['auth.logoutAll']
    resendVerification: typeof routes['auth.resendVerification']
  }
  me: {
    show: typeof routes['me.show']
    update: typeof routes['me.update']
    changePassword: typeof routes['me.changePassword']
    sessions: typeof routes['me.sessions']
    revokeSession: typeof routes['me.revokeSession']
    organizations: typeof routes['me.organizations']
  }
  organizations: {
    store: typeof routes['organizations.store']
  }
  org: {
    entitlements: {
      show: typeof routes['org.entitlements.show']
    }
    invitations: {
      index: typeof routes['org.invitations.index']
      store: typeof routes['org.invitations.store']
      resend: typeof routes['org.invitations.resend']
      destroy: typeof routes['org.invitations.destroy']
    }
  }
}
