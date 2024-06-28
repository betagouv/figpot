import { TypePropertiesTrait } from '@figpot/src/clients/figma';
import { ListType } from '@figpot/src/features/translators/text/paragraph/ListType';
import { OrderedListType } from '@figpot/src/features/translators/text/paragraph/OrderedListType';
import { UnorderedListType } from '@figpot/src/features/translators/text/paragraph/UnorderedListType';

export class ListTypeFactory {
  private unorderedList = new UnorderedListType();
  private orderedList = new OrderedListType();

  public getListType(lineType: TypePropertiesTrait['lineTypes'][0]): ListType {
    switch (lineType) {
      case 'ORDERED':
        return this.orderedList;
      case 'UNORDERED':
        return this.unorderedList;
    }

    throw new Error('List type not valid');
  }
}
