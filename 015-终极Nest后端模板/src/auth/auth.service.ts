import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
  private users = [
    { id: 1, username: 'admin', password: '123456', role: 'admin' },
    { id: 2, username: 'user', password: '123456', role: 'user' },
  ];
  constructor(private jwt: JwtService) {}
  login(username: string, password: string) {
    const u = this.users.find((x) => x.username === username && x.password === password);
    if (!u) throw new UnauthorizedException('Invalid credentials');
    return {
      access_token: this.jwt.sign({
        sub: u.id,
        username: u.username,
        role: u.role,
      }),
      user: { id: u.id, username: u.username, role: u.role },
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
