import * as Definitions from "./definitions";
import * as Strings from "./strings";
import { TextEditorWithDecorations } from "../abstractions/text-editor-with-decorations";
import * as CoverageInfoProvider from "../factories/coverage-info-provider";
import { CoverageInfo } from "../../modules/abstractions/coverage-info";
import { TextEditorWithDecorations as ConcreteTextEditorWithDecorations } from "./text-editor-with-decorations";

import * as vscode from "vscode";

export function make(uncoveredCodeRegionsDocumentContentProvider: vscode.TextDocumentContentProvider): Cov {
  return new Cov(uncoveredCodeRegionsDocumentContentProvider);
}

class Cov {
  constructor(uncoveredCodeRegionsDocumentContentProvider: vscode.TextDocumentContentProvider) {
    this.outputChannel_ = vscode.window.createOutputChannel(Definitions.extensionId);
    this.command = vscode.commands.registerCommand(`${Definitions.extensionId}.reportUncoveredCodeRegionsInFile`, this.run, this);
    this.textDocumentProvider = vscode.workspace.registerTextDocumentContentProvider(Definitions.extensionId, uncoveredCodeRegionsDocumentContentProvider);
    this.uncoveredCodeRegionsVirtualTextEditors_ = new Map<string, TextEditorWithDecorations>();
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: {
        id: Definitions.uncoveredCodeRegionDecorationBackgroundColorId
      }
    });
  }

  get asDisposable() {
    return vscode.Disposable.from(this);
  }

  get outputChannel() {
    return this.outputChannel_;
  }

  dispose() {
    [
      vscode.Disposable.from(this.outputChannel_),
      this.command,
      this.textDocumentProvider
    ].forEach(disposable => disposable.dispose());
  }

  private async run() {
    this.reportStartInOutputChannel();

    await this.displayUncoveredCodeRegions();
  }

  get uncoveredCodeRegionsVirtualTextEditors(): ReadonlyMap<string, TextEditorWithDecorations> {
    return this.uncoveredCodeRegionsVirtualTextEditors_;
  }

  private async displayUncoveredCodeRegions() {
    const uri = this.buildVirtualDocumentUri();
    const uncoveredCodeRegionsVirtualTextEditor = await this.buildUncoveredCodeRegionsVirtualTextEditor(uri);
    const uncoveredCodeInfo: CoverageInfo = await this.queryUncoveredCodeInfo(uri);
    const options: Array<vscode.DecorationOptions> = await this.buildDecorationOptions(uncoveredCodeInfo);

    uncoveredCodeRegionsVirtualTextEditor.setDecorations(this.decorationType, options);
  }

  private async buildDecorationOptions(uncoveredCodeInfo: CoverageInfo) {
    const options: Array<vscode.DecorationOptions> = [];

    try {
      for await (const uncoveredRegion of uncoveredCodeInfo.uncoveredRegions)
        options.push({
          range: new vscode.Range(uncoveredRegion.range.start.line,
            uncoveredRegion.range.start.character,
            uncoveredRegion.range.end.line,
            uncoveredRegion.range.end.character),
          hoverMessage: Strings.uncoveredCodeRegionHoverMessage
        });
    } catch (warning) {
      this.outputChannel_.appendLine(warning.message);
    }

    return options;
  }

  private queryUncoveredCodeInfo(uri: vscode.Uri) {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Computing uncovered code region locations",
      cancellable: false
    }, async progressReporter => {

      const coverageInfoProvider = CoverageInfoProvider.make({ progressReporter, outputChannel: this.outputChannel_ });

      try {
        return await coverageInfoProvider.getCoverageInfoForFile(uri.fsPath);
      } catch (error) {
        this.outputChannel_.appendLine(error.message);
        throw error;
      }
    });
  }

  private async buildUncoveredCodeRegionsVirtualTextEditor(uri: vscode.Uri) {
    const virtualDocument = await vscode.workspace.openTextDocument(uri);
    const virtualTextEditor = await vscode.window.showTextDocument(virtualDocument, { preserveFocus: false });
    const uncoveredCodeRegionsVirtualTextEditor = new ConcreteTextEditorWithDecorations(virtualTextEditor);

    this.addUncoveredCodeRegionsVirtualEditorIfNotExist(uri, uncoveredCodeRegionsVirtualTextEditor);

    return uncoveredCodeRegionsVirtualTextEditor;
  }

  private reportStartInOutputChannel() {
    this.outputChannel_.show(true);
    this.outputChannel_.clear();
    this.outputChannel_.appendLine(`starting ${Definitions.extensionDisplayName}`);
  }

  private buildVirtualDocumentUri() {
    return vscode.Uri.from({
      scheme: Definitions.extensionId,
      path: (<vscode.TextEditor>vscode.window.activeTextEditor).document.uri.path
    });
  }

  private addUncoveredCodeRegionsVirtualEditorIfNotExist(uri: vscode.Uri, doc: TextEditorWithDecorations) {
    if (!this.uncoveredCodeRegionsVirtualTextEditors_.has(uri.fsPath))
      this.uncoveredCodeRegionsVirtualTextEditors_.set(uri.fsPath, doc);
  }

  private readonly outputChannel_: vscode.OutputChannel;
  private readonly command: vscode.Disposable;
  private readonly textDocumentProvider: vscode.Disposable;
  private readonly uncoveredCodeRegionsVirtualTextEditors_: Map<string, TextEditorWithDecorations>;
  private readonly decorationType: vscode.TextEditorDecorationType;
}