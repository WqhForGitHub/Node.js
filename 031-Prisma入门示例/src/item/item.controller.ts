import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ItemService } from './item.service';
@Controller('items')
export class ItemController {
  constructor(private readonly service: ItemService) {}
  @Post() create(@Body() dto: any) {
    return this.service.create(dto);
  }
  @Get() findAll() {
    return this.service.findAll();
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
