import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PollOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;
}

export class SavePollDto {
  @IsString()
  @MinLength(3)
  @MaxLength(600)
  questionText!: string;

  @IsIn(['single', 'multiple', 'ranking'])
  type!: 'single' | 'multiple' | 'ranking';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Ограничение времени на прохождение в секундах (5–3600); null/undefined — без ограничения */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  timeLimitSeconds?: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options!: PollOptionDto[];
}
