import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TELEMEDICINE_ROLES, TelemedicineRole } from '../telemedicine.types';

export class TelemedicineParticipantDto {
  @IsString() userId: string;
  @IsOptional() @IsString() displayName?: string;
  @IsIn(TELEMEDICINE_ROLES) role: TelemedicineRole;
}

export class CreateConsultationDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsISO8601() scheduledAt?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => TelemedicineParticipantDto)
  participants: TelemedicineParticipantDto[];

  @IsOptional() @IsInt() @Min(2) @Max(32) maxParticipants?: number;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class AddConsultationParticipantDto extends TelemedicineParticipantDto {}
