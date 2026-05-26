import { IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export enum PlaceCategoryFilter {
  temple = 'temple',
  museum = 'museum',
  nature = 'nature',
  market = 'market',
  beach = 'beach',
  mountain = 'mountain',
}

export class ListPlacesDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(PlaceCategoryFilter)
  category?: PlaceCategoryFilter;
}
