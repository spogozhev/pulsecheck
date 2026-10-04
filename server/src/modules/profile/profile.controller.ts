import { Body, Controller, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuditService } from '../audit/audit.service';
import { ProfileService } from './profile.service';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  /** Требуется при смене email */
  @IsOptional()
  @IsString()
  currentPassword?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

@ApiTags('Профиль')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly audit: AuditService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'Обновить профиль: имя и/или email (email — с текущим паролем)' })
  async update(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const updated = await this.profile.updateProfile(user, dto);
    void this.audit.log(req, 'profile.update', {
      entityType: 'user',
      entityId: user.id,
      meta: { nameChanged: dto.name !== undefined, emailChanged: dto.email !== undefined },
    });
    return updated;
  }

  @Post('password')
  @ApiOperation({ summary: 'Сменить пароль (текущий + новый)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.profile.changePassword(user, dto.currentPassword, dto.newPassword);
    void this.audit.log(req, 'profile.password', { entityType: 'user', entityId: user.id });
    return { ok: true };
  }
}

@ApiTags('Восстановление пароля')
@Controller('auth/password')
export class PasswordRecoveryController {
  constructor(
    private readonly profile: ProfileService,
    private readonly audit: AuditService,
  ) {}

  @Post('forgot')
  @Public()
  @ApiOperation({ summary: 'Запросить восстановление пароля (письмо со ссылкой)' })
  async forgot(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const result = await this.profile.requestPasswordReset(dto.email);
    void this.audit.log(req, 'password.forgot', { meta: { email: dto.email } });
    return { ok: true, ...result };
  }

  @Post('reset')
  @Public()
  @ApiOperation({ summary: 'Установить новый пароль по токену из письма' })
  async reset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.profile.resetPassword(dto.token, dto.newPassword);
    void this.audit.log(req, 'password.reset');
    return { ok: true };
  }
}
