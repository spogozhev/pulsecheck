#!/usr/bin/env node
/**
 * Релиз: повышает версию, коммитит и ставит git-тег.
 *
 *   node scripts/release.mjs patch   # 0.1.0 -> 0.1.1  (исправления)
 *   node scripts/release.mjs minor   # 0.1.0 -> 0.2.0  (новые фичи)
 *   node scripts/release.mjs major   # 0.1.0 -> 1.0.0  (ломающие изменения)
 *
 * Запускается В ВЕТКЕ master после влития feature-ветки через Pull Request.
 * После выполнения: git push && git push --tags
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const kind = process.argv[2];
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Использование: node scripts/release.mjs <patch|minor|major>');
  process.exit(1);
}

const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) {
  console.error('Рабочее дерево не чистое — сначала закоммитьте изменения:');
  console.error(dirty);
  process.exit(1);
}

const rootPkgPath = new URL('../package.json', import.meta.url);
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const [major, minor, patch] = rootPkg.version.split('.').map(Number);

const next =
  kind === 'major'
    ? `${major + 1}.0.0`
    : kind === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

// версия во всех package.json монорепо
for (const p of ['package.json', 'server/package.json', 'web/package.json']) {
  const path = new URL(`../${p}`, import.meta.url);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = next;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

// версия, зашитая в API (компилируется в dist)
const versionTsPath = new URL('../server/src/app.version.ts', import.meta.url);
writeFileSync(versionTsPath, `// Обновляется скриптом scripts/release.mjs — не править вручную\nexport const APP_VERSION = '${next}';\n`);

execSync('git add package.json server/package.json web/package.json server/src/app.version.ts', { stdio: 'inherit' });
execSync(`git commit -m "chore(release): v${next}"`, { stdio: 'inherit' });
execSync(`git tag "v${next}"`, { stdio: 'inherit' });

console.log(`\nРелиз v${next} готов.`);
console.log('Опубликуйте его:\n  git push && git push --tags\n');
