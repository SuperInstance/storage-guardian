import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemProvider, StorageGuardian } from '../index';

// Builds a small fixture tree:
//   a.txt  "content-a"
//   b.txt  "content-a"   (duplicate of a.txt)
//   c.log  "content-c"
//   .hidden "secret"      (hidden — excluded by default)
//   sub/d.txt  "content-d"
//   sub/nested/e.txt "content-e"
async function makeFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sg-fs-'));
  await mkdir(join(root, 'sub', 'nested'), { recursive: true });
  await writeFile(join(root, 'a.txt'), 'content-a');
  await writeFile(join(root, 'b.txt'), 'content-a');
  await writeFile(join(root, 'c.log'), 'content-c');
  await writeFile(join(root, '.hidden'), 'secret');
  await writeFile(join(root, 'sub', 'd.txt'), 'content-d');
  await writeFile(join(root, 'sub', 'nested', 'e.txt'), 'content-e');
  return root;
}

async function names(p: FileSystemProvider): Promise<string[]> {
  const out: string[] = [];
  for await (const e of p.scan()) out.push(e.name);
  return out.sort();
}

describe('FileSystemProvider', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeFixture();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('walks the tree and excludes hidden files by default', async () => {
    const provider = new FileSystemProvider({ rootPath: root });
    expect(await names(provider)).toEqual([
      'a.txt',
      'b.txt',
      'c.log',
      'd.txt',
      'e.txt',
    ]);
  });

  it('includes hidden files when includeHidden is set', async () => {
    const provider = new FileSystemProvider({ rootPath: root, includeHidden: true });
    expect(await names(provider)).toContain('.hidden');
  });

  it('honors maxDepth to limit recursion', async () => {
    expect(
      await names(new FileSystemProvider({ rootPath: root, maxDepth: 0 })),
    ).toEqual(['a.txt', 'b.txt', 'c.log']);
    expect(
      await names(new FileSystemProvider({ rootPath: root, maxDepth: 1 })),
    ).toEqual(['a.txt', 'b.txt', 'c.log', 'd.txt']);
  });

  it('honors custom excludePatterns', async () => {
    const provider = new FileSystemProvider({
      rootPath: root,
      excludePatterns: ['*.log'],
    });
    expect(await names(provider)).toEqual(['a.txt', 'b.txt', 'd.txt', 'e.txt']);
  });

  it('hashes content so identical files share a content hash', async () => {
    const provider = new FileSystemProvider({ rootPath: root });
    const hashes = new Map<string, string>();
    for await (const e of provider.scan()) hashes.set(e.name, e.contentHash);
    expect(hashes.get('a.txt')).toBe(hashes.get('b.txt'));
    expect(hashes.get('a.txt')).not.toBe(hashes.get('c.log'));
  });

  it('reads file contents back', async () => {
    const provider = new FileSystemProvider({ rootPath: root });
    const entries = [];
    for await (const e of provider.scan()) entries.push(e);
    const a = entries.find((e) => e.name === 'a.txt')!;
    expect((await provider.read(a)).toString()).toBe('content-a');
  });

  it('reports existence and metadata via exists()/stat()', async () => {
    const provider = new FileSystemProvider({ rootPath: root });
    expect(await provider.exists(join(root, 'a.txt'))).toBe(true);
    expect(await provider.exists(join(root, 'nope.txt'))).toBe(false);

    const meta = await provider.stat(join(root, 'a.txt'));
    expect(meta).not.toBeNull();
    expect(meta!.isFile).toBe(true);
    expect(meta!.sizeBytes).toBe('content-a'.length);
  });

  it('throws when reading an entry that has no path', async () => {
    const provider = new FileSystemProvider({ rootPath: root });
    await expect(
      provider.read({ id: 'x', contentHash: 'h', sizeBytes: 0, name: 'x' } as any),
    ).rejects.toThrow(/has no path/);
  });

  it('detects duplicates end-to-end via StorageGuardian.scan()', async () => {
    const sg = new StorageGuardian(new FileSystemProvider({ rootPath: root }));
    const count = await sg.scan();
    expect(count).toBe(5);
    expect(sg.generateReport().duplicateGroups).toHaveLength(1);
  });
});
