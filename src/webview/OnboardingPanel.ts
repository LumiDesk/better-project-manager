import * as vscode from "vscode";

/**
 * 新手引导 Webview 面板
 * 纯文字 + 步骤指示器的轻量引导
 */
export class OnboardingPanel {
  public static currentPanel: OnboardingPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _onComplete?: () => void;
  private _disposables: vscode.Disposable[] = [];
  private _completedStep: number = 0;

  static readonly steps = [
    {
      icon: "🗂️",
      title: "欢迎使用项目管理器",
      description:
        "点击左侧活动栏中的「项目管理器」图标，打开项目列表。你保存的所有项目都会集中显示在这里，随时快速切换。",
    },
    {
      icon: "➕",
      title: "添加你的项目",
      description:
        "点击侧边栏顶部的「保存当前文件夹」或「添加项目」，即可把常用项目加入列表。支持按文件夹分组、为项目设置自定义图标。",
    },
    {
      icon: "⚡",
      title: "快速打开，轻松整理",
      description:
        "点击项目即可打开，用顶部 🔍 搜索快速定位。右键可重命名、换图标、移动分组，也能直接拖拽项目到文件夹。",
    },
  ];

  /**
   * 显示新手引导面板
   * @param extensionUri 扩展 URI
   * @param onComplete 引导完成或跳过时的回调函数
   */
  public static show(extensionUri: vscode.Uri, onComplete?: () => void): void {
    if (OnboardingPanel.currentPanel) {
      OnboardingPanel.currentPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "projectManagerOnboarding",
      "项目管理器入门教程",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "resources", "readme-assets"),
        ],
      }
    );

    OnboardingPanel.currentPanel = new OnboardingPanel(panel, extensionUri, onComplete);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    onComplete?: () => void
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._onComplete = onComplete;

    // 设置 Webview 内容
    this._panel.webview.html = this._getHtmlForWebview();

    // Webview 消息监听：步骤完成/跳过
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "next") {
          this._completedStep++;
          if (this._completedStep < OnboardingPanel.steps.length) {
            this._panel.webview.html = this._getHtmlForWebview();
          } else {
            // 完成全部，关闭面板
            this.dispose();
            vscode.commands.executeCommand(
              "workbench.view.extension.projectManagerSidebar"
            );
          }
        } else if (message.command === "skip") {
          this.dispose();
        }
      },
      undefined,
      this._disposables
    );

    // 销毁时清理
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose(): void {
    // 调用完成回调
    if (this._onComplete) {
      this._onComplete();
    }

    OnboardingPanel.currentPanel = undefined;
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) {
        d.dispose();
      }
    }
    this._panel.dispose();
  }

  private _getHtmlForWebview(): string {
    const step = OnboardingPanel.steps[this._completedStep];
    const cssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "resources",
        "readme-assets",
        "onboarding.css"
      )
    );
    const jsUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "resources",
        "readme-assets",
        "onboarding.js"
      )
    );
    const cspSource = this._panel.webview.cspSource;

    // 步骤指示器圆点
    const dots = OnboardingPanel.steps
      .map((_, idx) => {
        const cls =
          idx < this._completedStep
            ? "done"
            : idx === this._completedStep
              ? "active"
              : "";
        return `<span class="dot ${cls}"></span>`;
      })
      .join("");

    const isLast = this._completedStep === OnboardingPanel.steps.length - 1;

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>项目管理器新手引导</title>
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};"
        />
        <link rel="stylesheet" href="${cssUri}" />
      </head>
      <body>
        <main class="onboarding">
          <div class="step-indicator">${dots}</div>
          <div class="icon">${step.icon}</div>
          <h1 class="title">${step.title}</h1>
          <p class="desc">${step.description}</p>
          <div class="toolbar">
            <button id="nextBtn">${isLast ? "开始使用" : "下一步"}</button>
            <button id="skipBtn" class="skip">跳过引导</button>
          </div>
        </main>
        <script src="${jsUri}"></script>
      </body>
      </html>
    `;
  }
}
