import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface IssuedSession {
  token: string;
  user: { id: string; email: string; name: string; role: string; status: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: 'teacher',
        status: 'pending', // требует подтверждения администратором
        passwordHash: await bcrypt.hash(dto.password, 12),
        salt: randomBytes(16).toString('hex'),
      },
    });
    return this.issue(user.id, user.email, user.name, user.role, user.status);
  }

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (user.status === 'blocked') {
      throw new ForbiddenException('Аккаунт заблокирован администратором');
    }
    return this.issue(user.id, user.email, user.name, user.role, user.status);
  }

  private async issue(
    id: string,
    email: string,
    name: string,
    role: string,
    status: string,
  ): Promise<IssuedSession> {
    const token = await this.jwtService.signAsync({ sub: id, role });
    return { token, user: { id, email, name, role, status } };
  }
}
