const puppeteer = tryRequire('puppeteer');

function tryRequire(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

function ensurePuppeteer() {
  if (!puppeteer) {
    throw new Error('puppeteer 未安装，请在 openclaw 目录执行 npm install puppeteer');
  }
  return puppeteer;
}

/**
 * 浏览器自动化模块
 */
class BrowserOperations {
  constructor() {
    this.browser = null;
    this.pages = new Map();
    this.currentPageId = null;
  }

  async launch(params = {}) {
    const { headless = false, width = 1280, height = 720 } = params;

    try {
      if (this.browser) {
        throw new Error('浏览器已启动');
      }

      const browserLib = ensurePuppeteer();
      this.browser = await browserLib.launch({
        headless: headless,
        args: [`--window-size=${width},${height}`],
        defaultViewport: {
          width: width,
          height: height
        }
      });

      return {
        success: true,
        headless: headless
      };
    } catch (error) {
      throw new Error(`启动浏览器失败: ${error.message}`);
    }
  }

  async close() {
    try {
      if (!this.browser) {
        throw new Error('浏览器未启动');
      }

      // Clean up page references before closing
      for (const [id, page] of this.pages) {
        try { await page.close(); } catch {}
      }

      await this.browser.close();
      this.browser = null;
      this.pages.clear();
      this.currentPageId = null;

      return {
        success: true
      };
    } catch (error) {
      throw new Error(`关闭浏览器失败: ${error.message}`);
    }
  }

  async open(params) {
    const { url, pageId } = params;

    if (!url) {
      throw new Error('缺少参数: url');
    }

    try {
      if (!this.browser) {
        await this.launch();
      }

      const page = await this.browser.newPage();
      const id = pageId || `page_${Date.now()}`;

      this.pages.set(id, page);
      this.currentPageId = id;

      await page.goto(url, { waitUntil: 'networkidle2' });

      return {
        success: true,
        pageId: id,
        url: url,
        title: await page.title()
      };
    } catch (error) {
      throw new Error(`打开页面失败: ${error.message}`);
    }
  }

  async click(params) {
    const { selector, pageId } = params;

    if (!selector) {
      throw new Error('缺少参数: selector');
    }

    try {
      const page = this.getPage(pageId);
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);

      return {
        success: true,
        selector: selector
      };
    } catch (error) {
      throw new Error(`点击元素失败: ${error.message}`);
    }
  }

  async input(params) {
    const { selector, text, pageId } = params;

    if (!selector || text === undefined) {
      throw new Error('缺少参数: selector 或 text');
    }

    try {
      const page = this.getPage(pageId);
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.type(selector, text);

      return {
        success: true,
        selector: selector,
        text: text
      };
    } catch (error) {
      throw new Error(`输入文本失败: ${error.message}`);
    }
  }

  async extract(params) {
    const { selector, attribute = 'textContent', pageId } = params;

    if (!selector) {
      throw new Error('缺少参数: selector');
    }

    try {
      const page = this.getPage(pageId);
      await page.waitForSelector(selector, { timeout: 5000 });

      const content = await page.evaluate((sel, attr) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        if (attr === 'textContent') {
          return element.textContent.trim();
        } else if (attr === 'innerHTML') {
          return element.innerHTML;
        } else {
          return element.getAttribute(attr);
        }
      }, selector, attribute);

      return {
        success: true,
        selector: selector,
        attribute: attribute,
        content: content
      };
    } catch (error) {
      throw new Error(`提取内容失败: ${error.message}`);
    }
  }

  async screenshot(params) {
    const { path, fullPage = false, pageId } = params;

    if (!path) {
      throw new Error('缺少参数: path');
    }

    try {
      const page = this.getPage(pageId);
      await page.screenshot({ path: path, fullPage: fullPage });

      return {
        success: true,
        path: path,
        fullPage: fullPage
      };
    } catch (error) {
      throw new Error(`截图失败: ${error.message}`);
    }
  }

  async waitFor(params) {
    const { selector, timeout = 5000, pageId } = params;

    if (!selector) {
      throw new Error('缺少参数: selector');
    }

    try {
      const page = this.getPage(pageId);
      await page.waitForSelector(selector, { timeout: timeout });

      return {
        success: true,
        selector: selector
      };
    } catch (error) {
      throw new Error(`等待元素失败: ${error.message}`);
    }
  }

  async evaluate(params) {
    const { code, pageId } = params;

    if (!code || typeof code !== 'string') {
      throw new Error('缺少参数: code (must be a string)');
    }

    // Basic validation: reject obviously dangerous patterns
    if (/\b(require|child_process|fs\.\w*Sync|process\.exit)\s*\(/i.test(code)) {
      throw new Error('evaluate() does not allow Node.js built-in module access');
    }

    try {
      const page = this.getPage(pageId);
      const result = await page.evaluate(code);

      return {
        success: true,
        result: result
      };
    } catch (error) {
      throw new Error(`执行 JavaScript 失败: ${error.message}`);
    }
  }

  async navigate(params) {
    const { url, pageId } = params;

    if (!url) {
      throw new Error('缺少参数: url');
    }

    try {
      const page = this.getPage(pageId);
      await page.goto(url, { waitUntil: 'networkidle2' });

      return {
        success: true,
        url: url,
        title: await page.title()
      };
    } catch (error) {
      throw new Error(`导航失败: ${error.message}`);
    }
  }

  getPage(pageId) {
    const id = pageId || this.currentPageId;
    if (!id || !this.pages.has(id)) {
      throw new Error('页面不存在，请先打开页面');
    }
    return this.pages.get(id);
  }
}

module.exports = BrowserOperations;
