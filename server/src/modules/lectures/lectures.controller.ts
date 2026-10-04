import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { LecturesService } from './lectures.service';
import { ListLecturesDto, SetSlideDto, StartLectureDto } from './dto/lecture.dto';

@ApiTags('Лекции и сессии')
@ApiBearerAuth()
@Controller('lectures')
export class LecturesController {
  constructor(
    private readonly lectures: LecturesService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Запустить новую сессию лекции по презентации' })
  async start(@Body() dto: StartLectureDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const lecture = await this.lectures.start(dto, user);
    void this.audit.log(req, 'lecture.start', {
      entityType: 'lecture',
      entityId: lecture.id,
      meta: { presentationId: dto.presentationId },
    });
    return lecture;
  }

  @Get()
  @ApiOperation({ summary: 'История лекций (фильтры: from, to, course, status)' })
  async list(@Query() dto: ListLecturesDto, @CurrentUser() user: AuthUser) {
    return this.lectures.list(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Лекция с аналитикой' })
  async analytics(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.lectures.analytics(id, user);
  }

  @Get(':id/state')
  @ApiOperation({ summary: 'Состояние сессии для presenter view (поллинг)' })
  async state(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.lectures.state(id, user);
  }

  @Patch(':id/slide')
  @ApiOperation({ summary: 'Переключить слайд (закрывает голосование на предыдущем)' })
  async setSlide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSlideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lectures.setSlide(id, dto.index, user);
  }

  @Post(':id/reveal')
  @ApiOperation({ summary: 'Преподаватель показал итоги предыдущего вопроса («Продолжить показ»)' })
  async reveal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.lectures.revealResults(id, user);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Завершить лекцию' })
  async finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const result = await this.lectures.finish(id, user);
    void this.audit.log(req, 'lecture.finish', { entityType: 'lecture', entityId: id });
    return result;
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Результаты опроса (query: pollId) в рамках лекции' })
  async results(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('pollId') pollId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lectures.pollResults(id, pollId, user);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Полная аналитика по лекции' })
  async analyticsAlias(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.lectures.analytics(id, user);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Экспорт данных лекции (query: format=csv|json)' })
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (format === 'csv') {
      const csv = await this.lectures.exportCsv(id, user);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lecture-${id}.csv"`);
      res.send(csv);
      return;
    }
    const json = await this.lectures.exportJson(id, user);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lecture-${id}.json"`);
    res.json(json);
  }
}
