import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartLectureDto {
  @IsUUID()
  presentationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  course?: string;

  @IsOptional()
  @IsBoolean()
  linkAnswers?: boolean;
}

export class SetSlideDto {
  @IsInt()
  @Min(0)
  index!: number;
}

export class ListLecturesDto {
  @IsOptional()
  @IsString()
  from?: string; // ISO-дата

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  course?: string;

  @IsOptional()
  @IsIn(['active', 'finished'])
  status?: string;
}
