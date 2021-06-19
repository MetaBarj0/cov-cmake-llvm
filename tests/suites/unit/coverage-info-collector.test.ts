import * as chai from 'chai';
import { describe, it } from 'mocha';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
chai.should();

import * as CoverageInfoCollector from '../../../src/domain/services/internal/coverage-info-collector';
import * as definitions from '../../../src/definitions';
import { RegionCoverageInfo } from '../../../src/domain/value-objects/region-coverage-info';

import { vscodeWorkspace as v } from '../../faked-adapters/vscode-workspace';
import { inputStream as i } from '../../faked-adapters/input-stream';
import { globbing as g } from '../../faked-adapters/globbing';
import { progressReporter as pr } from '../../faked-adapters/progress-reporter';
import { errorChannel as e } from '../../faked-adapters/error-channel';

import { Readable } from 'stream';

describe('Unit test suite', () => {
  describe('the coverage info collector behavior', () => {
    describe('with invalid input readable streams', () => {
      describe('collect coverage info summary', shouldFailToCollectCoverageInfoSummaryBecauseOfInvalidStream);
      describe('collect uncovered region coverage info', shouldFailToCollectUncoveredRegionsBecauseOfInvalidStream);
    });
    describe('with a valid input readable stream', () => {
      describe('for an unhandled source file', () => {
        describe('collect coverage info summary', shouldFailToCollectCoverageInfoSummaryBecauseOfUnhandledSourceFile);
        describe('collect uncovered region coverage info', shouldFailToCollectUncoveredRegionsBecauseOfUnhandledSourceFile);
      });
      describe('for a handled source file', () => {
        describe('collect coverage info summary', shouldSucceedToCollectCoverageInfoSummary);
        describe('collect uncovered region coverage info', shouldSucceedToCollectUncoveredRegions);
      });
    });
  });
});

function shouldFailToCollectCoverageInfoSummaryBecauseOfInvalidStream() {
  const collectorsAndErrorChannelSpies = buildCoverageInfoCollectorsAndErrorChannelSpiesUsingStreamFactories([
    i.buildEmptyReadableStream,
    i.buildInvalidLlvmCoverageJsonObjectStream,
    i.buildNotJsonStream
  ]);

  collectorsAndErrorChannelSpies.forEach(async collectorAndErrorChannelSpy => {
    it('should fail to access to coverage info summary and report to error channel', async () => {
      const collector = collectorAndErrorChannelSpy.coverageInfoCollector;
      const errorChannelSpy = collectorAndErrorChannelSpy.errorChannelSpy;

      const coverageInfo = await collector.collectFor('');

      return coverageInfo.summary
        .catch((error: Error) => {
          error.message.should.contain('Invalid coverage information file have been found in the build tree directory. ' +
            'Coverage information file must contain llvm coverage report in json format. ' +
            'Ensure that both ' +
            `'${definitions.extensionNameInSettings}: Build Tree Directory' and ` +
            `'${definitions.extensionNameInSettings}: Coverage Info File Name' ` +
            'settings are correctly set.');

          errorChannelSpy.countFor('appendLine').should.be.equal(1);
        });
    });
  });
}

function shouldFailToCollectUncoveredRegionsBecauseOfInvalidStream() {
  const collectorsAndErrorChannelSpies = buildCoverageInfoCollectorsAndErrorChannelSpiesUsingStreamFactories([
    i.buildEmptyReadableStream,
    i.buildInvalidLlvmCoverageJsonObjectStream,
    i.buildNotJsonStream
  ]);

  collectorsAndErrorChannelSpies.forEach(async collectorAndErrorChannelSpy => {
    it('should fail to access to uncovered regions and report in error channel', async () => {
      const collector = collectorAndErrorChannelSpy.coverageInfoCollector;
      const errorChannelSpy = collectorAndErrorChannelSpy.errorChannelSpy;

      const coverageInfo = await collector.collectFor('');
      const iterateOnUncoveredRegions = async () => { for await (const _region of coverageInfo.uncoveredRegions); };

      return iterateOnUncoveredRegions()
        .catch((error: Error) => {
          error.message.should.contain('Invalid coverage information file have been found in the build tree directory. ' +
            'Coverage information file must contain llvm coverage report in json format. ' +
            'Ensure that both ' +
            `'${definitions.extensionNameInSettings}: Build Tree Directory' and ` +
            `'${definitions.extensionNameInSettings}: Coverage Info File Name' ` +
            'settings are correctly set.');

          errorChannelSpy.countFor('appendLine').should.be.equal(1);
        });
    });
  });
}

