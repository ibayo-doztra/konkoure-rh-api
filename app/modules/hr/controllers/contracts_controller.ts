import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import ContractPolicy from '#policies/contract_policy'
import contractService from '#modules/hr/services/contract_service'
import { contractDto, pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import {
  contractIdValidator,
  createContractValidator,
  listContractsValidator,
  terminateContractValidator,
  updateContractValidator,
} from '#modules/hr/validators/contract_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org/contracts` (06-api-reference §5). */
export default class ContractsController {
  @ApiOperation({ summary: 'List the contracts visible to the caller' })
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listContractsValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('list')
    const { rows, meta } = await contractService.list(ctx.tenant, query, auditContext(ctx))
    return {
      data: rows.map((row) => contractDto(row.contract, row.visibility)),
      meta: pageMetaDto(meta),
    }
  }

  @ApiOperation({ summary: 'Contract detail' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(contractIdValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('manage')
    const contract = await contractService.show(ctx.tenant, params.id, auditContext(ctx))
    return ctx.serialize(contractDto(contract, 'full'))
  }

  @ApiOperation({ summary: 'Create a contract' })
  @ApiBody({ type: () => createContractValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createContractValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('manage')
    const contract = await contractService.create(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    return ctx.serialize(contractDto(contract, 'full'))
  }

  @ApiOperation({ summary: 'Update a contract' })
  @ApiBody({ type: () => updateContractValidator })
  async update(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(updateContractValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('manage')
    const contract = await contractService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(contractDto(contract, 'full'))
  }

  @ApiOperation({ summary: 'Delete a contract (soft delete)' })
  async destroy(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(contractIdValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('manage')
    await contractService.remove(ctx.tenant, ctx.auth.getUserOrFail(), params.id, auditContext(ctx))
    return ctx.response.noContent()
  }

  @ApiOperation({ summary: 'Terminate an active or suspended contract' })
  @ApiBody({ type: () => terminateContractValidator })
  async terminate(ctx: HttpContext) {
    const { params, ...input } = await ctx.request.validateUsing(terminateContractValidator)
    await ctx.bouncer.with(ContractPolicy).authorize('manage')
    const contract = await contractService.terminate(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      params.id,
      input,
      auditContext(ctx)
    )
    return ctx.serialize(contractDto(contract, 'full'))
  }

  @ApiOperation({ summary: 'Signed link to the contract document (audited)' })
  async document(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(contractIdValidator)
    const contract = await contractService.find(ctx.tenant, params.id)
    await ctx.bouncer.with(ContractPolicy).authorize('viewDocument', contract)
    return ctx.serialize(await contractService.documentUrl(ctx.tenant, contract, auditContext(ctx)))
  }
}
