import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * 文件监视器
 */
export class FileWatcher {
  private watcher: vscode.FileSystemWatcher | undefined;

  /**
   * 创建配置文件监视器
   * @param configFile 配置文件路径
   * @param onConfigChange 配置文件变化回调
   * @returns 文件监视器
   */
  createConfigWatcher(
    configFile: string,
    onConfigChange: () => void
  ): vscode.FileSystemWatcher {
    const configDir = path.dirname(configFile);

    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 创建文件系统监视器（同时监听项目配置与文件夹配置）
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(configDir, "*.json")
    );

    // 监听文件变化事件
    watcher.onDidChange(onConfigChange);
    watcher.onDidCreate(onConfigChange);
    watcher.onDidDelete(onConfigChange);

    this.watcher = watcher;
    return watcher;
  }

  /**
   * 销毁文件监视器
   */
  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
  }
}
