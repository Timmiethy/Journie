import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../common/guards/auth.guard';
import { TranscribeService } from './transcribe.service';

@Controller('transcribe')
@UseGuards(AuthGuard)
export class TranscribeController {
  constructor(private transcribeService: TranscribeService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    return this.transcribeService.transcribe(file);
  }
}
