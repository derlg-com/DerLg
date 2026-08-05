import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, PublicUser } from '../auth/interfaces/auth.interface';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ResponseMessage('Profile retrieved')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const profile = await this.authService.getProfile(current.id);
    if (!profile) {
      throw new NotFoundException('Your profile could not be found.');
    }
    return profile;
  }
}
