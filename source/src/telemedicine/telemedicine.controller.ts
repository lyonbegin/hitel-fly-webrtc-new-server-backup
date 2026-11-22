import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HttpJwtGuard } from '../auth/http-jwt.guard';
import { AuthClaims } from '../common/types';
import { TelemedicineService } from './telemedicine.service';
import { AddConsultationParticipantDto, CreateConsultationDto } from './dto/telemedicine.dto';

@UseGuards(HttpJwtGuard)
@Controller('telemedicine/consultations')
export class TelemedicineController {
  constructor(private readonly telemedicine: TelemedicineService) {}

  @Post()
  create(@Body() dto: CreateConsultationDto, @Req() req: any) {
    return this.telemedicine.create(dto, req.auth as AuthClaims);
  }

  @Get('me')
  listMine(@Req() req: any) {
    return this.telemedicine.listForUser((req.auth as AuthClaims).sub);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.telemedicine.get(id, (req.auth as AuthClaims).sub);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Req() req: any) {
    return this.telemedicine.start(id, (req.auth as AuthClaims).sub);
  }

  @Post(':id/end')
  end(@Param('id') id: string, @Req() req: any) {
    return this.telemedicine.end(id, (req.auth as AuthClaims).sub);
  }

  @Post(':id/participants')
  addParticipant(@Param('id') id: string, @Body() dto: AddConsultationParticipantDto, @Req() req: any) {
    return this.telemedicine.addParticipant(id, dto, (req.auth as AuthClaims).sub);
  }

  @Delete(':id/participants/:userId')
  removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @Req() req: any) {
    return this.telemedicine.removeParticipant(id, userId, (req.auth as AuthClaims).sub);
  }
}
