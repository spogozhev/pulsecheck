import { Module } from '@nestjs/common';
import { MailModule } from '../../shared/mail.module';
import { ProfileController, PasswordRecoveryController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [MailModule],
  controllers: [ProfileController, PasswordRecoveryController],
  providers: [ProfileService],
})
export class ProfileModule {}
