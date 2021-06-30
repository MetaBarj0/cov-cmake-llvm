import * as chai from 'chai';
import { describe, it, before, after } from 'mocha';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
chai.should();

import { defaultSetting } from '../../utils/settings';

import * as SettingsProvider from '../../../src/modules/settings-provider/domain/settings-provider';
import * as BuildTreeDirectoryResolver from '../../../src/modules/build-tree-directory-resolver/domain/build-tree-directory-resolver';
import * as Cmake from '../../../src/modules/cmake/domain/cmake';
import * as definitions from '../../../src/extension/definitions';

import { progressReporter as pr } from '../../fakes/adapters/progress-reporter';
import { errorChannel as e } from '../../fakes/adapters/error-channel';

import * as vscode from 'vscode';
import { env } from 'process';
import * as path from 'path';
import * as fs from '../../../src/adapters/file-system';
import * as pc from '../../../src/adapters/process-control';

describe('integration test suite', () => {
  describe('the behavior of internal services', () => {
    describe('instantiating the setting provider with a real vscode workspace', settingsProviderGivesDefaultSettings);
    describe('with an initialized vscode workspace', () => {
      describe('the behavior of build tree directory resolver', () => {
        describe('with an invalid build tree directory setting', buildTreeDirectoryResolverShouldFail);
        describe('with a valid build tree directory setting', buildTreeDirectoryResolverShouldSucceed);
      });
      describe('the behavior of cmake', () => {
        describe('with an invalid cmake command setting', cmakeInvocationShouldFail);
        describe('with an invalid cmake target setting', cmakeTargetBuildingShouldFail);
        describe('with valid cmake comand and cmake target settings', cmakeTargetBuildingShouldSucceed);
      });
    });
  });
});

function settingsProviderGivesDefaultSettings() {
  it('should not throw any exception when instantiating settings provider and settings should be set with default values', () => {
    const settings = SettingsProvider.make({ workspace: vscode.workspace, errorChannel: e.buildFakeErrorChannel() }).settings;

    settings.buildTreeDirectory.should.be.equal('build');
    settings.cmakeCommand.should.be.equal('cmake');
    settings.cmakeTarget.should.be.equal('coverage');
    settings.coverageInfoFileName.should.be.equal('coverage.json');
    settings.additionalCmakeOptions.should.be.empty;

    const rootFolder = (vscode.workspace.workspaceFolders as Array<vscode.WorkspaceFolder>)[0].uri.fsPath;
    settings.rootDirectory.should.be.equal(rootFolder);
  });
}

function buildTreeDirectoryResolverShouldFail() {
  before('setting up a bad build tree directory setting', async () =>
    await extensionConfiguration.update('buildTreeDirectory', '*<>buildz<>*\0'));

  it('should not be possible to find or create the build tree directory', () => {
    return makeBuildTreeDirectoryResolver().resolve().should.eventually.be.rejectedWith(
      'Cannot find or create the build tree directory. Ensure the ' +
      `'${definitions.extensionNameInSettings}: Build Tree Directory' setting is a valid relative path.`);
  });

  after('restoring default build tree directory setting', async () =>
    await extensionConfiguration.update('buildTreeDirectory', defaultSetting('buildTreeDirectory')));
}

function cmakeInvocationShouldFail() {
  before('Modifying cmake command setting', async () => {
    await extensionConfiguration.update('cmakeCommand', 'cmakez');
  });

  it('should fail in attempting to invoke cmake', () => {
    return makeCmake().buildTarget().should.eventually.be.rejectedWith(
      `Cannot find the cmake command. Ensure the '${definitions.extensionNameInSettings}: Cmake Command' ` +
      'setting is correctly set. Have you verified your PATH environment variable?');
  });

  after('restoring cmake command setting', async () => {
    await extensionConfiguration.update('cmakeCommand', defaultSetting('cmakeCommand'));
  });
}

function cmakeTargetBuildingShouldFail() {
  let originalEnvPath: string;

  before('Modifying cmake target and additional options settings and PATH environment variable', async () => {
    await Promise.all([
      extensionConfiguration.update('cmakeTarget', 'Oh my god! This is clearly an invalid cmake target'),
      extensionConfiguration.update('additionalCmakeOptions', ['-DCMAKE_CXX_COMPILER=clang++', '-G', 'Ninja'])
    ]);

    originalEnvPath = prependLlvmBinDirToPathEnvironmentVariable();
  });

  it('should fail in attempting to build an invalid cmake target', () => {
    const settings = SettingsProvider.make({ workspace: vscode.workspace, errorChannel: e.buildFakeErrorChannel() }).settings;

    return makeCmake().buildTarget().should.eventually.be.rejectedWith(
      `Error: Could not build the specified cmake target ${settings.cmakeTarget}. ` +
      `Ensure '${definitions.extensionNameInSettings}: Cmake Target' setting is properly set.`);
  });

  after('restoring cmake target and additonal options settings and PATH environment variable', async () => {
    await Promise.all([
      extensionConfiguration.update('cmakeTarget', defaultSetting('cmakeTarget')),
      extensionConfiguration.update('additionalCmakeOptions', defaultSetting('additionalCmakeOptions'))
    ]);

    env['PATH'] = originalEnvPath;
  });
}

function buildTreeDirectoryResolverShouldSucceed() {
  it('should find the build tree directory', () => {
    return makeBuildTreeDirectoryResolver().resolve().should.eventually.be.fulfilled;
  });
}

function cmakeTargetBuildingShouldSucceed() {
  let originalEnvPath: string;

  before('Modifying additional cmake command options, PATH environment variable ', async () => {
    await extensionConfiguration.update('additionalCmakeOptions', ['-DCMAKE_CXX_COMPILER=clang++', '-G', 'Ninja']);

    originalEnvPath = prependLlvmBinDirToPathEnvironmentVariable();
  });

  it('should not throw when attempting to build a valid cmake target specified in settings', () => {
    return makeCmake().buildTarget().should.eventually.be.fulfilled;
  });

  after('restoring additional cmake command options and PATH environment variable', async () => {
    await extensionConfiguration.update('additionalCmakeOptions', []);

    env['PATH'] = originalEnvPath;
  });
}

function prependLlvmBinDirToPathEnvironmentVariable() {
  const oldPath = <string>env['PATH'];

  if (env['LLVM_DIR']) {
    const binDir = path.join(env['LLVM_DIR'], 'bin');
    const currentPath = <string>env['PATH'];
    env['PATH'] = `${binDir}${path.delimiter}${currentPath}`;
  }

  return oldPath;
}

const extensionConfiguration = vscode.workspace.getConfiguration(definitions.extensionId);

function makeCmake() {
  const settings = SettingsProvider.make({ errorChannel: e.buildFakeErrorChannel(), workspace: vscode.workspace }).settings;

  return Cmake.make({
    settings,
    processControl: {
      execFileForCommand: pc.execFile,
      execFileForTarget: pc.execFile,
    },
    vscode: {
      progressReporter: pr.buildFakeProgressReporter(),
      errorChannel: e.buildFakeErrorChannel()
    }
  });
}

function makeBuildTreeDirectoryResolver() {
  const errorChannel = e.buildFakeErrorChannel();
  const workspace = vscode.workspace;
  const settings = SettingsProvider.make({ workspace, errorChannel }).settings;

  return BuildTreeDirectoryResolver.make({
    settings,
    stat: fs.stat,
    mkDir: fs.mkdir,
    progressReporter: pr.buildFakeProgressReporter(),
    errorChannel
  });
}