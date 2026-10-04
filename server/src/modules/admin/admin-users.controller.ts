import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export class SetStatusDto {
  @IsIn(['approved', 'blocked'])
  status!: 'approved' | 'blocked';
}

@ApiTags('Администрирование')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список пользователей (фильтр: status=pending|approved|blocked)' })
  async list(@Query('status') status?: string) {
    const users = await this.prisma.user.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { presentations: true, lectures: true } },
      },
    });
    return users;
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Подтвердить пользователя (pending/blocked -> approved)' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Req() req: Request,
  ) {
    return this.setStatus(id, 'approved', admin, req);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Заблокировать пользователя (approved/blocked -> blocked)' })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Req() req: Request,
  ) {
    if (id === admin.id) {
      throw new NotFoundException('Нельзя заблокировать самого себя');
    }
    return this.setStatus(id, 'blocked', admin, req);
  }

  private async setStatus(id: string, status: 'approved' | 'blocked', admin: AuthUser, req: Request) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    void this.audit.log(req, `user.${status === 'approved' ? 'approve' : 'block'}`, {
      entityType: 'user',
      entityId: id,
      meta: { email: user.email },
    });
    return updated;
  }
}
