import { Body, Controller, Delete, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PollsService } from './polls.service';
import { SavePollDto } from './dto/poll.dto';

@ApiTags('Опросы')
@ApiBearerAuth()
@Controller('presentations/:presentationId/slides/:slideId/poll')
export class PollsController {
  constructor(
    private readonly polls: PollsService,
    private readonly audit: AuditService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'Создать/обновить опрос на слайде (типы: single, multiple, ranking)' })
  async save(
    @Param('presentationId') presentationId: string,
    @Param('slideId') slideId: string,
    @Body() dto: SavePollDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const poll = await this.polls.save(presentationId, slideId, dto, user);
    void this.audit.log(req, 'poll.save', { entityType: 'poll', entityId: poll.id });
    return poll;
  }

  @Delete()
  @ApiOperation({ summary: 'Удалить опрос со слайда' })
  async remove(
    @Param('presentationId') presentationId: string,
    @Param('slideId') slideId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.polls.remove(presentationId, slideId, user);
    void this.audit.log(req, 'poll.delete', { entityType: 'slide', entityId: slideId });
    return result;
  }
}
