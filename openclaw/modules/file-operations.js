const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * 文件操作模块（带路径沙箱）
 */
class FileOperations {
  constructor(sandboxDir = null) {
    this.sandboxDir = sandboxDir ? path.resolve(sandboxDir) : null;
    if (!this.sandboxDir) {
      console.warn('[FileOperations] No sandbox directory configured — file access is unrestricted');
    }
  }

  /**
   * 验证路径不逃逸沙箱
   * @throws 如果路径逃逸沙箱目录
   */
  validatePath(targetPath) {
    if (!this.sandboxDir) return;

    const resolved = path.resolve(targetPath);
    // Normalize: lowercase, forward slashes, strip trailing separator, append /
    const normalized = resolved.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '') + '/';
    const sandbox = this.sandboxDir.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '') + '/';

    if (!normalized.startsWith(sandbox)) {
      throw new Error(`Path escapes sandbox: ${targetPath}`);
    }
  }

  /**
   * 验证两个路径（source + destination）都在沙箱内
   */
  validatePaths(...paths) {
    for (const p of paths) {
      if (p) this.validatePath(p);
    }
  }

  async read(params) {
    const { path: filePath, encoding = 'utf-8' } = params;
    if (!filePath) throw new Error('缺少参数: path');
    this.validatePath(filePath);

    try {
      const content = await fs.readFile(filePath, encoding);
      return {
        success: true,
        path: filePath,
        content: content,
        size: Buffer.byteLength(content, encoding)
      };
    } catch (error) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
  }

  async write(params) {
    const { path: filePath, content, encoding = 'utf-8', append = false } = params;
    if (!filePath) throw new Error('缺少参数: path');
    if (content === undefined) throw new Error('缺少参数: content');
    this.validatePath(filePath);

    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      if (append) {
        await fs.appendFile(filePath, content, encoding);
      } else {
        await fs.writeFile(filePath, content, encoding);
      }

      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, encoding),
        mode: append ? 'append' : 'write'
      };
    } catch (error) {
      throw new Error(`写入文件失败: ${error.message}`);
    }
  }

  async delete(params) {
    const { path: targetPath, recursive = false } = params;
    if (!targetPath) throw new Error('缺少参数: path');
    this.validatePath(targetPath);

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        if (recursive) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.rmdir(targetPath);
        }
      } else {
        await fs.unlink(targetPath);
      }

      return {
        success: true,
        path: targetPath,
        type: stats.isDirectory() ? 'directory' : 'file'
      };
    } catch (error) {
      throw new Error(`删除失败: ${error.message}`);
    }
  }

  async list(params) {
    const { path: dirPath, recursive = false, details = false } = params;
    if (!dirPath) throw new Error('缺少参数: path');
    this.validatePath(dirPath);

    try {
      if (recursive) {
        return await this.listRecursive(dirPath, details);
      } else {
        return await this.listSingle(dirPath, details);
      }
    } catch (error) {
      throw new Error(`列出目录失败: ${error.message}`);
    }
  }

  async listSingle(dirPath, details) {
    const entries = await fs.readdir(dirPath);
    const files = [];

    if (details) {
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        try {
          const stats = await fs.stat(fullPath);
          files.push({
            name: entry,
            path: fullPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          });
        } catch (error) {
          files.push({ name: entry, path: fullPath, error: error.message });
        }
      }
    } else {
      files.push(...entries);
    }

    return { success: true, path: dirPath, count: files.length, files: files };
  }

  async listRecursive(dirPath, details) {
    const files = [];

    const walk = async (currentPath) => {
      const entries = await fs.readdir(currentPath);
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry);
        try {
          const stats = await fs.stat(fullPath);
          if (details) {
            files.push({
              name: entry, path: fullPath,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size, modified: stats.mtime, created: stats.birthtime
            });
          } else {
            files.push(fullPath);
          }
          if (stats.isDirectory()) await walk(fullPath);
        } catch (error) { /* skip */ }
      }
    };

    await walk(dirPath);
    return { success: true, path: dirPath, count: files.length, files: files };
  }

  async search(params) {
    const { path: searchPath, pattern, content = false, maxResults = 100 } = params;
    if (!searchPath) throw new Error('缺少参数: path');
    if (!pattern) throw new Error('缺少参数: pattern');
    this.validatePath(searchPath);

    try {
      const results = [];
      const regex = new RegExp(pattern, 'i');

      const searchDir = async (currentPath) => {
        if (results.length >= maxResults) return;
        const entries = await fs.readdir(currentPath);

        for (const entry of entries) {
          if (results.length >= maxResults) break;
          const fullPath = path.join(currentPath, entry);

          try {
            const stats = await fs.stat(fullPath);

            if (regex.test(entry)) {
              results.push({
                path: fullPath, name: entry,
                type: stats.isDirectory() ? 'directory' : 'file',
                matchType: 'filename'
              });
            }

            if (content && stats.isFile() && stats.size < 1024 * 1024) {
              try {
                const fileContent = await fs.readFile(fullPath, 'utf-8');
                if (regex.test(fileContent)) {
                  results.push({ path: fullPath, name: entry, type: 'file', matchType: 'content' });
                }
              } catch (error) { /* skip */ }
            }

            if (stats.isDirectory()) await searchDir(fullPath);
          } catch (error) { /* skip */ }
        }
      };

      await searchDir(searchPath);
      return { success: true, path: searchPath, pattern, count: results.length, results: results };
    } catch (error) {
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  async copy(params) {
    const { source, destination, overwrite = false } = params;
    if (!source || !destination) throw new Error('缺少参数: source 或 destination');
    this.validatePaths(source, destination);

    try {
      if (!overwrite && fsSync.existsSync(destination)) {
        throw new Error('目标已存在，使用 overwrite: true 覆盖');
      }

      const stats = await fs.stat(source);
      if (stats.isDirectory()) {
        await fs.cp(source, destination, { recursive: true, force: overwrite });
      } else {
        await fs.copyFile(source, destination);
      }

      return { success: true, source, destination, type: stats.isDirectory() ? 'directory' : 'file' };
    } catch (error) {
      throw new Error(`复制失败: ${error.message}`);
    }
  }

  async move(params) {
    const { source, destination } = params;
    if (!source || !destination) throw new Error('缺少参数: source 或 destination');
    this.validatePaths(source, destination);

    try {
      await fs.rename(source, destination);
      return { success: true, source, destination };
    } catch (error) {
      throw new Error(`移动失败: ${error.message}`);
    }
  }

  async info(params) {
    const { path: filePath } = params;
    if (!filePath) throw new Error('缺少参数: path');
    this.validatePath(filePath);

    try {
      const stats = await fs.stat(filePath);
      return {
        success: true,
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        accessed: stats.atime,
        permissions: stats.mode.toString(8).slice(-3)
      };
    } catch (error) {
      throw new Error(`获取文件信息失败: ${error.message}`);
    }
  }
}

module.exports = FileOperations;
