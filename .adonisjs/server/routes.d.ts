import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'auth.forgotPassword': { paramsTuple?: []; params?: {} }
    'auth.resetPassword': { paramsTuple?: []; params?: {} }
    'auth.verifyEmail': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.resendVerification': { paramsTuple?: []; params?: {} }
    'me.show': { paramsTuple?: []; params?: {} }
    'me.update': { paramsTuple?: []; params?: {} }
    'me.changePassword': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.organizations': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'me.show': { paramsTuple?: []; params?: {} }
    'me.sessions': { paramsTuple?: []; params?: {} }
    'me.organizations': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'auth.forgotPassword': { paramsTuple?: []; params?: {} }
    'auth.resetPassword': { paramsTuple?: []; params?: {} }
    'auth.verifyEmail': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.logoutAll': { paramsTuple?: []; params?: {} }
    'auth.resendVerification': { paramsTuple?: []; params?: {} }
    'me.changePassword': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'me.revokeSession': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}