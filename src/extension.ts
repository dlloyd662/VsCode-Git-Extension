import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

export function activate(context: vscode.ExtensionContext) {
  let openInMainDisposable = vscode.commands.registerCommand(
    "githubextension.openInGitHubMain",
    () => {
      openFile(true);
    }
  );
  let openInCurrentDisposable = vscode.commands.registerCommand(
    "githubextension.openInGitHubCurrent",
    () => {
      openFile(false);
    }
  );

  context.subscriptions.push(openInMainDisposable, openInCurrentDisposable);
}

function openFile(openOnMain: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor.");
    return;
  }

  // Initialize variables to store the highest and lowest line numbers
  let highestLineNumber = -1; // Initialize with a lower value
  let lowestLineNumber = Number.MAX_SAFE_INTEGER; // Initialize with a higher value

  // Check if there is a selection
  if (editor.selection.isEmpty) {
    const cursorLineNumber = editor.selection.active.line + 1; // 1-based line number
    highestLineNumber = cursorLineNumber;
    lowestLineNumber = cursorLineNumber;
    // return;
  } else {
    // Iterate through the selected lines and update the highest and lowest line numbers
    for (
      let line = editor.selection.start.line;
      line <= editor.selection.end.line;
      line++
    ) {
      const lineNumber = line + 1; // Line numbers are 1-based

      // Update the highest and lowest line numbers
      highestLineNumber = Math.max(highestLineNumber, lineNumber);
      lowestLineNumber = Math.min(lowestLineNumber, lineNumber);
    }
  }

  // Get the Git repository root directory (assuming it's the workspace root)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return;
  }

  const workspacePath = workspaceFolder.uri.fsPath;

  // Construct the Git URL
  const gitOrigin = getGitOrigin(workspacePath);
  if (!gitOrigin) {
    vscode.window.showErrorMessage("Git origin not found.");
    return;
  }

  // Remove .git if it exists in the Git origin URL
  const cleanGitOrigin = gitOrigin.replace(/\.git$/, "");

  // Get the relative path of the selected file from the Git repository root
  const relativeFilePath = path.relative(
    workspacePath,
    editor.document.uri.fsPath
  );

  // Get the current branch (main if runOnMain is true, otherwise use the actual branch)
  const currentBranch = getCurrentBranch(
    workspacePath,
    highestLineNumber === -1
  );

  // Construct the Git URL with line number
  let gitUrl;
  if (openOnMain) {
    gitUrl = `${cleanGitOrigin}/blob/main/${relativeFilePath}#L${lowestLineNumber}`;
  } else {
    gitUrl = `${cleanGitOrigin}/blob/${currentBranch}/${relativeFilePath}#L${lowestLineNumber}`;
  }
  if (highestLineNumber > lowestLineNumber) {
    gitUrl = gitUrl + `-#L${highestLineNumber}`;
  }
  // Open the Git URL in the default web browser
  vscode.env.openExternal(vscode.Uri.parse(gitUrl));
}

function getGitOrigin(workspacePath: string): string | undefined {
  try {
    // Read the Git configuration to get the remote.origin.url
    const gitConfigPath = `${workspacePath}/.git/config`;
    const gitConfig = fs.readFileSync(gitConfigPath, "utf8");
    const match = /url\s*=\s*(.*)/.exec(gitConfig);
    return match ? match[1] : undefined;
  } catch (error) {
    console.error("Error reading Git config:", error);
    return undefined;
  }
}

function getCurrentBranch(workspacePath: string, runOnMain: boolean): string {
  try {
    // Use 'git symbolic-ref --short HEAD' to get the current branch name
    const gitCommand = runOnMain ? "main" : "git symbolic-ref --short HEAD";
    const result = child_process.execSync(gitCommand, {
      cwd: workspacePath,
      encoding: "utf8",
    });
    return result.trim();
  } catch (error) {
    console.error("Error getting current branch:", error);
    return "";
  }
}

export function deactivate() {}
