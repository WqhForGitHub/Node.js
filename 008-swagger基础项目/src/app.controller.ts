import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CreateTaskDto } from './dto/create-task.dto';
@ApiTags('tasks')
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('tasks')
  @ApiOperation({ summary: 'List all tasks' })
  findAll() {
    return this.app.findAll();
  }
  @Post('tasks')
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() dto: CreateTaskDto) {
    return this.app.create(dto);
  }
}
