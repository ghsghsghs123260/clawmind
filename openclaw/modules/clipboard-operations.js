const clipboardy = tryRequire('clipboardy');

function tryRequire(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

function ensureClipboardy() {
  if (!clipboardy) {
    throw new Error('clipboardy 未安装，请在 openclaw 目录执行 npm install clipboardy');
  }
  return clipboardy;
}

/**
 * 剪贴板操作模块
 */
class ClipboardOperations {
  /**
   * 读取剪贴板内容
   */
  async read() {
    try {
      const api = ensureClipboardy();
      const content = await api.read();

      return {
        success: true,
        content: content,
        length: content.length
      };
    } catch (error) {
      throw new Error(`读取剪贴板失败: ${error.message}`);
    }
  }

  /**
   * 写入剪贴板
   */
  async write(params) {
    const { content } = params;

    if (content === undefined) {
      throw new Error('缺少参数: content');
    }

    try {
      const api = ensureClipboardy();
      await api.write(String(content));

      return {
        success: true,
        length: String(content).length
      };
    } catch (error) {
      throw new Error(`写入剪贴板失败: ${error.message}`);
    }
  }

  /**
   * 清空剪贴板
   */
  async clear() {
    try {
      const api = ensureClipboardy();
      await api.write('');

      return {
        success: true
      };
    } catch (error) {
      throw new Error(`清空剪贴板失败: ${error.message}`);
    }
  }
}

module.exports = ClipboardOperations;
