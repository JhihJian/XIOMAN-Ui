/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync as _mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { application } from '../common/ipcBridge';
import type { TMessage } from '@/common/chatLib';
import type { IChatConversationRefer, IConfigStorageRefer, IEnvStorageRefer, IMcpServer, TChatConversation, TProviderWithModel } from '../common/storage';
import { ChatMessageStorage, ChatStorage, ConfigStorage, EnvStorage } from '../common/storage';
import { copyDirectoryRecursively, ensureDirectory, getConfigPath, getDataPath, getTempPath, verifyDirectoryFiles } from './utils';
import { getDatabase } from './database/export';
// Platform and architecture types (moved from deleted updateConfig)
type PlatformType = 'win32' | 'darwin' | 'linux';
type ArchitectureType = 'x64' | 'arm64' | 'ia32' | 'arm';

const nodePath = path;

const STORAGE_PATH = {
  config: 'aionui-config.txt',
  chatMessage: 'aionui-chat-message.txt',
  chat: 'aionui-chat.txt',
  env: '.aionui-env',
  assistants: 'assistants',
  skills: 'skills',
};

const getHomePage = getConfigPath;

const mkdirSync = (path: string) => {
  return _mkdirSync(path, { recursive: true });
};

/**
 * 迁移老版本数据从temp目录到userData/config目录
 */
const migrateLegacyData = async () => {
  const oldDir = getTempPath(); // 老的temp目录
  const newDir = getConfigPath(); // 新的userData/config目录

  try {
    // 检查新目录是否为空（不存在或者存在但无内容）
    const isNewDirEmpty =
      !existsSync(newDir) ||
      (() => {
        try {
          return existsSync(newDir) && readdirSync(newDir).length === 0;
        } catch (error) {
          console.warn('[AionUi] Warning: Could not read new directory during migration check:', error);
          return false; // 假设非空以避免迁移覆盖
        }
      })();

    // 检查迁移条件：老目录存在且新目录为空
    if (existsSync(oldDir) && isNewDirEmpty) {
      // 创建目标目录
      mkdirSync(newDir);

      // 复制所有文件和文件夹
      await copyDirectoryRecursively(oldDir, newDir);

      // 验证迁移是否成功
      const isVerified = await verifyDirectoryFiles(oldDir, newDir);
      if (isVerified) {
        // 确保不会删除相同的目录
        if (path.resolve(oldDir) !== path.resolve(newDir)) {
          try {
            await fs.rm(oldDir, { recursive: true });
          } catch (cleanupError) {
            console.warn('[AionUi] 原目录清理失败，请手动删除:', oldDir, cleanupError);
          }
        }
      }

      return true;
    }
  } catch (error) {
    console.error('[AionUi] 数据迁移失败:', error);
  }

  return false;
};

const WriteFile = (path: string, data: string) => {
  return fs.writeFile(path, data);
};

const ReadFile = (path: string) => {
  return fs.readFile(path);
};

const RmFile = (path: string) => {
  return fs.rm(path, { recursive: true });
};

const CopyFile = (src: string, dest: string) => {
  return fs.copyFile(src, dest);
};

const FileBuilder = (file: string) => {
  const stack: (() => Promise<unknown>)[] = [];
  let isRunning = false;
  const run = () => {
    if (isRunning || !stack.length) return;
    isRunning = true;
    void stack
      .shift()?.()
      .finally(() => {
        isRunning = false;
        run();
      });
  };
  const pushStack = <R>(fn: () => Promise<R>) => {
    return new Promise<R>((resolve, reject) => {
      stack.push(() => fn().then(resolve).catch(reject));
      run();
    });
  };
  return {
    path: file,
    write(data: string) {
      return pushStack(() => WriteFile(file, data));
    },
    read() {
      return pushStack(() =>
        ReadFile(file).then((data) => {
          return data.toString();
        })
      );
    },
    copy(dist: string) {
      return pushStack(() => CopyFile(file, dist));
    },
    rm() {
      return pushStack(() => RmFile(file));
    },
  };
};

