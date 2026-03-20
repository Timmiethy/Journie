import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user';
import { PersonaService } from './persona.service';
import { CreatePersonaDto } from './dto/create-persona.dto';

@Controller('persona')
@UseGuards(AuthGuard)
export class PersonaController {
  constructor(private personaService: PersonaService) {}

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreatePersonaDto) {
    return this.personaService.upsert(user.id, dto);
  }

  @Get()
  async get(@CurrentUser() user: { id: string }) {
    return this.personaService.findByUserId(user.id);
  }
}
