import { HttpException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import config from 'config';
import jwt from 'jsonwebtoken';

import { UserService } from '../../core/user/user.service';

import { ReqHelper } from '../helpers/req.helper';

import { IJwtPayload } from '../../oauth/interface/jwt-payload.iterface';

const secretJWTKey = config.get<IJwtSettings>('JWT_SETTINGS').secretKey;
const authBypass = config.get<IAuthBypass[]>('AUTH_BYPASS');

@Injectable()
export class AuthMiddleware extends ReqHelper implements NestMiddleware {
  constructor(private readonly userService: UserService) {
    super();
  }

  public async use(req: Request, _res: Response, next: NextFunction) {
    // tslint:disable-next-line: no-unsafe-any
    const token: string = req.headers.authorization || req.cookies.JWT;

    if (token) {
      let payload: IJwtPayload;

      // tslint:disable-next-line: try-catch-first
      try {
        payload = jwt.verify(token, secretJWTKey) as IJwtPayload;
      } catch (e) {
        throw new HttpException('Invalid JWT token', 400);
      }

      const user = await this.userService.findOne(payload.id, { relations: ['permissions'] });

      if (user) {
        req.user = user;

        return next();
      }
    }

    if (this.checkAuthBypass(req)) {
      return next();
    }

    throw new UnauthorizedException();
  }

  private checkAuthBypass(req: Request) {
    const currentAction = this.getUrl(req).split('/')[1];
    const bypass = authBypass.filter(obj => obj.action === currentAction);

    if (bypass.length) {
      return true;
    }

    return false;
  }
}
