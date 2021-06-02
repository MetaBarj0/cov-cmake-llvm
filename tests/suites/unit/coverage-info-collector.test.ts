import * as chai from 'chai';
import { describe, it } from 'mocha';
import * as chaiAsPromised from 'chai-as-promised';

import { CoverageCollector } from '../../../src/domain/services/coverage-info-collector';
import { extensionName } from '../../../src/extension-name';

import { stream as s } from '../../builders/fake-adapters';

chai.use(chaiAsPromised);
chai.should();

describe('The collection of coverage summary and uncovered code regions with an invalid input readable stream', () => {
  [
    s.buildEmptyReadableStream,
    s.buildInvalidLlvmCoverageJsonObjectStream,
    s.buildNotJsonStream
  ].forEach(streamFactory => {
    it('should fail to access to coverage summary', () => {
      const collector = new CoverageCollector(s.buildFakeStreamBuilder(streamFactory));

      return collector.collectFor('').summary()
        .should.eventually.be.rejectedWith('Invalid coverage information file have been found in the build tree directory. ' +
          'Coverage information file must contain llvm coverage report in json format. ' +
          'Ensure that both ' +
          `'${extensionName}: Build Tree Directory' and '${extensionName}: Coverage Info File Name' ` +
          'settings are correctly set.');
    });
  });

  [
    s.buildEmptyReadableStream,
    s.buildInvalidLlvmCoverageJsonObjectStream,
    s.buildNotJsonStream
  ].forEach(streamFactory => {
    it('should fail to access to uncovered regions', () => {
      const collector = new CoverageCollector(s.buildFakeStreamBuilder(streamFactory));
      const uncoveredRegions = collector.collectFor('').uncoveredRegions;
      const iterate = async () => { for await (const _uncoveredRegion of uncoveredRegions()); };

      return iterate()
        .should.eventually.be.rejectedWith('Invalid coverage information file have been found in the build tree directory. ' +
          'Coverage information file must contain llvm coverage report in json format. ' +
          'Ensure that both ' +
          `'${extensionName}: Build Tree Directory' and '${extensionName}: Coverage Info File Name' ` +
          'settings are correctly set.');
    });
  });
});

describe('The collection of coverage summary and uncovered code regions with a valid input readable stream', () => {
  it('should fail to provide coverage summary for an unhandled source file', () => {
    const collector = new CoverageCollector(s.buildFakeStreamBuilder(s.buildValidLlvmCoverageJsonObjectStream));
    const sourceFilePath = '/an/unhandled/source/file.cpp';

    return collector.collectFor(sourceFilePath).summary()
      .should.eventually.be.rejectedWith('Cannot find any summary coverage info for the file ' +
        `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);
  });

  it('should succeed in provided summary coverage info for handled source file', async () => {
    const collector = new CoverageCollector(s.buildFakeStreamBuilder(s.buildValidLlvmCoverageJsonObjectStream));
    const sourceFilePath = '/a/source/file.cpp';

    const summary = await collector.collectFor(sourceFilePath).summary();

    summary.count.should.be.equal(2);
    summary.covered.should.be.equal(2);
    summary.notCovered.should.be.equal(0);
    summary.percent.should.be.equal(100);
  });

  it('should fail to provide uncovered code regions for an unhandled source file', () => {
    const collector = new CoverageCollector(s.buildFakeStreamBuilder(s.buildValidLlvmCoverageJsonObjectStream));
    const sourceFilePath = '/an/unhandled/source/file.cpp';
    const regions = collector.collectFor(sourceFilePath).uncoveredRegions();
    const iterate = async () => { for await (const _region of regions); };

    return iterate().should.eventually.be.rejectedWith('Cannot find any uncovered code regions for the file ' +
      `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);
  });
});