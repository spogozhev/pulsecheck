import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      useFactory: (config: ConfigService) => new MailService(config),
      inject: [ConfigService],
    },
  ],
  exports: [MailService],
})
export class MailModule {}
