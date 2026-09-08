/**
 * 项目项
 */
export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  folder?: string;
}

/**
 * 文件夹配置项（存储在配置文件中）
 */
export interface FolderConfig {
  name: string;
  icon?: string;
}

/**
 * 文件夹项（用于树视图显示）
 */
export interface FolderItem {
  name: string;
  type: "folder";
  icon?: string;
  projects: ProjectItem[];
}

/**
 * 树项（可以是项目或文件夹）
 */
export type TreeItem = ProjectItem | FolderItem;

/**
 * 完整配置数据结构
 */
export interface ConfigData {
  projects: ProjectItem[];
  folders?: FolderConfig[];
}
