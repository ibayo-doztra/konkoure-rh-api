import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.show': { paramsTuple?: []; params?: {} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'openapi.html': { paramsTuple?: []; params?: {} }
    'openapi.json': { paramsTuple?: []; params?: {} }
    'openapi.yaml': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'auth.forgotPassword': { paramsTuple?: []; params?: {} }
    'auth.resetPassword': { paramsTuple?: []; params?: {} }
    'auth.verifyEmail': { paramsTuple?: []; params?: {} }
    'auth.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.resendVerification': { paramsTuple?: []; params?: {} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.destroy': { paramsTuple?: []; params?: {} }
    'me.update': { paramsTuple?: []; params?: {} }
    'me.changePassword': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.export': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
    'me.notifications.index': { paramsTuple?: []; params?: {} }
    'me.notifications.readAll': { paramsTuple?: []; params?: {} }
    'me.notifications.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organizations.store': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.update': { paramsTuple?: []; params?: {} }
    'org.destroy': { paramsTuple?: []; params?: {} }
    'org.settings.update': { paramsTuple?: []; params?: {} }
    'org.logo.store': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
    'org.billing.subscription': { paramsTuple?: []; params?: {} }
    'org.billing.plans': { paramsTuple?: []; params?: {} }
    'org.billing.usage': { paramsTuple?: []; params?: {} }
    'org.billing.payments.index': { paramsTuple?: []; params?: {} }
    'org.billing.payments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.billing.invoices.index': { paramsTuple?: []; params?: {} }
    'org.billing.invoices.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.billing.checkout': { paramsTuple?: []; params?: {} }
    'org.billing.cancel': { paramsTuple?: []; params?: {} }
    'org.billing.resume': { paramsTuple?: []; params?: {} }
    'org.dashboard.show': { paramsTuple?: []; params?: {} }
    'org.members.index': { paramsTuple?: []; params?: {} }
    'org.members.roles.update': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.members.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.invitations.index': { paramsTuple?: []; params?: {} }
    'org.invitations.store': { paramsTuple?: []; params?: {} }
    'org.invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.invitations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.index': { paramsTuple?: []; params?: {} }
    'org.departments.store': { paramsTuple?: []; params?: {} }
    'org.departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.employees': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.index': { paramsTuple?: []; params?: {} }
    'org.employees.store': { paramsTuple?: []; params?: {} }
    'org.employees.managers': { paramsTuple?: []; params?: {} }
    'org.employees.directory': { paramsTuple?: []; params?: {} }
    'org.employees.import.preview': { paramsTuple?: []; params?: {} }
    'org.employees.import.commit': { paramsTuple?: []; params?: {} }
    'org.employees.export': { paramsTuple?: []; params?: {} }
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'docId': ParamValue} }
    'org.employees.documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'docId': ParamValue} }
    'org.employees.photo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.skills.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.skills.replace': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.leaveBalance': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.index': { paramsTuple?: []; params?: {} }
    'org.contracts.store': { paramsTuple?: []; params?: {} }
    'org.contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.terminate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.document.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.index': { paramsTuple?: []; params?: {} }
    'org.skills.store': { paramsTuple?: []; params?: {} }
    'org.skills.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.index': { paramsTuple?: []; params?: {} }
    'org.leaves.store': { paramsTuple?: []; params?: {} }
    'org.leaves.calendar': { paramsTuple?: []; params?: {} }
    'org.leaves.balances.index': { paramsTuple?: []; params?: {} }
    'org.leaves.balances.adjust': { paramsTuple?: []; params?: {} }
    'org.leaves.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.attachment.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.attachment.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.index': { paramsTuple?: []; params?: {} }
    'org.holidays.store': { paramsTuple?: []; params?: {} }
    'org.holidays.import': { paramsTuple?: []; params?: {} }
    'org.holidays.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.cycles.index': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.store': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.cycles.open': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.cycles.close': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.plans.index': { paramsTuple?: []; params?: {} }
    'org.performance.plans.store': { paramsTuple?: []; params?: {} }
    'org.performance.plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.index': { paramsTuple?: []; params?: {} }
    'org.performance.goals.store': { paramsTuple?: []; params?: {} }
    'org.performance.goals.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.progress': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'activityId': ParamValue} }
    'org.performance.goals.activities.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'activityId': ParamValue} }
    'org.performance.activities.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.store': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.suggest': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.keyResults': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.keyResults.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'krId': ParamValue} }
    'org.performance.okrs.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.requestRevision': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.index': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.store': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.self': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.submitSelf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.manager': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sendBack': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sign': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.aiSummary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.talent': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.index': { paramsTuple?: []; params?: {} }
    'org.performance.feedback.store': { paramsTuple?: []; params?: {} }
    'org.performance.feedback.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.achievements.index': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.store': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.talents.nineBox': { paramsTuple?: []; params?: {} }
    'org.talents.skillsMatrix.show': { paramsTuple?: []; params?: {} }
    'org.talents.skillsMatrix.update': { paramsTuple?: []; params?: {} }
    'org.talents.succession.index': { paramsTuple?: []; params?: {} }
    'org.talents.succession.store': { paramsTuple?: []; params?: {} }
    'org.talents.succession.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.talents.succession.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.store': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.publish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.close': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.duplicate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.suggest': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.candidates.store': { paramsTuple?: []; params?: {} }
    'org.recruitment.candidates.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.stage': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.hire': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'key': ParamValue} }
    'org.recruitment.candidates.notes.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.notes.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.notes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'noteId': ParamValue} }
    'org.recruitment.candidates.events': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.webhooks.show': { paramsTuple?: []; params?: {} }
    'org.recruitment.webhooks.update': { paramsTuple?: []; params?: {} }
    'org.recruitment.webhooks.ping': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.index': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.store': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.schedules.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.schedules.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.schedules.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.schedules.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.punch': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.export': { paramsTuple?: []; params?: {} }
    'org.timeclock.attendance.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.today': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.badgeEvents': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.scan': { paramsTuple?: []; params?: {} }
    'org.timeclock.sync': { paramsTuple?: []; params?: {} }
    'public.careers.show': { paramsTuple: [ParamValue]; params: {'orgSlug': ParamValue} }
    'public.careers.jobs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.careers.jobs.apply.check': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.careers.jobs.apply': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.plans': { paramsTuple?: []; params?: {} }
    'public.demoRequests.store': { paramsTuple?: []; params?: {} }
    'public.payments.checkout': { paramsTuple?: []; params?: {} }
    'public.payments.show': { paramsTuple: [ParamValue]; params: {'ref': ParamValue} }
    'public.payments.claim': { paramsTuple: [ParamValue]; params: {'ref': ParamValue} }
    'webhooks.n8n.scoring': { paramsTuple?: []; params?: {} }
    'webhooks.djomy': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.social.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'platform.dashboard': { paramsTuple?: []; params?: {} }
    'platform.organizations.index': { paramsTuple?: []; params?: {} }
    'platform.organizations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.subscription.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.suspend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.index': { paramsTuple?: []; params?: {} }
    'platform.plans.store': { paramsTuple?: []; params?: {} }
    'platform.plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.index': { paramsTuple?: []; params?: {} }
    'platform.users.roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.ban': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.unban': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.impersonate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.admins.index': { paramsTuple?: []; params?: {} }
    'platform.admins.store': { paramsTuple?: []; params?: {} }
    'platform.admins.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'platform.settings.show': { paramsTuple?: []; params?: {} }
    'platform.settings.update': { paramsTuple?: []; params?: {} }
    'platform.payments.index': { paramsTuple?: []; params?: {} }
    'platform.payments.reconcile': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.demoRequests.index': { paramsTuple?: []; params?: {} }
    'platform.demoRequests.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.logs': { paramsTuple: [ParamValue]; params: {'kind': ParamValue} }
    'platform.health': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.show': { paramsTuple?: []; params?: {} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'openapi.html': { paramsTuple?: []; params?: {} }
    'openapi.json': { paramsTuple?: []; params?: {} }
    'openapi.yaml': { paramsTuple?: []; params?: {} }
    'auth.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.export': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
    'me.notifications.index': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
    'org.billing.subscription': { paramsTuple?: []; params?: {} }
    'org.billing.plans': { paramsTuple?: []; params?: {} }
    'org.billing.usage': { paramsTuple?: []; params?: {} }
    'org.billing.payments.index': { paramsTuple?: []; params?: {} }
    'org.billing.payments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.billing.invoices.index': { paramsTuple?: []; params?: {} }
    'org.billing.invoices.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.dashboard.show': { paramsTuple?: []; params?: {} }
    'org.members.index': { paramsTuple?: []; params?: {} }
    'org.invitations.index': { paramsTuple?: []; params?: {} }
    'org.departments.index': { paramsTuple?: []; params?: {} }
    'org.departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.employees': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.index': { paramsTuple?: []; params?: {} }
    'org.employees.managers': { paramsTuple?: []; params?: {} }
    'org.employees.directory': { paramsTuple?: []; params?: {} }
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'docId': ParamValue} }
    'org.employees.skills.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.leaveBalance': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.index': { paramsTuple?: []; params?: {} }
    'org.contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.index': { paramsTuple?: []; params?: {} }
    'org.leaves.index': { paramsTuple?: []; params?: {} }
    'org.leaves.calendar': { paramsTuple?: []; params?: {} }
    'org.leaves.balances.index': { paramsTuple?: []; params?: {} }
    'org.leaves.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.attachment.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.index': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.index': { paramsTuple?: []; params?: {} }
    'org.performance.plans.index': { paramsTuple?: []; params?: {} }
    'org.performance.goals.index': { paramsTuple?: []; params?: {} }
    'org.performance.goals.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.activities.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.index': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.index': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.index': { paramsTuple?: []; params?: {} }
    'org.talents.nineBox': { paramsTuple?: []; params?: {} }
    'org.talents.skillsMatrix.show': { paramsTuple?: []; params?: {} }
    'org.talents.succession.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.candidates.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'key': ParamValue} }
    'org.recruitment.candidates.notes.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.events': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.webhooks.show': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.schedules.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.attendance.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.today': { paramsTuple?: []; params?: {} }
    'org.timeclock.badgeEvents': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public.careers.show': { paramsTuple: [ParamValue]; params: {'orgSlug': ParamValue} }
    'public.careers.jobs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.plans': { paramsTuple?: []; params?: {} }
    'public.payments.show': { paramsTuple: [ParamValue]; params: {'ref': ParamValue} }
    'oauth.social.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'platform.dashboard': { paramsTuple?: []; params?: {} }
    'platform.organizations.index': { paramsTuple?: []; params?: {} }
    'platform.organizations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.index': { paramsTuple?: []; params?: {} }
    'platform.users.index': { paramsTuple?: []; params?: {} }
    'platform.admins.index': { paramsTuple?: []; params?: {} }
    'platform.settings.show': { paramsTuple?: []; params?: {} }
    'platform.payments.index': { paramsTuple?: []; params?: {} }
    'platform.demoRequests.index': { paramsTuple?: []; params?: {} }
    'platform.logs': { paramsTuple: [ParamValue]; params: {'kind': ParamValue} }
    'platform.health': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'health.show': { paramsTuple?: []; params?: {} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'openapi.html': { paramsTuple?: []; params?: {} }
    'openapi.json': { paramsTuple?: []; params?: {} }
    'openapi.yaml': { paramsTuple?: []; params?: {} }
    'auth.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.export': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
    'me.notifications.index': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
    'org.billing.subscription': { paramsTuple?: []; params?: {} }
    'org.billing.plans': { paramsTuple?: []; params?: {} }
    'org.billing.usage': { paramsTuple?: []; params?: {} }
    'org.billing.payments.index': { paramsTuple?: []; params?: {} }
    'org.billing.payments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.billing.invoices.index': { paramsTuple?: []; params?: {} }
    'org.billing.invoices.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.dashboard.show': { paramsTuple?: []; params?: {} }
    'org.members.index': { paramsTuple?: []; params?: {} }
    'org.invitations.index': { paramsTuple?: []; params?: {} }
    'org.departments.index': { paramsTuple?: []; params?: {} }
    'org.departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.employees': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.index': { paramsTuple?: []; params?: {} }
    'org.employees.managers': { paramsTuple?: []; params?: {} }
    'org.employees.directory': { paramsTuple?: []; params?: {} }
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'docId': ParamValue} }
    'org.employees.skills.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.leaveBalance': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.index': { paramsTuple?: []; params?: {} }
    'org.contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.index': { paramsTuple?: []; params?: {} }
    'org.leaves.index': { paramsTuple?: []; params?: {} }
    'org.leaves.calendar': { paramsTuple?: []; params?: {} }
    'org.leaves.balances.index': { paramsTuple?: []; params?: {} }
    'org.leaves.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.attachment.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.index': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.index': { paramsTuple?: []; params?: {} }
    'org.performance.plans.index': { paramsTuple?: []; params?: {} }
    'org.performance.goals.index': { paramsTuple?: []; params?: {} }
    'org.performance.goals.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.activities.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.index': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.index': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.index': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.index': { paramsTuple?: []; params?: {} }
    'org.talents.nineBox': { paramsTuple?: []; params?: {} }
    'org.talents.skillsMatrix.show': { paramsTuple?: []; params?: {} }
    'org.talents.succession.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.index': { paramsTuple?: []; params?: {} }
    'org.recruitment.candidates.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.documents.url': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'key': ParamValue} }
    'org.recruitment.candidates.notes.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.events': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.webhooks.show': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.schedules.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.attendance.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.today': { paramsTuple?: []; params?: {} }
    'org.timeclock.badgeEvents': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public.careers.show': { paramsTuple: [ParamValue]; params: {'orgSlug': ParamValue} }
    'public.careers.jobs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.plans': { paramsTuple?: []; params?: {} }
    'public.payments.show': { paramsTuple: [ParamValue]; params: {'ref': ParamValue} }
    'oauth.social.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'platform.dashboard': { paramsTuple?: []; params?: {} }
    'platform.organizations.index': { paramsTuple?: []; params?: {} }
    'platform.organizations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.index': { paramsTuple?: []; params?: {} }
    'platform.users.index': { paramsTuple?: []; params?: {} }
    'platform.admins.index': { paramsTuple?: []; params?: {} }
    'platform.settings.show': { paramsTuple?: []; params?: {} }
    'platform.payments.index': { paramsTuple?: []; params?: {} }
    'platform.demoRequests.index': { paramsTuple?: []; params?: {} }
    'platform.logs': { paramsTuple: [ParamValue]; params: {'kind': ParamValue} }
    'platform.health': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'auth.forgotPassword': { paramsTuple?: []; params?: {} }
    'auth.resetPassword': { paramsTuple?: []; params?: {} }
    'auth.verifyEmail': { paramsTuple?: []; params?: {} }
    'auth.invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.resendVerification': { paramsTuple?: []; params?: {} }
    'me.changePassword': { paramsTuple?: []; params?: {} }
    'me.notifications.readAll': { paramsTuple?: []; params?: {} }
    'me.notifications.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organizations.store': { paramsTuple?: []; params?: {} }
    'org.logo.store': { paramsTuple?: []; params?: {} }
    'org.billing.checkout': { paramsTuple?: []; params?: {} }
    'org.billing.cancel': { paramsTuple?: []; params?: {} }
    'org.billing.resume': { paramsTuple?: []; params?: {} }
    'org.invitations.store': { paramsTuple?: []; params?: {} }
    'org.invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.store': { paramsTuple?: []; params?: {} }
    'org.employees.store': { paramsTuple?: []; params?: {} }
    'org.employees.import.preview': { paramsTuple?: []; params?: {} }
    'org.employees.import.commit': { paramsTuple?: []; params?: {} }
    'org.employees.export': { paramsTuple?: []; params?: {} }
    'org.employees.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.photo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.store': { paramsTuple?: []; params?: {} }
    'org.contracts.terminate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.document.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.store': { paramsTuple?: []; params?: {} }
    'org.leaves.store': { paramsTuple?: []; params?: {} }
    'org.leaves.balances.adjust': { paramsTuple?: []; params?: {} }
    'org.leaves.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.attachment.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.store': { paramsTuple?: []; params?: {} }
    'org.holidays.import': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.store': { paramsTuple?: []; params?: {} }
    'org.performance.cycles.open': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.cycles.close': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.plans.store': { paramsTuple?: []; params?: {} }
    'org.performance.goals.store': { paramsTuple?: []; params?: {} }
    'org.performance.goals.activities.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.store': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.suggest': { paramsTuple?: []; params?: {} }
    'org.performance.okrs.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.requestRevision': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.store': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.submitSelf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sendBack': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sign': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.aiSummary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.store': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.store': { paramsTuple?: []; params?: {} }
    'org.talents.succession.store': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.store': { paramsTuple?: []; params?: {} }
    'org.recruitment.jobs.publish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.close': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.duplicate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.social_posts.suggest': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.store': { paramsTuple?: []; params?: {} }
    'org.recruitment.candidates.stage': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.hire': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.notes.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.webhooks.ping': { paramsTuple?: []; params?: {} }
    'org.integrations.social_accounts.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.schedules.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.punch': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.export': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.store': { paramsTuple?: []; params?: {} }
    'org.employees.badge.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.scan': { paramsTuple?: []; params?: {} }
    'org.timeclock.sync': { paramsTuple?: []; params?: {} }
    'public.careers.jobs.apply.check': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.careers.jobs.apply': { paramsTuple: [ParamValue,ParamValue]; params: {'orgSlug': ParamValue,'jobSlug': ParamValue} }
    'public.demoRequests.store': { paramsTuple?: []; params?: {} }
    'public.payments.checkout': { paramsTuple?: []; params?: {} }
    'public.payments.claim': { paramsTuple: [ParamValue]; params: {'ref': ParamValue} }
    'webhooks.n8n.scoring': { paramsTuple?: []; params?: {} }
    'webhooks.djomy': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'platform.organizations.suspend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.store': { paramsTuple?: []; params?: {} }
    'platform.users.ban': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.unban': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.impersonate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.admins.store': { paramsTuple?: []; params?: {} }
    'platform.payments.reconcile': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'me.destroy': { paramsTuple?: []; params?: {} }
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.destroy': { paramsTuple?: []; params?: {} }
    'org.members.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.invitations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'docId': ParamValue} }
    'org.contracts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'activityId': ParamValue} }
    'org.performance.okrs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.achievements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.talents.succession.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.notes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'noteId': ParamValue} }
    'org.integrations.social_accounts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.schedules.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.admins.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
    'org.update': { paramsTuple?: []; params?: {} }
    'org.members.roles.update': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.departments.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.contracts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.skills.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.leaves.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.holidays.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.cycles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.progress': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.goals.activities.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'activityId': ParamValue} }
    'org.performance.okrs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.keyResults.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'krId': ParamValue} }
    'org.performance.reviews.self': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.manager': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.talent': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.talents.succession.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.recruitment.candidates.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.schedules.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.organizations.subscription.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.plans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.users.roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform.demoRequests.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'org.settings.update': { paramsTuple?: []; params?: {} }
    'org.employees.skills.replace': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.keyResults': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.talents.skillsMatrix.update': { paramsTuple?: []; params?: {} }
    'org.recruitment.webhooks.update': { paramsTuple?: []; params?: {} }
    'platform.settings.update': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}