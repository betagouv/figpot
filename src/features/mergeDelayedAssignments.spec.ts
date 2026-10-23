import { appCommonFilesChanges$changeWithoutUnknown } from '@figpot/src/clients/workaround';
import { mergeDelayedAssignments } from '@figpot/src/features/document';

const assign = (id: string, value: Record<string, unknown>) =>
  ({ type: 'mod-obj', id: id, pageId: 'page', operations: [{ type: 'assign', value: value }] }) as appCommonFilesChanges$changeWithoutUnknown;

describe('mergeDelayedAssignments()', () => {
  it('should merge delayed assignments of a same shape into the last one', () => {
    const operations = [
      assign('a', { shapes: ['b'] }),
      { type: 'add-obj', id: 'c' } as unknown as appCommonFilesChanges$changeWithoutUnknown,
      assign('a', { shapeRef: 'x', componentId: 'y' }),
    ];

    mergeDelayedAssignments(operations);

    expect(operations).toEqual([{ type: 'add-obj', id: 'c' }, assign('a', { shapes: ['b'], shapeRef: 'x', componentId: 'y' })]);
  });

  it('should let the last assignment win and keep other updates untouched', () => {
    const operations = [assign('a', { shapes: ['b'] }), assign('a', { fills: [] }), assign('a', { shapes: ['c', 'b'] })];

    mergeDelayedAssignments(operations);

    expect(operations).toEqual([assign('a', { fills: [] }), assign('a', { shapes: ['c', 'b'] })]);
  });
});
