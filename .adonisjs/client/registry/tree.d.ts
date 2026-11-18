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
    show: typeof routes['org.show']
    update: typeof routes['org.update']
    destroy: typeof routes['org.destroy']
    settings: {
      update: typeof routes['org.settings.update']
    }
    logo: {
      store: typeof routes['org.logo.store']
    }
    entitlements: {
      show: typeof routes['org.entitlements.show']
    }
    members: {
      index: typeof routes['org.members.index']
      roles: {
        update: typeof routes['org.members.roles.update']
      }
      destroy: typeof routes['org.members.destroy']
    }
    invitations: {
      index: typeof routes['org.invitations.index']
      store: typeof routes['org.invitations.store']
      resend: typeof routes['org.invitations.resend']
      destroy: typeof routes['org.invitations.destroy']
    }
  }
}
