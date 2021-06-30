import * as BuildTreeDirectoryResolver from '../../build-tree-directory-resolver/domain/build-tree-directory-resolver';
import * as Cmake from '../../cmake/domain/cmake';
import * as CoverageInfoCollector from '../../coverage-info-collector/domain/coverage-info-collector';
// TODO: module import syntax???
import * as Abstractions from '../abstractions/domain/decoration-locations-provider';
import { CreateReadStreamCallable, GlobSearchCallable, MkdirCallable, StatCallable } from '../../../adapters/interfaces/file-system';
import { OutputChannelLike, ProgressLike, VscodeWorkspaceLike } from '../../../adapters/interfaces/vscode';
import { ExecFileCallable } from '../../../adapters/interfaces/process-control';
import { SettingsContract } from '../../settings-provider/abstractions/domain/settings-contract';

export function make(context: Context): Abstractions.DecorationLocationsProvider {
  return new DecorationLocationsProvider({
    settings: context.settings,
    stat: context.fileSystem.stat,
    execFileForCmakeCommand: context.processControl.execFileForCommand,
    execFileForCmakeTarget: context.processControl.execFileForTarget,
    globSearch: context.fileSystem.globSearch,
    mkdir: context.fileSystem.mkdir,
    createReadStream: context.fileSystem.createReadStream,
    progressReporter: context.vscode.progressReporter,
    errorChannel: context.vscode.errorChannel
  });
}

type Context = {
  settings: SettingsContract,
  vscode: {
    progressReporter: ProgressLike,
    errorChannel: OutputChannelLike,
    workspace: VscodeWorkspaceLike
  },
  processControl: {
    execFileForCommand: ExecFileCallable,
    execFileForTarget: ExecFileCallable,
  },
  fileSystem: {
    stat: StatCallable,
    mkdir: MkdirCallable,
    globSearch: GlobSearchCallable,
    createReadStream: CreateReadStreamCallable
  }
};

class DecorationLocationsProvider implements Abstractions.DecorationLocationsProvider {
  constructor(context: ContextToBeRefacto) {
    this.settings = context.settings;
    this.stat = context.stat;
    this.execFileForCmakeCommand = context.execFileForCmakeCommand;
    this.execFileForCmakeTarget = context.execFileForCmakeTarget;
    this.globSearch = context.globSearch;
    this.mkdir = context.mkdir;
    this.createReadStream = context.createReadStream;
    this.progressReporter = context.progressReporter;
    this.errorChannel = context.errorChannel;
  }

  async getDecorationLocationsForUncoveredCodeRegions(sourceFilePath: string) {
    const buildTreeDirectoryResolver = BuildTreeDirectoryResolver.make({
      settings: this.settings,
      stat: this.stat,
      mkDir: this.mkdir,
      progressReporter: this.progressReporter,
      errorChannel: this.errorChannel
    });

    await buildTreeDirectoryResolver.resolve();

    const cmake = Cmake.make({
      settings: this.settings,
      processControl: {
        execFileForCommand: this.execFileForCmakeCommand,
        execFileForTarget: this.execFileForCmakeTarget,
      },
      vscode: {
        progressReporter: this.progressReporter,
        errorChannel: this.errorChannel
      }
    });

    await cmake.buildTarget();

    const collector = CoverageInfoCollector.make({
      settings: this.settings,
      globSearch: this.globSearch,
      createReadStream: this.createReadStream,
      progressReporter: this.progressReporter,
      errorChannel: this.errorChannel
    });

    return collector.collectFor(sourceFilePath);
  }

  private readonly settings: SettingsContract;
  private readonly stat: StatCallable;
  private readonly execFileForCmakeCommand: ExecFileCallable;
  private readonly execFileForCmakeTarget: ExecFileCallable;
  private readonly globSearch: GlobSearchCallable;
  private readonly mkdir: MkdirCallable;
  private readonly createReadStream: CreateReadStreamCallable;
  private readonly progressReporter: ProgressLike;
  private readonly errorChannel: OutputChannelLike;
}

type ContextToBeRefacto = {
  settings: SettingsContract,
  progressReporter: ProgressLike,
  errorChannel: OutputChannelLike
  stat: StatCallable,
  execFileForCmakeCommand: ExecFileCallable,
  execFileForCmakeTarget: ExecFileCallable,
  globSearch: GlobSearchCallable,
  mkdir: MkdirCallable,
  createReadStream: CreateReadStreamCallable,
};