import * as SettingsProvider from '../../src/domain/services/internal/settings-provider';

import * as BuildSystemGenerator from '../../src/domain/services/internal/build-system-generator';
import * as BuildTreeDirectoryResolver from '../../src/domain/services/internal/build-tree-directory-resolver';
import { Settings } from '../../src/domain/value-objects/settings';
import * as CoverageInfoFileResolver from '../../src/domain/services/internal/coverage-info-file-resolver';
import * as CoverageInfoCollector from '../../src/domain/services/internal/coverage-info-collector';

import * as path from 'path';
import { BigIntStats, MakeDirectoryOptions, PathLike, StatOptions, Stats } from 'fs';
import { Readable } from 'stream';

export namespace workspace {
  type Overrides = {
    -readonly [k in keyof Settings]?: any
  };

  export function buildFakeWorkspaceWithWorkspaceFolderAndOverridableDefaultSettings(overrides: Overrides = {}): SettingsProvider.VscodeWorkspaceLike {
    return new class implements SettingsProvider.VscodeWorkspaceLike {
      constructor(overrides: Overrides) {
        this.overrides = overrides;
      }

      workspaceFolders = [
        new class implements SettingsProvider.VscodeWorkspaceFolderLike {
          uri = new class implements SettingsProvider.VscodeUriLike {
            fsPath = path.resolve('.');
          };
        }];

      getConfiguration(_section?: string) {
        return new class implements SettingsProvider.VscodeWorkspaceConfigurationLike {
          constructor(overrides: Overrides) {
            this.overrides = overrides;
          }

          get<T>(section: keyof Settings): T | undefined {
            if (this.overrides[section] !== undefined)
              return this.overrides[section];

            switch (section) {
              case 'additionalCmakeOptions':
                return [] as unknown as T | undefined;
              case 'buildTreeDirectory':
                return 'build' as unknown as T | undefined;
              case 'cmakeCommand':
                return 'cmake' as unknown as T | undefined;
              case 'cmakeTarget':
                return 'coverage' as unknown as T | undefined;
              case 'coverageInfoFileName':
                return 'coverage.json' as unknown as T | undefined;
              case 'rootDirectory':
                return '.' as unknown as T | undefined;
            }
          }

          private overrides: Overrides;
        }(this.overrides);
      }

      private overrides: Overrides;
    }(overrides);
  }

  export function buildFakeWorkspaceWithoutWorkspaceFolderAndWithoutSettings(): SettingsProvider.VscodeWorkspaceLike {
    return new class implements SettingsProvider.VscodeWorkspaceLike {
      workspaceFolders = undefined;

      getConfiguration(_section?: string) {
        return new class implements SettingsProvider.VscodeWorkspaceConfigurationLike {
          get(_section: string) { return undefined; }
        };
      };
    };
  }
}

export namespace process {
  export function buildFakeFailingProcess() {
    return new class implements BuildSystemGenerator.ProcessLike {
      execFile(
        _file: string,
        _args: readonly string[] | null | undefined,
        _options: BuildSystemGenerator.ExecFileOptionsLike,
        callback: (error: BuildSystemGenerator.ExecFileExceptionLike | null,
          stdout: string, stderr: string) => void): BuildSystemGenerator.ChildProcessLike {
        callback(
          new class implements BuildSystemGenerator.ExecFileExceptionLike {
            message = 'Epic fail!';
          },
          'stdout',
          'stderr');

        return new class implements BuildSystemGenerator.ChildProcessLike { };
      }
    };
  }

  export function buildFakeSucceedingProcess() {
    return new class implements BuildSystemGenerator.ProcessLike {
      execFile(
        _file: string,
        _args: readonly string[] | null | undefined,
        _options: BuildSystemGenerator.ExecFileOptionsLike,
        callback: (error: BuildSystemGenerator.ExecFileExceptionLike | null,
          stdout: string, stderr: string) => void): BuildSystemGenerator.ChildProcessLike {
        callback(null, 'epic success!', '');

        return new class implements BuildSystemGenerator.ChildProcessLike { };
      }
    };
  }
}

export namespace stream {
  export function buildEmptyReadableStream(): Readable {
    const empty = (function* () { })();

    return Readable.from(empty);
  }

  export function buildNotJsonStream(): Readable {
    return Readable.from('foo');
  }

  export function buildInvalidLlvmCoverageJsonObjectStream() {
    return Readable.from(JSON.stringify({
      data: [
        { foo: 'bar' },
        {}
      ]
    }));
  }

  export function buildValidLlvmCoverageJsonObjectStream() {
    return Readable.from(JSON.stringify({
      "data": [
        {
          "files": [
            {
              "filename": "/a/source/file.cpp",
              "summary": {
                "regions": {
                  "count": 2,
                  "covered": 2,
                  "notcovered": 0,
                  "percent": 100
                }
              }
            }
          ],
          "functions": [
            {
              "filenames": [
                "/a/source/file.cpp"
              ],
              "regions": [
                [
                  4,
                  52,
                  4,
                  54,
                  1,
                  0,
                  0,
                  0
                ],
                [
                  6,
                  53,
                  6,
                  71,
                  0,
                  0,
                  0,
                  0
                ]
              ]

            }
          ]
        }
      ],
      "type": "llvm.coverage.json.export",
      "version": "2.0.1"
    }));
  }

  export function buildFakeStreamBuilder(factory: () => Readable) {
    return new class implements CoverageInfoCollector.LLVMCoverageInfoStreamBuilder {
      createStream = (_path: string) => factory();
    };
  }
}

export namespace statFile {
  export function buildFakeFailingStatFile() {
    return new class implements BuildTreeDirectoryResolver.StatFileLike {
      stat(_path: PathLike, _opts?: StatOptions): Promise<Stats | BigIntStats> {
        return Promise.reject();
      }
    };
  }

  export function buildFakeSucceedingStatFile() {
    return new class implements BuildTreeDirectoryResolver.StatFileLike {
      stat(_path: PathLike, _opts?: StatOptions): Promise<Stats | BigIntStats> {
        return Promise.resolve(new Stats());
      }
    };
  }
}

export namespace glob {
  export function buildFakeGlobSearchForNoMatch() {
    return new class implements CoverageInfoFileResolver.GlobSearchLike {
      search(_pattern: string) {
        return Promise.resolve([]);
      }
    };
  }

  export function buildFakeGlobSearchForSeveralMatch() {
    return new class implements CoverageInfoFileResolver.GlobSearchLike {
      search(_pattern: string) {
        return Promise.resolve(['', '']);
      }
    };
  }

  export function buildFakeGlobSearchForExactlyOneMatch() {
    return new class implements CoverageInfoFileResolver.GlobSearchLike {
      search(_pattern: string) {
        return Promise.resolve(['oneMatchShow']);
      }
    };
  }
}

export namespace fs {
  export function buildFakeFailingFs() {
    return new class implements BuildTreeDirectoryResolver.FsLike {
      mkdir(_path: PathLike, _options: MakeDirectoryOptions & { recursive: true; }): Promise<string | undefined> {
        return Promise.reject();
      }
    };
  }

  export function buildFakeSucceedingFs() {
    return new class implements BuildTreeDirectoryResolver.FsLike {
      mkdir(_path: PathLike, _options: MakeDirectoryOptions & { recursive: true; }): Promise<string | undefined> {
        return Promise.resolve('/build/tree/directory');
      }
    };
  }
}