export abstract class UserPort {
  abstract findAll(): any[];
  abstract create(name: string): any;
}
