import { Module } from '@nestjs/common';
import { InvoiceItemController } from './invoiceItem.controller';
import { InvoiceItemService } from './invoiceItem.service';
@Module({
  controllers: [InvoiceItemController],
  providers: [InvoiceItemService],
})
export class InvoiceItemModule {}