function shouldFailToCollectCoverageInfoSummaryBecauseOfUnhandledSourceFile() {
  it('should fail to provide coverage summary for an unhandled source file and report to error channel', async () => {
    const collectorAndSpies = buildCoverageInfoCollectorAndSpiesForProgressReportAndErrorChannel();
    const collector = collectorAndSpies.coverageInfoCollector;
    const errorChannelSpy = collectorAndSpies.errorChannelSpy;

    const sourceFilePath = '/an/unhandled/source/file.cpp';

    const coverageInfo = await collector.collectFor(sourceFilePath);

    return coverageInfo.summary
      .catch((error: Error) => {
        error.message.should.contain('Cannot find any summary coverage info for the file ' +
          `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);

        errorChannelSpy.countFor('appendLine').should.be.equal(1);
      });
  });
}

function shouldFailToCollectUncoveredRegionsBecauseOfUnhandledSourceFile() {
  it('should fail to provide uncovered code regions for an unhandled source file', async () => {
    const collectorAndSpies = buildCoverageInfoCollectorAndSpiesForProgressReportAndErrorChannel();
    const collector = collectorAndSpies.coverageInfoCollector;
    const errorChannelSpy = collectorAndSpies.errorChannelSpy;

    const sourceFilePath = '/an/unhandled/source/file.cpp';
    const coverageInfo = await collector.collectFor(sourceFilePath);
    const iterateOnUncoveredRegions = async () => { for await (const _region of coverageInfo.uncoveredRegions); };

    return iterateOnUncoveredRegions()
      .catch((error: Error) => {
        error.message.should.contain('Cannot find any uncovered code regions for the file ' +
          `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);

        errorChannelSpy.countFor('appendLine').should.be.equal(1);
      });
  });
}

function shouldSucceedToCollectCoverageInfoSummary() {
  it('should succeed in provided summary coverage info for handled source file in 2 discrete steps', async () => {

    const collectorAndSpies = buildCoverageInfoCollectorAndSpiesForProgressReportAndErrorChannel();
    const collector = collectorAndSpies.coverageInfoCollector;
    const progressReporterSpy = collectorAndSpies.progressReporterSpy;

    const coverageInfo = await collector.collectFor('/a/source/file.cpp');

    const summary = await coverageInfo.summary;

    summary.count.should.be.equal(2);
    summary.covered.should.be.equal(2);
    summary.notCovered.should.be.equal(0);
    summary.percent.should.be.equal(100);

    progressReporterSpy.countFor('report').should.be.equal(2);
  });
}

function shouldSucceedToCollectUncoveredRegions() {
  it('should succeed to provide uncovered regions for a handled source file in 2 discrete steps', async () => {

    const collectorAndSpies = buildCoverageInfoCollectorAndSpiesForProgressReportAndErrorChannel();
    const collector = collectorAndSpies.coverageInfoCollector;
    const progressReporterSpy = collectorAndSpies.progressReporterSpy;

    const coverageInfo = await collector.collectFor('/a/source/file.cpp');
    const regions = coverageInfo.uncoveredRegions;

    const uncoveredRegions: Array<RegionCoverageInfo> = [];

    for await (const region of regions)
      uncoveredRegions.push(region);

    uncoveredRegions.length.should.be.equal(1);

    const uncoveredRegion = uncoveredRegions[0];

    uncoveredRegion.range.should.be.deep.equal({
      start: {
        line: 6,
        character: 53
      },
      end: {
        line: 6,
        character: 71
      }
    });

    progressReporterSpy.countFor('report').should.be.equal(2);
  });
}

function buildCoverageInfoCollectorAndSpiesForProgressReportAndErrorChannel() {
  const progressReporterSpy = pr.buildSpyOfProgressReporter(pr.buildFakeProgressReporter());
  const errorChannelSpy = e.buildSpyOfErrorChannel(e.buildFakeErrorChannel());

  const coverageInfoCollector = CoverageInfoCollector.make({
    globSearch: g.buildFakeGlobSearchForExactlyOneMatch(),
    workspace: v.buildFakeWorkspaceWithWorkspaceFolderAndOverridableDefaultSettings(),
    llvmCoverageInfoStreamBuilder: i.buildFakeStreamBuilder(i.buildValidLlvmCoverageJsonObjectStream),
    progressReporter: progressReporterSpy.object,
    errorChannel: errorChannelSpy.object
  });

  return {
    coverageInfoCollector,
    progressReporterSpy,
    errorChannelSpy
  };
}

function buildCoverageInfoCollectorsAndErrorChannelSpiesUsingStreamFactories(streamFactories: ReadonlyArray<StreamFactory>) {
  return streamFactories.map(streamFfactory => {
    const errorChannelSpy = e.buildSpyOfErrorChannel(e.buildFakeErrorChannel());

    const coverageInfoCollector = CoverageInfoCollector.make({
      globSearch: g.buildFakeGlobSearchForExactlyOneMatch(),
      workspace: v.buildFakeWorkspaceWithWorkspaceFolderAndOverridableDefaultSettings(),
      llvmCoverageInfoStreamBuilder: i.buildFakeStreamBuilder(streamFfactory),
      progressReporter: pr.buildFakeProgressReporter(),
      errorChannel: errorChannelSpy.object
    });

    return {
      coverageInfoCollector,
      errorChannelSpy
    };
  });
}

type StreamFactory = () => Readable;