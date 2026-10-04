import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
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

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options!: PollOptionDto[];
}
