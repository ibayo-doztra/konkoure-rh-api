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
    'organizations.store': { paramsTuple?: []; params?: {} }
    'org.show': { paramsTuple?: []; params?: {} }
    'org.update': { paramsTuple?: []; params?: {} }
    'org.destroy': { paramsTuple?: []; params?: {} }
    'org.settings.update': { paramsTuple?: []; params?: {} }
    'org.logo.store': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
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
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
    'org.members.index': { paramsTuple?: []; params?: {} }
    'org.invitations.index': { paramsTuple?: []; params?: {} }
    'org.departments.index': { paramsTuple?: []; params?: {} }
    'org.departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.employees': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.index': { paramsTuple?: []; params?: {} }
    'org.employees.managers': { paramsTuple?: []; params?: {} }
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'org.show': { paramsTuple?: []; params?: {} }
    'org.entitlements.show': { paramsTuple?: []; params?: {} }
    'org.members.index': { paramsTuple?: []; params?: {} }
    'org.invitations.index': { paramsTuple?: []; params?: {} }
    'org.departments.index': { paramsTuple?: []; params?: {} }
    'org.departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.employees': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.index': { paramsTuple?: []; params?: {} }
    'org.employees.managers': { paramsTuple?: []; params?: {} }
    'org.employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.salary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.team': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'organizations.store': { paramsTuple?: []; params?: {} }
    'org.logo.store': { paramsTuple?: []; params?: {} }
    'org.invitations.store': { paramsTuple?: []; params?: {} }
    'org.invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.store': { paramsTuple?: []; params?: {} }
    'org.employees.store': { paramsTuple?: []; params?: {} }
    'org.employees.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
    'org.update': { paramsTuple?: []; params?: {} }
    'org.members.roles.update': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.departments.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.destroy': { paramsTuple?: []; params?: {} }
    'org.members.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'org.invitations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.departments.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'org.employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'org.settings.update': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}