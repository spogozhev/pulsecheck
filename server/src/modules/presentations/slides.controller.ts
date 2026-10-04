import { Body, Controller, Delete, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SlidesService } from './slides.service';

export class AddGeneratedSlideDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  afterIndex?: number;
}

export class CopySlidesRequestDto {
  @IsArray()
  @IsUUID('4', { each: true })
  slideIds!: string[];

  @IsUUID()
  targetPresentationId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  insertAfterIndex?: number;
}

@ApiTags('Слайды')
@ApiBearerAuth()
@Controller()
export class SlidesController {
  constructor(
    private readonly slides: SlidesService,
    private readonly audit: AuditService,
  ) {}

  @Post('presentations/:presentationId/slides')
  @ApiOperation({ summary: 'Добавить слайд-вопрос (генерируемый, без изображения) после afterIndex' })
  async addGenerated(
    @Param('presentationId') presentationId: string,
    @Body() dto: AddGeneratedSlideDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const slide = await this.slides.addGenerated(presentationId, dto.afterIndex, user);
    void this.audit.log(req, 'slide.create', {
      entityType: 'slide',
      entityId: slide.id,
      meta: { presentationId },
    });
    return slide;
  }

  @Delete('presentations/:presentationId/slides/:slideId')
  @ApiOperation({ summary: 'Удалить слайд (индексы последующих сдвигаются)' })
  async remove(
    @Param('presentationId') presentationId: string,
    @Param('slideId') slideId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.slides.remove(presentationId, slideId, user);
    void this.audit.log(req, 'slide.delete', {
      entityType: 'slide',
      entityId: slideId,
      meta: { presentationId },
    });
    return result;
  }

  @Post('slides/copy')
  @ApiOperation({ summary: 'Копировать слайды (с опросами) в другую презентацию' })
  async copy(@Body() dto: CopySlidesRequestDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const result = await this.slides.copy(
      { slideIds: dto.slideIds, targetPresentationId: dto.targetPresentationId, insertAfterIndex: dto.insertAfterIndex },
      user,
    );
    void this.audit.log(req, 'slides.copy', {
      entityType: 'presentation',
      entityId: dto.targetPresentationId,
      meta: { count: result.copied, sourceSlides: dto.slideIds },
    });
    return result;
  }
}
