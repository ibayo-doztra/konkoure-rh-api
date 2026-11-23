import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
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
    'me.update': { paramsTuple?: []; params?: {} }
    'me.changePassword': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'org.performance.feedback.index': { paramsTuple?: []; params?: {} }
    'org.performance.feedback.store': { paramsTuple?: []; params?: {} }
    'org.performance.feedback.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.achievements.index': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.store': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.zones.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'openapi.html': { paramsTuple?: []; params?: {} }
    'openapi.json': { paramsTuple?: []; params?: {} }
    'openapi.yaml': { paramsTuple?: []; params?: {} }
    'auth.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
    'me.notifications.index': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
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
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.attendance.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.today': { paramsTuple?: []; params?: {} }
    'org.timeclock.badgeEvents': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'health.ready': { paramsTuple?: []; params?: {} }
    'openapi.html': { paramsTuple?: []; params?: {} }
    'openapi.json': { paramsTuple?: []; params?: {} }
    'openapi.yaml': { paramsTuple?: []; params?: {} }
    'auth.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
    'me.notifications.index': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
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
    'org.timeclock.zones.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.attendance.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.today': { paramsTuple?: []; params?: {} }
    'org.timeclock.badgeEvents': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.index': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'org.performance.okrs.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.requestRevision': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.checkins.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.store': { paramsTuple?: []; params?: {} }
    'org.performance.reviews.submitSelf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.validate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sendBack': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.reviews.sign': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.feedback.store': { paramsTuple?: []; params?: {} }
    'org.performance.achievements.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.zones.store': { paramsTuple?: []; params?: {} }
    'org.timeclock.punch': { paramsTuple?: []; params?: {} }
    'org.timeclock.logs.export': { paramsTuple?: []; params?: {} }
    'org.timeclock.devices.store': { paramsTuple?: []; params?: {} }
    'org.employees.badge.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.scan': { paramsTuple?: []; params?: {} }
    'org.timeclock.sync': { paramsTuple?: []; params?: {} }
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
    'org.timeclock.zones.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
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
    'org.timeclock.zones.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.timeclock.devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.badge.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'org.settings.update': { paramsTuple?: []; params?: {} }
    'org.employees.skills.replace': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.performance.okrs.keyResults': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}