#!/usr/bin/env node
/**
 * 发布脚本：bump 版本 → 提交 → 打 tag → 推送。
 * 推送 tag 后由 GitHub Actions 自动构建 .vsix 并创建 pre-release。
 *
 * 用法: pnpm release <patch|minor|major|x.y.z> [--dry-run] [--skip-check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const dryRun = flags.includes("--dry-run");
const skipCheck = flags.includes("--skip-check");
const bump = process.argv.slice(2).find((a) => !a.startsWith("--"));

const USAGE =
  "用法: pnpm release <patch|minor|major|x.y.z> [--dry-run] [--skip-check]";

function fail(msg) {
  console.error(`\n✘ ${msg}`);
  process.exit(1);
}

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function git(...args) {
  if (dryRun) {
    console.log(`  > git ${args.join(" ")}`);
    return;
  }
  const r = spawnSync("git", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    fail(`git ${args[0]} 执行失败`);
  }
}

if (!bump) {
  fail(USAGE);
}

// 分支与工作区检查
const branch = sh("git rev-parse --abbrev-ref HEAD");
if (!dryRun && branch !== "master") {
  fail(`请在 master 分支上发布（当前分支: ${branch}）`);
}
const dirty = sh("git status --porcelain");
if (!dryRun && dirty) {
  fail(`工作区有未提交的改动，请先提交或清理：\n${dirty}`);
}

// 计算新版本
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = pkg.version;

const exact = /^\d+\.\d+\.\d+$/;
let next;
if (bump === "patch" || bump === "minor" || bump === "major") {
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") next = `${major + 1}.0.0`;
  else if (bump === "minor") next = `${major}.${minor + 1}.0`;
  else next = `${major}.${minor}.${patch + 1}`;
} else if (exact.test(bump)) {
  next = bump;
} else {
  fail(`无效的版本参数 "${bump}"。${USAGE}`);
}

const cmp = (a, b) => {
  const [a1, a2, a3] = a.split(".").map(Number);
  const [b1, b2, b3] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2 || a3 - b3;
};
if (cmp(next, current) <= 0) {
  fail(`新版本 ${next} 必须高于当前版本 ${current}`);
}

console.log(
  `\n发布 ${current} → ${next}${dryRun ? "（dry-run，不实际修改）" : ""}\n`
);

// 更新 package.json
pkg.version = next;
if (!dryRun) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// 更新 README 版本徽章
const readmePath = join(root, "README.md");
let readme = readFileSync(readmePath, "utf8");
const readmeNext = readme.replace(/version-\d+\.\d+\.\d+/, `version-${next}`);
if (readmeNext === readme) {
  console.warn("⚠ 未在 README 中找到版本徽章，已跳过");
} else if (!dryRun) {
  writeFileSync(readmePath, readmeNext);
}

// 更新 NOTE.md
const notePath = join(root, "NOTE.md");
if (existsSync(notePath)) {
  const note = readFileSync(notePath, "utf8");
  const noteNext = note.replace(
    /当前已发布版本: \d+\.\d+\.\d+/,
    `当前已发布版本: ${next}`
  );
  if (noteNext === note) {
    console.warn("⚠ 未在 NOTE.md 中找到版本号，已跳过");
  } else if (!dryRun) {
    writeFileSync(notePath, noteNext);
  }
}

// 提醒 CHANGELOG
const changelogPath = join(root, "CHANGELOG.md");
if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, "utf8");
  if (!changelog.includes(`## [${next}]`)) {
    console.warn(`⚠ CHANGELOG.md 尚无 [${next}] 条目，发布前建议补充`);
  }
}

// 类型检查
if (!skipCheck && !dryRun) {
  console.log("运行类型检查...");
  const r = spawnSync("pnpm", ["run", "check-types"], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    fail("类型检查失败，已中止发布");
  }
}

if (dryRun) {
  console.log("\ndry-run 完成，未做任何修改。");
  process.exit(0);
}

// 提交 + 打 tag + 推送
const tag = `v${next}`;
git("add", "package.json", "README.md", "NOTE.md");
git("commit", "-m", `chore(release): ${next}`);
git("tag", "-a", tag, "-m", `v${next}`);
git("push", "origin", "master");
git("push", "origin", tag);

console.log(`\n✅ 已发布 ${next}（tag: ${tag}）`);
console.log("GitHub Actions 将自动构建 .vsix 并创建 pre-release。");
