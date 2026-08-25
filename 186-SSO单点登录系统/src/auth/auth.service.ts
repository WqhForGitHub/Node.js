import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
  private users: any[] = [];
  private id = 0;
  constructor(private jwt: JwtService) {}
  register(username: string, password: string) {
    const exists = this.users.find((u) => u.username === username);
    if (exists) throw new UnauthorizedException('User exists');
    const user = { id: ++this.id, username, password, role: 'user' };
    this.users.push(user);
    return this.login(username, password);
  }
  login(username: string, password: string) {
    const user = this.users.find((u) => u.username === username && u.password === password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return {
      access_token: this.jwt.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
      }),
    };
  }
  verify(token: string) {
    try {
      return this.jwt.verify(token);
    } catch (_e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
