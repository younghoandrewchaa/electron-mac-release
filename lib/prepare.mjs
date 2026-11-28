import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function prepareAssets({ cwd, assets }) {
  for (const [from, to] of Object.entries(assets)) {
    await cp(resolve(cwd, from), resolve(cwd, to), { recursive: true });
  }
}
