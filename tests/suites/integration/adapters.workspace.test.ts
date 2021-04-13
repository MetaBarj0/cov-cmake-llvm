import * as chai from 'chai';
import * as mocha from 'mocha';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
chai.should();

const describe = mocha.describe;
const it = mocha.it;

import { ExtensionSettings } from '../../../src/environment/extensionSettings';
import { FileSystemBuildTreeDirectoryResolver } from '../../../src/environment/fileSystemBuildTreeDirectoryResolver';

import * as vscode from 'vscode';

const workspaceFolders = vscode.workspace.workspaceFolders as Array<vscode.WorkspaceFolder>;
const rootFolder = workspaceFolders[0].uri.fsPath;


describe('The way adapters can be instantiated when vscode has an active workspace', () => {
  it('should not throw any exception when instantiating extension settings and settings should be set with default values', () => {
    const settings = new ExtensionSettings();

    settings.buildTreeDirectory.should.be.equal('build');
    settings.cmakeCommand.should.be.equal('cmake');
    settings.cmakeTarget.should.be.equal('reportCoverageDetails');

    settings.coverageInfoFileNamePatterns.length.should.be.equal(1);
    settings.coverageInfoFileNamePatterns[0].should.be.equal('default\\.covdata\\.json');

    settings.rootDirectory.should.be.equal(rootFolder);
  });

  it('should not throw an exception when instantiating a build tree directory resolver with an incorrect setting.', () => {
    const settings = new ExtensionSettings();

    settings.buildTreeDirectory = 'buildz';

    (() => { new FileSystemBuildTreeDirectoryResolver(settings); }).should.not.throw();
  });

  it('should be possible to access the full path of the build tree directory using a ' +
    'build tree directory resolver instance.',
    async () => {
      const settings = new ExtensionSettings();

      const resolver = new FileSystemBuildTreeDirectoryResolver(settings);

      return resolver.getFullPath().should.eventually.be.fulfilled;
    });
});