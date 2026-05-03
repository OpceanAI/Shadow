import { ProjectInfo, FileInfo, DependencyGraph } from '../types';

export function toJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printJSON(data: unknown): void {
  console.log(toJSON(data));
}

export function projectInfoToJSON(info: ProjectInfo): object {
  return {
    shadow: true,
    type: 'project_info',
    ...info,
  };
}

export function fileInfoToJSON(info: FileInfo): object {
  return {
    shadow: true,
    type: 'file_info',
    ...info,
  };
}

export function graphToJSON(graph: DependencyGraph): object {
  return {
    shadow: true,
    type: 'dependency_graph',
    ...graph,
  };
}
