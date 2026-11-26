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
    destroy: typeof routes['me.destroy']
    update: typeof routes['me.update']
    changePassword: typeof routes['me.changePassword']
    sessions: typeof routes['me.sessions']
    revokeSession: typeof routes['me.revokeSession']
    export: typeof routes['me.export']
    organizations: typeof routes['me.organizations']
    notifications: {
      index: typeof routes['me.notifications.index']
      readAll: typeof routes['me.notifications.readAll']
      read: typeof routes['me.notifications.read']
    }
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
    billing: {
      subscription: typeof routes['org.billing.subscription']
      plans: typeof routes['org.billing.plans']
      usage: typeof routes['org.billing.usage']
      payments: {
        index: typeof routes['org.billing.payments.index']
        show: typeof routes['org.billing.payments.show']
      }
      invoices: {
        index: typeof routes['org.billing.invoices.index']
        pdf: typeof routes['org.billing.invoices.pdf']
      }
      checkout: typeof routes['org.billing.checkout']
      cancel: typeof routes['org.billing.cancel']
      resume: typeof routes['org.billing.resume']
    }
    dashboard: {
      show: typeof routes['org.dashboard.show']
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
      directory: typeof routes['org.employees.directory']
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
    performance: {
      cycles: {
        index: typeof routes['org.performance.cycles.index']
        store: typeof routes['org.performance.cycles.store']
        update: typeof routes['org.performance.cycles.update']
        open: typeof routes['org.performance.cycles.open']
        close: typeof routes['org.performance.cycles.close']
      }
      plans: {
        index: typeof routes['org.performance.plans.index']
        store: typeof routes['org.performance.plans.store']
        update: typeof routes['org.performance.plans.update']
        destroy: typeof routes['org.performance.plans.destroy']
      }
      goals: {
        index: typeof routes['org.performance.goals.index']
        store: typeof routes['org.performance.goals.store']
        show: typeof routes['org.performance.goals.show']
        update: typeof routes['org.performance.goals.update']
        destroy: typeof routes['org.performance.goals.destroy']
        progress: typeof routes['org.performance.goals.progress']
        activities: {
          index: typeof routes['org.performance.goals.activities.index']
          store: typeof routes['org.performance.goals.activities.store']
          update: typeof routes['org.performance.goals.activities.update']
          destroy: typeof routes['org.performance.goals.activities.destroy']
        }
      }
      activities: {
        index: typeof routes['org.performance.activities.index']
      }
      okrs: {
        index: typeof routes['org.performance.okrs.index']
        store: typeof routes['org.performance.okrs.store']
        suggest: typeof routes['org.performance.okrs.suggest']
        show: typeof routes['org.performance.okrs.show']
        update: typeof routes['org.performance.okrs.update']
        destroy: typeof routes['org.performance.okrs.destroy']
        keyResults: typeof routes['org.performance.okrs.keyResults'] & {
          update: typeof routes['org.performance.okrs.keyResults.update']
        }
        submit: typeof routes['org.performance.okrs.submit']
        validate: typeof routes['org.performance.okrs.validate']
        requestRevision: typeof routes['org.performance.okrs.requestRevision']
        checkins: {
          index: typeof routes['org.performance.okrs.checkins.index']
          store: typeof routes['org.performance.okrs.checkins.store']
        }
      }
      reviews: {
        index: typeof routes['org.performance.reviews.index']
        store: typeof routes['org.performance.reviews.store']
        show: typeof routes['org.performance.reviews.show']
        self: typeof routes['org.performance.reviews.self']
        submitSelf: typeof routes['org.performance.reviews.submitSelf']
        manager: typeof routes['org.performance.reviews.manager']
        validate: typeof routes['org.performance.reviews.validate']
        sendBack: typeof routes['org.performance.reviews.sendBack']
        sign: typeof routes['org.performance.reviews.sign']
        aiSummary: typeof routes['org.performance.reviews.aiSummary']
        talent: typeof routes['org.performance.reviews.talent']
      }
      feedback: {
        index: typeof routes['org.performance.feedback.index']
        store: typeof routes['org.performance.feedback.store']
        destroy: typeof routes['org.performance.feedback.destroy']
      }
      achievements: {
        index: typeof routes['org.performance.achievements.index']
        store: typeof routes['org.performance.achievements.store']
        destroy: typeof routes['org.performance.achievements.destroy']
      }
    }
    talents: {
      nineBox: typeof routes['org.talents.nineBox']
      skillsMatrix: {
        show: typeof routes['org.talents.skillsMatrix.show']
        update: typeof routes['org.talents.skillsMatrix.update']
      }
      succession: {
        index: typeof routes['org.talents.succession.index']
        store: typeof routes['org.talents.succession.store']
        update: typeof routes['org.talents.succession.update']
        destroy: typeof routes['org.talents.succession.destroy']
      }
    }
    recruitment: {
      jobs: {
        index: typeof routes['org.recruitment.jobs.index']
        store: typeof routes['org.recruitment.jobs.store']
        show: typeof routes['org.recruitment.jobs.show']
        update: typeof routes['org.recruitment.jobs.update']
        destroy: typeof routes['org.recruitment.jobs.destroy']
        publish: typeof routes['org.recruitment.jobs.publish']
        close: typeof routes['org.recruitment.jobs.close']
        duplicate: typeof routes['org.recruitment.jobs.duplicate']
        qr: typeof routes['org.recruitment.jobs.qr']
        generate: typeof routes['org.recruitment.jobs.generate']
        socialPosts: {
          index: typeof routes['org.recruitment.jobs.social_posts.index']
          store: typeof routes['org.recruitment.jobs.social_posts.store']
          suggest: typeof routes['org.recruitment.jobs.social_posts.suggest']
        }
      }
      candidates: {
        index: typeof routes['org.recruitment.candidates.index']
        store: typeof routes['org.recruitment.candidates.store']
        show: typeof routes['org.recruitment.candidates.show']
        update: typeof routes['org.recruitment.candidates.update']
        destroy: typeof routes['org.recruitment.candidates.destroy']
        stage: typeof routes['org.recruitment.candidates.stage']
        hire: typeof routes['org.recruitment.candidates.hire']
        documents: {
          url: typeof routes['org.recruitment.candidates.documents.url']
        }
        notes: {
          index: typeof routes['org.recruitment.candidates.notes.index']
          store: typeof routes['org.recruitment.candidates.notes.store']
          destroy: typeof routes['org.recruitment.candidates.notes.destroy']
        }
        events: typeof routes['org.recruitment.candidates.events']
      }
      webhooks: {
        show: typeof routes['org.recruitment.webhooks.show']
        update: typeof routes['org.recruitment.webhooks.update']
        ping: typeof routes['org.recruitment.webhooks.ping']
      }
    }
    integrations: {
      socialAccounts: {
        index: typeof routes['org.integrations.social_accounts.index']
        store: typeof routes['org.integrations.social_accounts.store']
        destroy: typeof routes['org.integrations.social_accounts.destroy']
      }
    }
    timeclock: {
      zones: {
        index: typeof routes['org.timeclock.zones.index']
        store: typeof routes['org.timeclock.zones.store']
        update: typeof routes['org.timeclock.zones.update']
        destroy: typeof routes['org.timeclock.zones.destroy']
      }
      schedules: {
        index: typeof routes['org.timeclock.schedules.index']
        store: typeof routes['org.timeclock.schedules.store']
        update: typeof routes['org.timeclock.schedules.update']
        destroy: typeof routes['org.timeclock.schedules.destroy']
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
  public: {
    careers: {
      show: typeof routes['public.careers.show']
      jobs: {
        show: typeof routes['public.careers.jobs.show']
        apply: typeof routes['public.careers.jobs.apply'] & {
          check: typeof routes['public.careers.jobs.apply.check']
        }
      }
    }
    plans: typeof routes['public.plans']
    demoRequests: {
      store: typeof routes['public.demoRequests.store']
    }
    payments: {
      checkout: typeof routes['public.payments.checkout']
      show: typeof routes['public.payments.show']
      claim: typeof routes['public.payments.claim']
    }
  }
  webhooks: {
    n8N: {
      scoring: typeof routes['webhooks.n8n.scoring']
    }
    djomy: typeof routes['webhooks.djomy']
  }
  oauth: {
    social: {
      callback: typeof routes['oauth.social.callback']
    }
  }
  platform: {
    dashboard: typeof routes['platform.dashboard']
    organizations: {
      index: typeof routes['platform.organizations.index']
      show: typeof routes['platform.organizations.show']
      subscription: {
        update: typeof routes['platform.organizations.subscription.update']
      }
      suspend: typeof routes['platform.organizations.suspend']
      reactivate: typeof routes['platform.organizations.reactivate']
      restore: typeof routes['platform.organizations.restore']
    }
    plans: {
      index: typeof routes['platform.plans.index']
      store: typeof routes['platform.plans.store']
      update: typeof routes['platform.plans.update']
      destroy: typeof routes['platform.plans.destroy']
    }
    users: {
      index: typeof routes['platform.users.index']
      roles: {
        update: typeof routes['platform.users.roles.update']
      }
      ban: typeof routes['platform.users.ban']
      unban: typeof routes['platform.users.unban']
      impersonate: typeof routes['platform.users.impersonate']
    }
    admins: {
      index: typeof routes['platform.admins.index']
      store: typeof routes['platform.admins.store']
      destroy: typeof routes['platform.admins.destroy']
    }
    settings: {
      show: typeof routes['platform.settings.show']
      update: typeof routes['platform.settings.update']
    }
    payments: {
      index: typeof routes['platform.payments.index']
      reconcile: typeof routes['platform.payments.reconcile']
    }
    demoRequests: {
      index: typeof routes['platform.demoRequests.index']
      update: typeof routes['platform.demoRequests.update']
    }
    logs: typeof routes['platform.logs']
    health: typeof routes['platform.health']
  }
}
