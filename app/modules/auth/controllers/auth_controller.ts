import type { HttpContext } from '@adonisjs/core/http'
import authService from '#modules/auth/services/auth_service'
import tokenService, { type IssuedTokens } from '#modules/auth/services/token_service'
import passwordService from '#modules/auth/services/password_service'
import emailVerification from '#modules/auth/services/email_verification_service'
import meService from '#modules/users/services/me_service'
import { AppException } from '#shared/exceptions/app_exception'
import { loginOrganizationDto, userDto } from '#modules/users/transformers/me_transformer'
import {
  forgotPasswordValidator,
  loginValidator,
  refreshValidator,
  registerValidator,
  resetPasswordValidator,
  verifyEmailValidator,
} from '#modules/auth/validators/auth_validator'
import {
  auditContext,
  clearRefreshCookie,
  clientInfo,
  currentFamilyId,
  readRefreshCookie,
  setRefreshCookie,
} from '#modules/auth/http_helpers'
import type User from '#models/user'

/** `/api/v1/auth/*` (06-api-reference §1). HTTP concerns only. */
export default class AuthController {
  async register(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(registerValidator)
    const { user, tokens } = await authService.register(input, clientInfo(ctx))
    setRefreshCookie(ctx, tokens)
    ctx.response.status(201)
    return ctx.serialize(await this.sessionPayload(user, tokens))
  }

  async login(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(loginValidator)
    const { user, tokens } = await authService.login(
      input.email,
      input.password,
      clientInfo(ctx, input.deviceLabel),
      auditContext(ctx)
    )
    setRefreshCookie(ctx, tokens)
    return ctx.serialize(await this.sessionPayload(user, tokens))
  }

  async refresh(ctx: HttpContext) {
    const { refreshToken } = await ctx.request.validateUsing(refreshValidator)
    const presented = refreshToken ?? readRefreshCookie(ctx)
    if (!presented) throw new AppException('E_UNAUTHORIZED')
    try {
      const tokens = await tokenService.rotate(presented, clientInfo(ctx), auditContext(ctx))
      setRefreshCookie(ctx, tokens)
      return ctx.serialize(tokens)
    } catch (error) {
      if (error instanceof AppException && error.errorCode === 'E_UNAUTHORIZED') {
        clearRefreshCookie(ctx)
      }
      throw error
    }
  }

  async logout(ctx: HttpContext) {
    await authService.logout(ctx.auth.getUserOrFail(), currentFamilyId(ctx), auditContext(ctx))
    clearRefreshCookie(ctx)
    return ctx.response.noContent()
  }

  async logoutAll(ctx: HttpContext) {
    await authService.logoutAll(ctx.auth.getUserOrFail(), auditContext(ctx))
    clearRefreshCookie(ctx)
    return ctx.response.noContent()
  }

  async forgotPassword(ctx: HttpContext) {
    const { email } = await ctx.request.validateUsing(forgotPasswordValidator)
    await passwordService.forgot(email)
    return ctx.response.noContent()
  }

  async resetPassword(ctx: HttpContext) {
    const { token, password } = await ctx.request.validateUsing(resetPasswordValidator)
    await passwordService.reset(token, password, auditContext(ctx))
    clearRefreshCookie(ctx)
    return ctx.response.noContent()
  }

  async verifyEmail(ctx: HttpContext) {
    const { token } = await ctx.request.validateUsing(verifyEmailValidator)
    await emailVerification.verify(token)
    return ctx.response.noContent()
  }

  async resendVerification(ctx: HttpContext) {
    await emailVerification.resend(ctx.auth.getUserOrFail())
    return ctx.response.noContent()
  }

  private async sessionPayload(user: User, tokens: IssuedTokens) {
    const organizations = await meService.organizations(user)
    return {
      user: userDto(user),
      ...tokens,
      organizations: organizations.map(loginOrganizationDto),
    }
  }
}
