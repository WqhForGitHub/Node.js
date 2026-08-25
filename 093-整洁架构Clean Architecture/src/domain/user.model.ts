export interface User {
  id: number;
  name: string;
}
export abstract class UserRepository {
  abstract findAll(): User[];
  abstract create(name: string): User;
}
