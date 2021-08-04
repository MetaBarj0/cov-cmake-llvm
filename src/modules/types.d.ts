import * as BuildTreeDirectoryResolverModule from "./abstractions/build-tree-directory-resolver/build-tree-directory-resolver";
import * as SettingsModule from "./abstractions/settings-provider/settings";
import * as FileSytemModule from "../adapters/abstractions/node/file-system";
import * as VscodeModule from "../adapters/abstractions/vscode/output-channel";
import * as CmakeModule from "./abstractions/cmake/cmake";
import * as AbstractProcessControl from "../adapters/abstractions/node/process-control";
import * as CoverageInfoFileResolverModule from "./abstractions/coverage-info-file-resolver/coverage-info-file-resolver";
import * as FileSystemModule from "../adapters/abstractions/node/file-system";
import * as CoverageInfoProviderModule from "./abstractions/coverage-info-provider/coverage-info-provider";
import * as CoverageInfoCollectorModule from "./abstractions/coverage-info-collector/coverage-info-collector";
import * as AbstractRegionCoverageInfoModule from "./abstractions/coverage-info-collector/region-coverage-info";
import * as AbstractCoverageSummaryModule from "./abstractions/coverage-info-collector/coverage-summary";
import * as AbstractCoverageInfoModule from "./abstractions/coverage-info-collector/coverage-info";
import * as SettingsProviderModule from "./abstractions/settings-provider/settings-provider";

export namespace Modules {
  export type BuildTreeDirectoryResolver = BuildTreeDirectoryResolverModule.BuildTreeDirectoryResolver;
  export type Cmake = CmakeModule.Cmake;
  export type CoverageInfoCollector = CoverageInfoCollectorModule.CoverageInfoCollector;
  export type CoverageInfoFileResolver = CoverageInfoFileResolverModule.CoverageInfoFileResolver;
  export type CoverageInfoProvider = CoverageInfoProviderModule.CoverageInfoProvider;
  export type Settings = SettingsModule.Settings;
  export type SettingsProvider = SettingsProviderModule.SettingsProvider;
  export type RegionCoverageInfo = AbstractRegionCoverageInfoModule.RegionCoverageInfo;
  export type RegionRange = AbstractRegionCoverageInfoModule.RegionRange;
  export type CoverageInfo = AbstractCoverageInfoModule.CoverageInfo;
  export type CoverageSummary = AbstractCoverageSummaryModule.CoverageSummary;
  export type RawLLVMRegionCoverageInfo = AbstractRegionCoverageInfoModule.RawLLVMRegionCoverageInfo;
  export type RawLLVMFunctionCoverageInfo = AbstractRegionCoverageInfoModule.RawLLVMFunctionCoverageInfo;
  export type RawLLVMRegionsCoverageInfo = AbstractRegionCoverageInfoModule.RawLLVMRegionsCoverageInfo;
  export type RawLLVMFileCoverageInfo = AbstractRegionCoverageInfoModule.RawLLVMFileCoverageInfo;
  export type RawLLVMStreamedDataItemCoverageInfo = AbstractRegionCoverageInfoModule.RawLLVMStreamedDataItemCoverageInfo;
}

export namespace Adapters {
  export namespace fileSystem {
    export type CreateReadStreamCallable = FileSystemModule.CreateReadStreamCallable;
    export type GlobSearchCallable = FileSystemModule.GlobSearchCallable;
    export type MkdirCallable = FileSytemModule.MkdirCallable;
    export type StatCallable = FileSytemModule.StatCallable;
  }

  export namespace vscode {
    export type ProgressLike = VscodeModule.ProgressLike;
    export type OutputChannelLike = VscodeModule.OutputChannelLike;
    export type VscodeWorkspaceLike = VscodeModule.VscodeWorkspaceLike;
    export type VscodeWorkspaceFolderLike = VscodeModule.VscodeWorkspaceFolderLike;
  }

  export namespace processControl {
    export type ExecFileCallable = AbstractProcessControl.ExecFileCallable;
  }
}
