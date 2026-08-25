import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity()
export class Product {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column('text', { nullable: true }) description: string;
  @CreateDateColumn() createdAt: Date;
}
