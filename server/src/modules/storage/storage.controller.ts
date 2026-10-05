import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

const SAFE_FILE_RE = /^[A-Za-z0-9._-]+\.png$/;

@ApiTags('Файлы')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('slides/:presentationId/:file')
  @ApiOperation({ summary: 'PNG-слайд (только владелец презентации)' })
  async slide(
    @Param('presentationId') presentationId: string,
    @Param('file') file: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!SAFE_FILE_RE.test(file) || file.includes('..')) {
      throw new NotFoundException('Файл не найден');
    }
    const presentation = await this.prisma.presentation.findFirst({
      where: { id: presentationId, teacherId: user.id },
      select: { id: true },
    });
    if (!presentation) throw new NotFoundException('Файл не найден');

    const absPath = path.join(this.config.get<string>('storageDir')!, 'slides', presentationId, file);
    res.sendFile(absPath, { dotfiles: 'deny', maxAge: '1d' });
  }
}
