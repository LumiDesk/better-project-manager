(function () {
  // 获取 VS Code API（只能调用一次）
  const vscode =
    typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

  function sendMessage(command) {
    if (vscode) {
      vscode.postMessage({ command: command });
    }
  }

  document.getElementById("nextBtn").addEventListener("click", function () {
    sendMessage("next");
  });

  document.getElementById("skipBtn").addEventListener("click", function () {
    sendMessage("skip");
  });
})();
