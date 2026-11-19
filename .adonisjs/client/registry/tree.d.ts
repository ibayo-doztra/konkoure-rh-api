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
    departments: {
      index: typeof routes['org.departments.index']
      store: typeof routes['org.departments.store']
      show: typeof routes['org.departments.show']
      update: typeof routes['org.departments.update']
      destroy: typeof routes['org.departments.destroy']
      employees: typeof routes['org.departments.employees']
    }
    employees: {
      index: typeof routes['org.employees.index']
      store: typeof routes['org.employees.store']
      managers: typeof routes['org.employees.managers']
      show: typeof routes['org.employees.show']
      update: typeof routes['org.employees.update']
      destroy: typeof routes['org.employees.destroy']
      restore: typeof routes['org.employees.restore']
      salary: typeof routes['org.employees.salary']
      team: typeof routes['org.employees.team']
      skills: {
        index: typeof routes['org.employees.skills.index']
        replace: typeof routes['org.employees.skills.replace']
      }
    }
    contracts: {
      index: typeof routes['org.contracts.index']
      store: typeof routes['org.contracts.store']
      show: typeof routes['org.contracts.show']
      update: typeof routes['org.contracts.update']
      destroy: typeof routes['org.contracts.destroy']
      terminate: typeof routes['org.contracts.terminate']
      document: typeof routes['org.contracts.document']
    }
    skills: {
      index: typeof routes['org.skills.index']
      store: typeof routes['org.skills.store']
      update: typeof routes['org.skills.update']
      destroy: typeof routes['org.skills.destroy']
    }
  }
}