const JsonFileBuilder = <S extends object = Record<string, unknown>>(path: string) => {
  const file = FileBuilder(path);
  const encode = (data: unknown) => {
    return btoa(encodeURIComponent(String(data)));
  };

  const decode = (base64: string) => {
    return decodeURIComponent(atob(base64));
  };

  const toJson = async (): Promise<S> => {
    try {
      const result = await file.read();
      if (!result) return {} as S;

      // 验证文件内容不为空且不是损坏的base64
      if (result.trim() === '') {
        console.warn(`[Storage] Empty file detected: ${path}`);
        return {} as S;
      }

      const decoded = decode(result);
      if (!decoded || decoded.trim() === '') {
        console.warn(`[Storage] Empty or corrupted content after decode: ${path}`);
        return {} as S;
      }

      const parsed = JSON.parse(decoded) as S;

      // 额外验证：如果是聊天历史文件且解析结果为空对象，警告用户
      if (path.includes('chat.txt') && Object.keys(parsed).length === 0) {
        console.warn(`[Storage] Chat history file appears to be empty: ${path}`);
      }

      return parsed;
    } catch (e) {
      // console.error(`[Storage] Error reading/parsing file ${path}:`, e);
      return {} as S;
    }
  };

  const setJson = async (data: S): Promise<S> => {
    try {
      await file.write(encode(JSON.stringify(data)));
      return data;
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const toJsonSync = (): S => {
    try {
      return JSON.parse(decode(readFileSync(path).toString())) as S;
    } catch (e) {
      return {} as S;
    }
  };

  return {
    toJson,
    setJson,
    toJsonSync,
    async set<K extends keyof S>(key: K, value: Awaited<S>[K]): Promise<Awaited<S>[K]> {
      const data = await toJson();
      data[key] = value;
      await setJson(data);
      return value;
    },
    async get<K extends keyof S>(key: K): Promise<Awaited<S>[K]> {
      const data = await toJson();
      return data[key] as Awaited<S>[K];
    },
    async remove<K extends keyof S>(key: K) {
      const data = await toJson();
      delete data[key];
      return setJson(data);
    },
    clear() {
      return setJson({} as S);
    },
    getSync<K extends keyof S>(key: K): S[K] {
      const data = toJsonSync();
      return data[key];
    },
    update<K extends keyof S>(key: K, updateFn: (value: S[K], data: S) => Promise<S[K]>) {
      return toJson().then((data) => {
        return updateFn(data[key], data).then((value) => {
          data[key] = value;
          return setJson(data);
        });
      });
    },
    backup(fullName: string) {
      const dir = nodePath.dirname(fullName);
      if (!existsSync(dir)) {
        mkdirSync(dir);
      }
      return file.copy(fullName).then(() => file.rm());
    },
  };
};

const envFile = JsonFileBuilder<IEnvStorageRefer>(path.join(getHomePage(), STORAGE_PATH.env));

const dirConfig = envFile.getSync('aionui.dir');

const cacheDir = dirConfig?.cacheDir || getHomePage();

const configFile = JsonFileBuilder<IConfigStorageRefer>(path.join(cacheDir, STORAGE_PATH.config));
type ConversationHistoryData = Record<string, TMessage[]>;

const _chatMessageFile = JsonFileBuilder<ConversationHistoryData>(path.join(cacheDir, STORAGE_PATH.chatMessage));
const _chatFile = JsonFileBuilder<IChatConversationRefer>(path.join(cacheDir, STORAGE_PATH.chat));

// 创建带字段迁移的聊天历史代理
const chatFile = {
  ..._chatFile,
  async get<K extends keyof IChatConversationRefer>(key: K): Promise<IChatConversationRefer[K]> {
    const data = await _chatFile.get(key);
    return data;
  },
  async set<K extends keyof IChatConversationRefer>(key: K, value: IChatConversationRefer[K]): Promise<IChatConversationRefer[K]> {
    return await _chatFile.set(key, value);
  },
};

const buildMessageListStorage = (conversation_id: string, dir: string) => {
  const fullName = path.join(dir, 'aionui-chat-history', conversation_id + '.txt');
  if (!existsSync(fullName)) {
    mkdirSync(path.join(dir, 'aionui-chat-history'));
  }
  return JsonFileBuilder<TMessage[]>(path.join(dir, 'aionui-chat-history', conversation_id + '.txt'));
};

const conversationHistoryProxy = (options: typeof _chatMessageFile, dir: string) => {
  return {
    ...options,
    async set(key: string, data: TMessage[]) {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      return await storage.setJson(data);
    },
    async get(key: string): Promise<TMessage[]> {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      const data = await storage.toJson();
      if (Array.isArray(data)) return data;
      return [];
    },
    backup(conversation_id: string) {
      const storage = buildMessageListStorage(conversation_id, dir);
      return storage.backup(path.join(dir, 'aionui-chat-history', 'backup', conversation_id + '_' + Date.now() + '.txt'));
    },
  };
};

const chatMessageFile = conversationHistoryProxy(_chatMessageFile, cacheDir);

/**
 * 获取助手规则目录路径
 * Get assistant rules directory path
 */
const getAssistantsDir = () => {
  return path.join(cacheDir, STORAGE_PATH.assistants);
};

/**
 * 获取技能脚本目录路径
 * Get skills scripts directory path
 */
const getSkillsDir = () => {
  return path.join(cacheDir, STORAGE_PATH.skills);
};

/**
 * 获取内置技能目录路径（_builtin 子目录）
 * Get builtin skills directory path (_builtin subdirectory)
 * Skills in this directory are automatically injected for ALL agents and scenarios
 */
const getBuiltinSkillsDir = () => {
  return path.join(getSkillsDir(), '_builtin');
};

/**
 * 创建默认的 MCP 服务器配置
 */
const getDefaultMcpServers = (): IMcpServer[] => {
  const now = Date.now();
  const defaultConfig = {
    mcpServers: {
      'chrome-devtools': {
        command: 'npx',
        args: ['-y', 'chrome-devtools-mcp@latest'],
      },
    },
  };

  return Object.entries(defaultConfig.mcpServers).map(([name, config], index) => ({
    id: `mcp_default_${now}_${index}`,
    name,
    description: `Default MCP server: ${name}`,
    enabled: false, // 默认不启用，让用户手动开启
    transport: {
      type: 'stdio' as const,
      command: config.command,
      args: config.args,
    },
    createdAt: now,
    updatedAt: now,
    originalJson: JSON.stringify({ [name]: config }, null, 2),
  }));
};

/**
 * 启动时清理异常遗留的健康检测临时会话
 * Cleanup orphaned health-check temporary conversations on startup
 */
const cleanupOrphanedHealthCheckConversations = () => {
  try {
    const db = getDatabase();
    const pageSize = 1000;
    const idsToDelete: string[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = db.getUserConversations(undefined, page, pageSize);
      result.data.forEach((conversation) => {
        const extra = conversation.extra as { isHealthCheck?: boolean } | undefined;
        if (extra?.isHealthCheck === true) {
          idsToDelete.push(conversation.id);
        }
      });
      hasMore = result.hasMore;
      page += 1;
    }

    let deletedCount = 0;
    idsToDelete.forEach((id) => {
      const deleted = db.deleteConversation(id);
      if (deleted.success && deleted.data) {
        deletedCount += 1;
      }
    });

    if (deletedCount > 0) {
      console.log(`[AionUi] Cleaned up ${deletedCount} orphaned health-check conversation(s) on startup`);
    }
  } catch (error) {
    console.warn('[AionUi] Failed to cleanup orphaned health-check conversations:', error);
  }
};

const initStorage = async () => {
  console.log('[AionUi] Starting storage initialization...');

  // 1. 先执行数据迁移（在任何目录创建之前）
  await migrateLegacyData();

  // 2. 创建必要的目录（迁移后再创建，确保迁移能正常进行）
  // Use ensureDirectory to handle cases where a regular file blocks the path (#841)
  ensureDirectory(getHomePage());
  ensureDirectory(getDataPath());

  // 3. 初始化存储系统
  ConfigStorage.interceptor(configFile);
  ChatStorage.interceptor(chatFile);
  ChatMessageStorage.interceptor(chatMessageFile);
  EnvStorage.interceptor(envFile);

  // 4. 初始化 MCP 配置（为所有用户提供默认配置）
  try {
    const existingMcpConfig = await configFile.get('mcp.config').catch((): undefined => undefined);

    // 仅当配置不存在或为空时，写入默认值（适用于新用户和老用户）
    if (!existingMcpConfig || !Array.isArray(existingMcpConfig) || existingMcpConfig.length === 0) {
      const defaultServers = getDefaultMcpServers();
      await configFile.set('mcp.config', defaultServers);
      console.log('[AionUi] Default MCP servers initialized');
    }
  } catch (error) {
    console.error('[AionUi] Failed to initialize default MCP servers:', error);
  }
  // 5. 初始化助手配置（简化版）
  // 5. Initialize agents config (simplified)
  try {
    const existingAgents = (await configFile.get('acp.customAgents').catch(() => undefined)) || [];

    // 如果没有任何助手，设置空数组（首次启动时平台会自动处理）
    // If no agents configured, set empty array (platform will provide defaults on first startup)
    if (existingAgents.length === 0) {
      await configFile.set('acp.customAgents', []);
      console.log('[AionUi] No agents configured, platform will provide defaults');
    }
  } catch (error) {
    console.error('[AionUi] Failed to initialize agents config:', error);
  }

  // 6. 初始化数据库（better-sqlite3）
  try {
    getDatabase();
    cleanupOrphanedHealthCheckConversations();
  } catch (error) {
    console.error('[InitStorage] Database initialization failed, falling back to file-based storage:', error);
  }

  application.systemInfo.provider(() => {
    return Promise.resolve(getSystemDir());
  });
};

export const ProcessConfig = configFile;

export const ProcessChat = chatFile;

export const ProcessChatMessage = chatMessageFile;

export const ProcessEnv = envFile;

export const getSystemDir = () => {
  return {
    cacheDir: cacheDir,
    // getDataPath() returns CLI-safe path (symlink on macOS) to avoid spaces
    // getDataPath() 返回 CLI 安全路径（macOS 上的符号链接）以避免空格问题
    workDir: dirConfig?.workDir || getDataPath(),
    platform: process.platform as PlatformType,
    arch: process.arch as ArchitectureType,
  };
};

/**
 * 获取助手规则目录路径（供其他模块使用）
 * Get assistant rules directory path (for use by other modules)
 */
export { getAssistantsDir, getSkillsDir, getBuiltinSkillsDir };

/**
 * Skills 内容缓存，避免重复从文件系统读取
 * Skills content cache to avoid repeated file system reads
 */
const skillsContentCache = new Map<string, string>();

/**
 * 加载指定 skills 的内容（带缓存）
 * Load content of specified skills (with caching)
 * @param enabledSkills - skill 名称列表 / list of skill names
 * @returns 合并后的 skills 内容 / merged skills content
 */
export const loadSkillsContent = async (enabledSkills: string[]): Promise<string> => {
  if (!enabledSkills || enabledSkills.length === 0) {
    return '';
  }

  // 使用排序后的 skill 名称作为缓存 key，确保相同组合命中缓存
  // Use sorted skill names as cache key to ensure same combinations hit cache
  const cacheKey = [...enabledSkills].sort().join(',');
  const cached = skillsContentCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const skillsDir = getSkillsDir();
  const builtinSkillsDir = getBuiltinSkillsDir();
  const skillContents: string[] = [];

  for (const skillName of enabledSkills) {
    // 优先尝试内置 skills 目录：_builtin/{skillName}/SKILL.md
    // First try builtin skills directory: _builtin/{skillName}/SKILL.md
    const builtinSkillFile = path.join(builtinSkillsDir, skillName, 'SKILL.md');
    // 然后尝试目录结构：{skillName}/SKILL.md（与 aioncli-core 的 loadSkillsFromDir 一致）
    // Then try directory structure: {skillName}/SKILL.md (consistent with aioncli-core's loadSkillsFromDir)
    const skillDirFile = path.join(skillsDir, skillName, 'SKILL.md');
    // 向后兼容：扁平结构 {skillName}.md
    // Backward compatible: flat structure {skillName}.md
    const skillFlatFile = path.join(skillsDir, `${skillName}.md`);

    try {
      let content: string | null = null;

      if (existsSync(builtinSkillFile)) {
        content = await fs.readFile(builtinSkillFile, 'utf-8');
      } else if (existsSync(skillDirFile)) {
        content = await fs.readFile(skillDirFile, 'utf-8');
      } else if (existsSync(skillFlatFile)) {
        content = await fs.readFile(skillFlatFile, 'utf-8');
      }

      if (content && content.trim()) {
        skillContents.push(`## Skill: ${skillName}\n${content}`);
      }
    } catch (error) {
      console.warn(`[AionUi] Failed to load skill ${skillName}:`, error);
    }
  }

  const result = skillContents.length === 0 ? '' : `[Available Skills]\n${skillContents.join('\n\n')}`;

  // 缓存结果 / Cache result
  skillsContentCache.set(cacheKey, result);

  return result;
};

/**
 * 清除 skills 缓存（在 skills 文件更新后调用）
 * Clear skills cache (call after skills files are updated)
 */
export const clearSkillsCache = (): void => {
  skillsContentCache.clear();
};

export default initStorage;
