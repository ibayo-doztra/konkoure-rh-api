import logger from '@adonisjs/core/services/logger'
import DemoRequest from '#models/demo_request'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import platformAdmins from '#modules/users/repositories/platform_admin_repository'
import { DemoRequestMail } from '#modules/platform/mails/demo_request_mail'

export type DemoRequestStatus = DemoRequest['status']

export interface DemoRequestInput {
  fullName: string
  email: string
  phone: string
  companyName: string
  companySize: string
  message?: string
}

/** Demo requests (06 §11 and §13, 08 §4 `demo_request`), outside any tenant. */
export class DemoRequestService {
  /**
   * `POST /public/demo-requests`: stored, then the sales team is e-mailed
   * after the commit (address `DEMO_REQUESTS_EMAIL`; none set: logged only).
   */
  async create(input: DemoRequestInput, sourceIp: string | null) {
    const request = await DemoRequest.create({ ...input, message: input.message ?? null, sourceIp })
    const to = env.get('DEMO_REQUESTS_EMAIL')
    if (to) {
      await dispatchMail(new DemoRequestMail(to, request))
    } else {
      logger.warn({ demoRequestId: request.id }, 'demo_request.no_recipient')
    }
    return request
  }

  list(filters: { page: number; perPage: number; status?: DemoRequestStatus }) {
    const query = DemoRequest.query()
    if (filters.status) query.where('status', filters.status)
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
  }

  /** `PATCH /platform/demo-requests/:id` (support): status and assignee, an active admin. */
  async update(
    actor: User,
    id: string,
    input: { status?: DemoRequestStatus; assignedTo?: string | null },
    audit: AuditContext
  ) {
    if (input.assignedTo && !(await platformAdmins.isActive(input.assignedTo))) {
      throw AppException.validation('assignedTo', 'exists', 'validation.platform.assignee')
    }
    return db.transaction(async (trx) => {
      const request = await DemoRequest.query({ client: trx }).where('id', id).forUpdate().first()
      if (!request) throw new AppException('E_NOT_FOUND')
      const before = { status: request.status, assignedTo: request.assignedTo }
      if (input.status !== undefined) request.status = input.status
      if (input.assignedTo !== undefined) request.assignedTo = input.assignedTo
      await request.useTransaction(trx).save()
      await auditService.record(
        trx,
        { ...audit, actorUserId: actor.id, actorRole: 'platform_support' },
        {
          action: 'demo_request.updated',
          targetType: 'demo_request',
          targetId: id,
          before,
          after: { status: request.status, assignedTo: request.assignedTo },
        }
      )
      return request
    })
  }
}

export default new DemoRequestService()
