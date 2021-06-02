import { extensionName } from '../../extension-name';

import { Readable } from 'stream';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';

export type LLVMCoverageInfoStreamBuilder = {
  makeLLVMCoverageInfoStream(): Readable;
};

export type Summary = {
  count: number;
  covered: number;
  notCovered: number;
  percent: number;
};

type UncoveredRegions = [number, number, number, number, number, number, number, number];

type UncoveredRegionsIterator = {
  done: boolean,
  value?: UncoveredRegions
};

type UncoveredRegionsAsyncIterator = {
  [Symbol.asyncIterator](): {
    next(): Promise<UncoveredRegionsIterator>;
    last: UncoveredRegions | undefined;
  }
};

export type CoverageInfo = {
  summary(): Promise<Summary>,
  uncoveredRegions(): UncoveredRegionsAsyncIterator
};

// TODO : refacto private stuff
export class CoverageCollector {
  constructor(llvmCoverageInfoStreamBuilder: LLVMCoverageInfoStreamBuilder) {
    this.llvmCoverageInfoStreamBuilder = llvmCoverageInfoStreamBuilder;
  }

  collectFor(sourceFilePath: string): CoverageInfo {
    return {
      summary: () => this.coverageSummaryFor(sourceFilePath),
      uncoveredRegions: () => this.uncoveredRegionsFor(sourceFilePath)
    };
  }

  private coverageSummaryFor(sourceFilePath: string) {
    const pipeline = chain([
      this.llvmCoverageInfoStreamBuilder.makeLLVMCoverageInfoStream(),
      parser({ streamValues: true }),
      pick({ filter: 'data' }),
      streamArray(),
      dataItem => {
        if (dataItem.key !== 0)
          return null;

        const files = dataItem.value.files;

        return files.find((file: any) => file.filename === sourceFilePath);
      }
    ]);

    return new Promise<Summary>((resolve, reject) => {
      let summary: any;

      pipeline
        .once('data', chunk => { summary = chunk.summary.regions; })
        .once('end', () => {
          if (summary)
            resolve({
              count: summary.count,
              covered: summary.covered,
              notCovered: summary.notcovered,
              percent: summary.percent
            });
          else
            reject('Cannot find any summary coverage info for the file ' +
              `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);
        })
        .once('error', err => {
          reject(new Error('Invalid coverage information file have been found in the build tree directory. ' +
            'Coverage information file must contain llvm coverage report in json format. ' +
            'Ensure that both ' +
            `'${extensionName}: Build Tree Directory' and '${extensionName}: Coverage Info File Name' ` +
            'settings are correctly set.' + err.message));
        });
    });
  }

  private uncoveredRegionsFor(sourceFilePath: string): UncoveredRegionsAsyncIterator {
    const pipeline = chain([
      this.llvmCoverageInfoStreamBuilder.makeLLVMCoverageInfoStream(),
      parser({ streamValues: true }),
      pick({ filter: 'data' }),
      streamArray(),
      dataItem => {
        if (dataItem.key !== 0)
          return null;

        const functions = dataItem.value.functions;

        const fn = functions.find((f: { filenames: ReadonlyArray<string> }) => f.filenames[0] === sourceFilePath);

        return fn?.regions;
      }
    ]);

    return {
      [Symbol.asyncIterator]() {
        return {
          last: undefined,

          async next(): Promise<UncoveredRegionsIterator> {
            await new Promise<void>((resolve, reject) => {
              pipeline
                .once('readable', () => { resolve(); })
                .once('end', () => { resolve(); })
                .once('error', err => {
                  reject(new Error('Invalid coverage information file have been found in the build tree directory. ' +
                    'Coverage information file must contain llvm coverage report in json format. ' +
                    'Ensure that both ' +
                    `'${extensionName}: Build Tree Directory' and '${extensionName}: Coverage Info File Name' ` +
                    'settings are correctly set.' + err.message));
                });
            });

            const uncoveredRegions = <UncoveredRegions>pipeline.read(1);

            if (uncoveredRegions === null)
              if (this.last)
                return new Promise<UncoveredRegionsIterator>(resolve => { resolve({ done: true }); });
              else
                return Promise.reject('Cannot find any uncovered code regions for the file ' +
                  `${sourceFilePath}. Ensure this source file is covered by a test in your project.`);

            this.last = uncoveredRegions;

            return new Promise<UncoveredRegionsIterator>(resolve => { resolve({ done: false, value: uncoveredRegions }); });
          }
        };
      }
    };
  }

  private readonly llvmCoverageInfoStreamBuilder: LLVMCoverageInfoStreamBuilder;
};