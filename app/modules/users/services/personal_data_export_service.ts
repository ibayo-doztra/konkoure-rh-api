import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Employee from '#models/employee'
import type LeaveBalanceLedgerEntry from '#models/leave_balance_ledger_entry'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import fileStorage from '#shared/files/file_storage'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import { newId } from '#shared/utils/crypto'
import users from '#modules/users/repositories/user_repository'
import memberships, { type MembershipRow } from '#modules/users/repositories/membership_repository'
import { personalDataIn } from '#modules/users/repositories/personal_data_repository'
import refreshTokens from '#modules/auth/repositories/refresh_token_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { skillsIn } from '#modules/hr/repositories/skill_repository'
import {
  contractDto,
  employeeDto,
  employeeSalaryDto,
  employeeSkillDto,
} from '#modules/hr/transformers/hr_transformer'
import { leaveBalanceDto, leaveDto } from '#modules/leaves/transformers/leave_transformer'
import { notificationDto } from '#modules/notifications/transformers/notification_transformer'
import {
  achievementDto,
  feedbackDto,
  goalDto,
  okrDto,
  reviewDto,
} from '#modules/performance/transformers/performance_transformer'
import {
  attendanceDayDto,
  badgeDto,
  timeLogDto,
} from '#modules/timeclock/transformers/timeclock_transformer'
import { sessionDto, userDto } from '#modules/users/transformers/me_transformer'
import { PersonalDataExportMail } from '#modules/users/mails/personal_data_export_mail'

/** The e-mailed link stays valid 24 hours (docs/backend/08 §9). */
const LINK_TTL_SECONDS = 24 * 3600

export interface PersonalDataExportJob {
  exportId: string
  userId: string
}

function ledgerDto(entry: LeaveBalanceLedgerEntry) {
  return {
    id: entry.id,
    year: entry.year,
    leaveType: entry.leaveType,
    deltaDays: Number(entry.deltaDays),
    reason: entry.reason,
    leaveRequestId: entry.leaveRequestId,
    createdAt: entry.createdAt.toISO(),
  }
}

/**
 * GDPR export of the current user (docs/backend/05 §13, 06 §2, decision of
 * 2026-11-26): `202 { jobId }`, then the worker writes a JSON archive to the
 * private space and e-mails a link valid 24 hours. The archive holds the
 * account and, for each organization, the linked employee record and its HR
 * data, as the employee reads them: no AI synthesis, no 9-box score, no
 * author of a private feedback received, no badge UID hash.
 */
export class PersonalDataExportService {
  /** 1 export per hour and user. */
  async request(user: User, audit: AuditContext) {
    await limiter.use({ requests: 1, duration: '1 hour' }).consume(`me-export:${user.id}`)
    const job: PersonalDataExportJob = { exportId: newId(), userId: user.id }
    await db.transaction((trx) =>
      auditService.record(
        trx,
        { ...audit, organizationId: null },
        {
          action: 'user.exported',
          targetType: 'user',
          targetId: user.id,
          after: { exportId: job.exportId },
        }
      )
    )
    try {
      await queueService.dispatch('users.export', job)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
    return { jobId: job.exportId }
  }

  /** Worker side: builds, stores and announces the archive. Returns the storage key. */
  async build(job: PersonalDataExportJob) {
    const user = await users.findById(job.userId)
    if (!user || !user.isActive) return null
    const archive = await this.archive(user)
    const key = `users/${user.id}/export/${job.exportId}.json`
    await fileStorage.put('private', key, {
      content: Buffer.from(JSON.stringify(archive, null, 2), 'utf8'),
      type: { mime: 'application/json', extension: 'json' },
    })
    const { url } = await fileStorage.signedUrl(key, LINK_TTL_SECONDS)
    await dispatchMail(new PersonalDataExportMail(user, { url }))
    return key
  }

  async archive(user: User) {
    const sessions = await refreshTokens.listSessions(user.id)
    const organizations = []
    for (const membership of await memberships.forUser(user.id)) {
      organizations.push(
        await withTenant(membership.id, (trx) => this.organization(trx, user, membership))
      )
    }
    return {
      exportedAt: DateTime.now().toUTC().toISO(),
      user: {
        ...userDto(user),
        emailVerifiedAt: user.emailVerifiedAt?.toUTC().toISO() ?? null,
        lastLoginAt: user.lastLoginAt?.toUTC().toISO() ?? null,
        createdAt: user.createdAt.toUTC().toISO(),
      },
      sessions: sessions.map((row) => sessionDto(row, null)),
      organizations,
    }
  }

  private async organization(trx: TransactionClientContract, user: User, row: MembershipRow) {
    const notifications = await personalDataIn(row.id, trx).notifications(user.id)
    const employee = await employeesIn(row.id, trx).findByUser(user.id)
    return {
      id: row.id,
      name: row.name,
      roles: row.roles,
      notifications: notifications.map(notificationDto),
      employee: employee ? await this.employee(trx, row.id, employee) : null,
    }
  }

  private async employee(
    trx: TransactionClientContract,
    organizationId: string,
    employee: Employee
  ) {
    const data = personalDataIn(organizationId, trx)
    const id = employee.id
    const contracts = await data.contracts(id)
    const skills = await skillsIn(organizationId, trx).ofEmployee(id)
    const leaveRequests = await data.leaveRequests(id)
    const leaveBalances = await data.leaveBalances(id)
    const leaveLedger = await data.leaveLedger(id)
    const timeLogs = await data.timeLogs(id)
    const attendanceDays = await data.attendanceDays(id)
    const badges = await data.badges(id)
    const reviews = await data.reviews(id)
    const goals = await data.goals(id)
    const okrs = await data.okrs(id)
    const keyResults = await data.keyResults(okrs.map((okr) => okr.id))
    const feedbacks = await data.feedbacks(id)
    const achievements = await data.achievements(id)
    return {
      profile: { ...employeeDto(employee, 'full'), ...employeeSalaryDto(employee) },
      contracts: contracts.map((row) => contractDto(row, 'full')),
      skills: skills.map(employeeSkillDto),
      leaveRequests: leaveRequests.map(leaveDto),
      leaveBalances: leaveBalances.map(leaveBalanceDto),
      leaveLedger: leaveLedger.map(ledgerDto),
      timeLogs: timeLogs.map(timeLogDto),
      attendanceDays: attendanceDays.map(attendanceDayDto),
      badges: badges.map(badgeDto),
      // As the evaluated employee reads them; goals are exported on their own.
      reviews: reviews.map((review) => {
        const { goals: unused, ...dto } = reviewDto({ review, goals: [], comments: [] }, true)
        void unused
        return dto
      }),
      goals: goals.map(goalDto),
      okrs: okrs.map((okr) =>
        okrDto(
          okr,
          keyResults.filter((row) => row.okrId === okr.id)
        )
      ),
      feedbackReceived: feedbacks
        .filter((row) => row.toEmployeeId === id)
        .map((row) => feedbackDto(row, false)),
      feedbackGiven: feedbacks
        .filter((row) => row.fromEmployeeId === id)
        .map((row) => feedbackDto(row, true)),
      achievements: achievements.map(achievementDto),
    }
  }
}

export default new PersonalDataExportService()
