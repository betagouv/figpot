import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { JsonPath, readBigJsonFile, readBigJsonStream, streamBigJsonFileValues } from '@figpot/src/utils/file';

describe('readBigJsonStream', () => {
  it('should decode a multibyte character split between two chunks', async () => {
    const content = Buffer.from(JSON.stringify({ name: 'Éléments à vérifier', list: [1, true, null] }), 'utf-8');
    const splitIndex = content.indexOf(Buffer.from('É', 'utf-8')) + 1; // Inside the 2 bytes of the character

    const value = await readBigJsonStream(Readable.from([content.subarray(0, splitIndex), content.subarray(splitIndex)]), 'the test');

    expect(value).toEqual({ name: 'Éléments à vérifier', list: [1, true, null] });
  });

  it('should fail on a truncated content', async () => {
    await expect(readBigJsonStream(Readable.from([Buffer.from('{"name": "Doc", "list": [1, 2')]), 'the test')).rejects.toThrow();
  });
});

describe('readBigJsonFile', () => {
  it('should read the whole file', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'figpot-test-'));
    const filePath = path.join(directory, 'tree.json');
    const content = { name: 'Doc', data: { pages: ['p1'], nested: { a: [{ x: 1.5 }, 'é'] } } };

    await fs.writeFile(filePath, JSON.stringify(content));

    expect(await readBigJsonFile(filePath)).toEqual(content);

    await fs.rm(directory, { recursive: true, force: true });
  });
});

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
