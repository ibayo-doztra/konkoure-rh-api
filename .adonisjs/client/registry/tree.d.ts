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
      import: {
        preview: typeof routes['org.employees.import.preview']
        commit: typeof routes['org.employees.import.commit']
      }
      export: typeof routes['org.employees.export']
      show: typeof routes['org.employees.show']
      update: typeof routes['org.employees.update']
      destroy: typeof routes['org.employees.destroy']
      restore: typeof routes['org.employees.restore']
      salary: typeof routes['org.employees.salary']
      team: typeof routes['org.employees.team']
      documents: {
        index: typeof routes['org.employees.documents.index']
        store: typeof routes['org.employees.documents.store']
        url: typeof routes['org.employees.documents.url']
        destroy: typeof routes['org.employees.documents.destroy']
      }
      photo: typeof routes['org.employees.photo']
      skills: {
        index: typeof routes['org.employees.skills.index']
        replace: typeof routes['org.employees.skills.replace']
      }
      leaveBalance: typeof routes['org.employees.leaveBalance']
      badge: {
        show: typeof routes['org.employees.badge.show']
        store: typeof routes['org.employees.badge.store']
        destroy: typeof routes['org.employees.badge.destroy']
      }
    }
    contracts: {
      index: typeof routes['org.contracts.index']
      store: typeof routes['org.contracts.store']
      show: typeof routes['org.contracts.show']
      update: typeof routes['org.contracts.update']
      destroy: typeof routes['org.contracts.destroy']
      terminate: typeof routes['org.contracts.terminate']
      document: typeof routes['org.contracts.document'] & {
        store: typeof routes['org.contracts.document.store']
      }
    }
    skills: {
      index: typeof routes['org.skills.index']
      store: typeof routes['org.skills.store']
      update: typeof routes['org.skills.update']
      destroy: typeof routes['org.skills.destroy']
    }
    leaves: {
      index: typeof routes['org.leaves.index']
      store: typeof routes['org.leaves.store']
      calendar: typeof routes['org.leaves.calendar']
      balances: {
        index: typeof routes['org.leaves.balances.index']
        adjust: typeof routes['org.leaves.balances.adjust']
      }
      show: typeof routes['org.leaves.show']
      update: typeof routes['org.leaves.update']
      approve: typeof routes['org.leaves.approve']
      reject: typeof routes['org.leaves.reject']
      cancel: typeof routes['org.leaves.cancel']
      attachment: {
        store: typeof routes['org.leaves.attachment.store']
        show: typeof routes['org.leaves.attachment.show']
      }
    }
    holidays: {
      index: typeof routes['org.holidays.index']
      store: typeof routes['org.holidays.store']
      import: typeof routes['org.holidays.import']
      update: typeof routes['org.holidays.update']
      destroy: typeof routes['org.holidays.destroy']
    }
    timeclock: {
      zones: {
        index: typeof routes['org.timeclock.zones.index']
        store: typeof routes['org.timeclock.zones.store']
        update: typeof routes['org.timeclock.zones.update']
        destroy: typeof routes['org.timeclock.zones.destroy']
      }
      punch: typeof routes['org.timeclock.punch']
      logs: {
        index: typeof routes['org.timeclock.logs.index']
        export: typeof routes['org.timeclock.logs.export']
        update: typeof routes['org.timeclock.logs.update']
        destroy: typeof routes['org.timeclock.logs.destroy']
      }
      attendance: {
        index: typeof routes['org.timeclock.attendance.index']
      }
      today: typeof routes['org.timeclock.today']
      badgeEvents: typeof routes['org.timeclock.badgeEvents']
      devices: {
        index: typeof routes['org.timeclock.devices.index']
        store: typeof routes['org.timeclock.devices.store']
        show: typeof routes['org.timeclock.devices.show']
        destroy: typeof routes['org.timeclock.devices.destroy']
      }
      scan: typeof routes['org.timeclock.scan']
      sync: typeof routes['org.timeclock.sync']
    }
  }
}
