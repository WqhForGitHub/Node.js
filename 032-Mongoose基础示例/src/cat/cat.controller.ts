import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CatService } from './cat.service';
@Controller('cats')
export class CatController {
  constructor(private readonly service: CatService) {}
  @Post() create(@Body() dto: any) {
    return this.service.create(dto);
  }
  @Get() findAll() {
    return this.service.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
