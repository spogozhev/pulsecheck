import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { VoteService } from './vote.service';
import { SubmitAnswerDto } from './dto/vote.dto';

@ApiTags('Голосование (публичное)')
@Controller('vote')
@Public()
export class VoteController {
  constructor(private readonly vote: VoteService) {}

  @Get(':code/:slide')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Данные вопроса по QR-ссылке /v/{code}/{slide}' })
  async payload(
    @Param('code') code: string,
    @Param('slide', ParseIntPipe) slide: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.vote.payload(code, slide, req, res);
  }

  @Post(':code/:slide/answer')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Отправить/обновить ответ (анонимно)' })
  async submit(
    @Param('code') code: string,
    @Param('slide', ParseIntPipe) slide: number,
    @Body() dto: SubmitAnswerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.vote.submit(code, slide, dto, req, res);
  }

  @Get(':code/:slide/results')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Итоги вопроса (только после закрытия голосования)' })
  async results(@Param('code') code: string, @Param('slide', ParseIntPipe) slide: number) {
    return this.vote.results(code, slide);
  }
}
