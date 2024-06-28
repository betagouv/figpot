import { ListType } from '@figpot/src/features/translators/text/paragraph/ListType';

export class UnorderedListType implements ListType {
  public getCurrentSymbol(_number: number, _indentation: number): string {
    return ' •  ';
  }
}
