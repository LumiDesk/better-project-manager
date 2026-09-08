import * as vscode from "vscode";

/**
 * 新手引导 Webview 面板
 * 交互式 todo + 图文
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
      title: "打开侧边栏",
      description:
        "点击左侧活动栏中的项目管理图标以打开 Project Manager 侧边栏。",
      image: "image.png",
    },
    {
      title: "基本功能说明",
      description: "项目支持分组、重命名、删除等，可右键快速操作。",
      image: "image-2.png",
    },
    {
      title: "项目右键操作",
      description: "在项目上右键可进行打开、重命名、设置图标等操作。",
      image: "image-3.png",
    },
    {
      title: "拖动项目操作",
      description: "直接拖动项目, 进行跨文件夹移动。",
      image: "Snipaste_2025-10-25_15-58-34.jpg",
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
    const imgUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "resources",
        "readme-assets",
        step.image
      )
    );
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

    // todo 列表 html
    const todoList = OnboardingPanel.steps
      .map((s, idx) => {
        const done = idx < this._completedStep;
        const current = idx === this._completedStep;
        return `<li>
            <span class="step-badge${done ? " done" : ""}">${
          done ? "✔" : idx + 1
        }</span>
            <span class="step-label${current ? " current" : ""}">${s.title}</span>
          </li>`;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>项目管理器新手引导</title>
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${cspSource} https:; style-src ${cspSource}; script-src ${cspSource};"
        />
        <link rel="stylesheet" href="${cssUri}" />
      </head>
      <body>
        <div class="main">
          <aside class="sidebar">
            <h2>新手任务</h2>
            <ul class="steps">${todoList}</ul>
          </aside>
          <section class="right">
            <div class="intro-title">${step.title}</div>
            <div class="intro-desc">${step.description}</div>
            <div class="img-card"><img src="${imgUri}"/></div>
            <div class="toolbar">
              <button id="nextBtn">${
                this._completedStep < OnboardingPanel.steps.length - 1
                  ? "下一步"
                  : "完成体验"
              }</button>
              <button id="skipBtn" class="skip">跳过本教程</button>
            </div>
          </section>
        </div>
        <script src="${jsUri}"></script>
      </body>
      </html>
    `;
  }
}
