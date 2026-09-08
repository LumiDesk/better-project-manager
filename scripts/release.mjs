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
const VERSION_FILES = ["package.json", "README.md", "NOTE.md"];

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

// git 是可执行文件（git.exe），spawnSync 可直接调用
function git(...args) {
  if (dryRun) {
    console.log(`  > git ${args.join(" ")}`);
    return;
  }
  const r = spawnSync("git", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(`git ${args[0]} 执行失败`);
  }
}

let next;
let tag;

function rollback() {
  console.log("\n↩ 回滚未完成的发布改动...");
  spawnSync("git", ["tag", "-d", tag], { cwd: root, stdio: "ignore" });
  if (sh("git log -1 --pretty=%s") === `chore(release): ${next}`) {
    spawnSync("git", ["reset", "--soft", "HEAD~1"], {
      cwd: root,
      stdio: "ignore",
    });
  }
  spawnSync("git", ["checkout", "--", ...VERSION_FILES], {
    cwd: root,
    stdio: "ignore",
  });
  console.log("已回滚到发布前状态。");
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
tag = `v${next}`;

console.log(
  `\n发布 ${current} → ${next}${dryRun ? "（dry-run，不实际修改）" : ""}\n`
);

// 类型检查：提前到写文件之前，失败不会留下任何改动
// 注意用 execSync（走 shell），Windows 下 pnpm 是 .cmd 脚本，spawnSync 直接调用会 ENOENT
if (!skipCheck && !dryRun) {
  console.log("运行类型检查...");
  try {
    execSync("pnpm run check-types", { cwd: root, stdio: "inherit" });
  } catch {
    fail("类型检查失败，已中止发布（未修改任何文件）");
  }
}

// 更新版本文件
if (dryRun) {
  for (const f of VERSION_FILES) console.log(`  将更新 ${f}`);
} else {
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const readmePath = join(root, "README.md");
  let readme = readFileSync(readmePath, "utf8");
  const readmeNext = readme.replace(/version-\d+\.\d+\.\d+/, `version-${next}`);
  if (readmeNext === readme) console.warn("⚠ 未在 README 中找到版本徽章，已跳过");
  else writeFileSync(readmePath, readmeNext);

  const notePath = join(root, "NOTE.md");
  if (existsSync(notePath)) {
    const note = readFileSync(notePath, "utf8");
    const noteNext = note.replace(
      /当前已发布版本: \d+\.\d+\.\d+/,
      `当前已发布版本: ${next}`
    );
    if (noteNext === note) console.warn("⚠ 未在 NOTE.md 中找到版本号，已跳过");
    else writeFileSync(notePath, noteNext);
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

if (dryRun) {
  console.log("\ndry-run 完成，未做任何修改。");
  process.exit(0);
}

// 提交 + 打 tag + 推送（失败自动回滚）
try {
  git("add", ...VERSION_FILES);
  git("commit", "-m", `chore(release): ${next}`);
  git("tag", "-a", tag, "-m", `v${next}`);
  git("push", "origin", "master");
  git("push", "origin", tag);
} catch (e) {
  rollback();
  console.error(`\n✘ ${e.message}`);
  process.exit(1);
}

console.log(`\n✅ 已发布 ${next}（tag: ${tag}）`);
console.log("GitHub Actions 将自动构建 .vsix 并创建 pre-release。");
