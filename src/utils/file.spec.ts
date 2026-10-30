import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { JsonPath, streamBigJsonFileValues } from '@figpot/src/utils/file';

describe('streamBigJsonFileValues', () => {
  it('should only build the selected values with their path', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'figpot-test-'));
    const filePath = path.join(directory, 'tree.json');

    await fs.writeFile(
      filePath,
      JSON.stringify({
        name: 'Doc',
        data: {
          pages: ['p1', 'p2'],
          pagesIndex: {
            p1: { name: 'One', objects: { a: { id: 'a', points: [{ x: 1 }] }, b: { id: 'b', hidden: true } } },
            p2: { name: 'Two', objects: {} },
          },
          list: [{ skipped: true }, 'value'],
        },
      })
    );

    const values: [JsonPath, unknown][] = [];

    await streamBigJsonFileValues(
      filePath,
      (valuePath) =>
        (valuePath.length === 1 && valuePath[0] === 'name') ||
        (valuePath.length === 5 && valuePath[3] === 'objects') ||
        (valuePath.length === 4 && valuePath[3] === 'name') ||
        (valuePath.length === 3 && valuePath[1] === 'list' && valuePath[2] === 1),
      (valuePath, value) => {
        values.push([valuePath, value]);
      }
    );

    expect(values).toEqual([
      [['name'], 'Doc'],
      [['data', 'pagesIndex', 'p1', 'name'], 'One'],
      [['data', 'pagesIndex', 'p1', 'objects', 'a'], { id: 'a', points: [{ x: 1 }] }],
      [['data', 'pagesIndex', 'p1', 'objects', 'b'], { id: 'b', hidden: true }],
      [['data', 'pagesIndex', 'p2', 'name'], 'Two'],
      [['data', 'list', 1], 'value'],
    ]);

    await fs.rm(directory, { recursive: true, force: true });
  });
});
