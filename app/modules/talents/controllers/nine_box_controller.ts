import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import TalentPolicy from '#policies/talent_policy'
import nineBoxService from '#modules/talents/services/nine_box_service'
import { nineBoxDto } from '#modules/talents/transformers/talent_transformer'
import { nineBoxValidator } from '#modules/talents/validators/talent_validator'

/** `GET /api/v1/org/talents/9box` (07 §5.10, decision of 2026-11-24). */
export default class NineBoxController {
  @ApiOperation({ summary: '9-box of a performance cycle' })
  async show(ctx: HttpContext) {
    const { cycleId } = await ctx.request.validateUsing(nineBoxValidator)
    await ctx.bouncer.with(TalentPolicy).authorize('view')
    const box = await nineBoxService.show(ctx.tenant, cycleId)
    return ctx.serialize(nineBoxDto(box))
  }
}
