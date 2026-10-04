import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PresentationsService } from './presentations.service';
import { PortableService } from './portable.service';

class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  /** Курс/дисциплина — тег; пустая строка очищает значение */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  course?: string;
}

class PresentationFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  course?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@ApiTags('Презентации')
@ApiBearerAuth()
@Controller('presentations')
export class PresentationsController {
  constructor(
    private readonly presentations: PresentationsService,
    private readonly portable: PortableService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Загрузка PDF/PPTX (multipart, поле file); запускает конвертацию в слайды' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title: unknown,
    @Body('course') course: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const presentation = await this.presentations.create(
      file,
      typeof title === 'string' ? title : undefined,
      user,
      typeof course === 'string' ? course : undefined,
    );
    void this.audit.log(req, 'presentation.upload', {
      entityType: 'presentation',
      entityId: presentation.id,
      meta: { sourceType: presentation.sourceType },
    });
    return presentation;
  }

  @Get()
  @ApiOperation({ summary: 'Список презентаций (фильтры: course — точный тег, search — по названию/курсу)' })
  async list(@Query() filters: PresentationFilterDto, @CurrentUser() user: AuthUser) {
    return this.presentations.list(user, filters);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Различные курсы/дисциплины преподавателя (теги для фильтрации)' })
  async tags(@CurrentUser() user: AuthUser) {
    return this.presentations.listTags(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Презентация со слайдами и опросами' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.presentations.getOwned(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить свойства: название и/или курс-дисциплину (пустой course очищает)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePresentationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.presentations.updateProperties(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление (запрещено, если есть лекции по презентации)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.presentations.remove(id, user);
    void this.audit.log(req, 'presentation.delete', { entityType: 'presentation', entityId: id });
    return { ok: true };
  }

  @Post('import')
  @ApiOperation({ summary: 'Импорт презентации из portable-архива PulseCheck (.zip)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  async importZip(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const presentation = await this.portable.importZip(
      file,
      typeof title === 'string' ? title : undefined,
      user,
    );
    void this.audit.log(req, 'presentation.import', {
      entityType: 'presentation',
      entityId: presentation.id,
    });
    return presentation;
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Экспорт презентации в portable-архив (.zip): слайды, опросы, оригинал' })
  async exportZip(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.portable.exportZip(id, user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.send(buffer);
  }

  @Get(':id/original')
  @ApiOperation({ summary: 'Скачать оригинальный файл' })
  async original(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { absPath, downloadName } = await this.presentations.originalAbsolutePath(id, user);
    res.download(absPath, downloadName);
  }
}
