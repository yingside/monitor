import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AdminService } from "src/admin/admin.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly adminService: AdminService) {
    super({
      // 表示从header中Authorization属性中获取Bearer的token值
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 表示不忽视token过去的情况，过期会返回401
      ignoreExpiration: false,
      secretOrKey: "MySecret"
    });
  }

  async validate(payload: any) {
    const user = await this.adminService.validateUser(payload.username, payload.password);
    return user;
  }
}
