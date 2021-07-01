import * as Definitions from '../../../extension/definitions';
import { Settings } from '../../settings-provider/domain/abstractions/settings';
// TODO: use module import syntax???
import { OutputChannelLike, ProgressLike } from '../../../shared-kernel/abstractions/vscode';
import { GlobSearchCallable } from '../../../shared-kernel/abstractions/file-system';
import * as Abstractions from '../abstractions/domain/coverage-info-file-resolver';

import * as path from 'path';


export function make(context: Context): Abstractions.CoverageInfoFileResolver {
  return new CoverageInfoFileResolver(context);
}

type Context = {
  settings: Settings,
  globSearch: GlobSearchCallable,
  progressReporter: ProgressLike,
  errorChannel: OutputChannelLike
};

class CoverageInfoFileResolver implements Abstractions.CoverageInfoFileResolver {
  constructor(context: Context) {
    this.globSearch = context.globSearch;
    this.settings = context.settings;
    this.progressReporter = context.progressReporter;
    this.errorChannel = context.errorChannel;
  }

  async resolveCoverageInfoFileFullPath() {
    const searchResult = await this.globSearch(this.pattern);

    this.failsIfNoFileIsFound(searchResult);
    this.failsIfManyFilesAreFound(searchResult);

    this.progressReporter.report({
      message: 'Resolved the LLVM coverage information file path.',
      increment: 100 / 6 * 5
    });

    return searchResult[0];
  }

  private failsIfManyFilesAreFound(searchResult: readonly string[]) {
    if (searchResult.length === 1)
      return;

    const errorMessage = 'More than one coverage information file have been found in the build tree directory. ' +
      'Ensure that both ' +
      `'${Definitions.extensionNameInSettings}: Build Tree Directory' and ` +
      `'${Definitions.extensionNameInSettings}: Coverage Info File Name' ` +
      'settings are correctly set.';

    this.errorChannel.appendLine(errorMessage);

    throw new Error(errorMessage);
  }

  private failsIfNoFileIsFound(searchResult: readonly string[]) {
    if (searchResult.length !== 0)
      return;

    const errorMessage = 'Cannot resolve the coverage info file path in the build tree directory. ' +
      'Ensure that both ' +
      `'${Definitions.extensionNameInSettings}: Build Tree Directory' and ` +
      `'${Definitions.extensionNameInSettings}: Coverage Info File Name' ` +
      'settings are correctly set.';

    this.errorChannel.appendLine(errorMessage);

    throw new Error(errorMessage);
  }

  private get pattern() {
    const posixRootPath = this.settings.rootDirectory.split(path.sep).join(path.posix.sep);

    return `${posixRootPath}${path.posix.sep}**${path.posix.sep}${this.settings.coverageInfoFileName}`;
  }

  private readonly globSearch: GlobSearchCallable;
  private readonly settings: Settings;
  private readonly progressReporter: ProgressLike;
  private readonly errorChannel: OutputChannelLike;
};
