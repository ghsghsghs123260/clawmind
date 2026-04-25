const notifier = tryRequire('node-notifier');
const path = require('path');
const fsSync = require('fs');

function tryRequire(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

/**
 * 通知系统
 * 用于发送桌面通知、任务完成提醒等
 */
class NotificationSystem {
  constructor() {
    this.enabled = true;
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * 发送通知
   */
  async send(options) {
    const {
      title = 'ClawMind',
      message,
      type = 'info',
      sound = true,
      wait = false
    } = options;

    if (!message) {
      throw new Error('缺少参数: message');
    }

    if (!this.enabled) {
      return {
        success: false,
        reason: 'notifications_disabled'
      };
    }

    if (!notifier) {
      return {
        success: false,
        reason: 'node_notifier_missing'
      };
    }

    try {
      await new Promise((resolve, reject) => {
        notifier.notify({
          title: title,
          message: message,
          sound: sound,
          wait: wait,
          icon: this.getIcon(type)
        }, (err, response) => {
          if (err) reject(err);
          else resolve(response);
        });
      });

      this.addToHistory({
        title: title,
        message: message,
        type: type,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        title: title,
        message: message
      };
    } catch (error) {
      throw new Error(`发送通知失败: ${error.message}`);
    }
  }

  async notifyTaskComplete(taskName, success = true) {
    const title = success ? '任务完成' : '任务失败';
    const message = `${taskName} ${success ? '已成功完成' : '执行失败'}`;
    const type = success ? 'success' : 'error';

    return await this.send({
      title: title,
      message: message,
      type: type,
      sound: true
    });
  }

  async notifyError(errorMessage) {
    return await this.send({
      title: 'ClawMind 错误',
      message: errorMessage,
      type: 'error',
      sound: true
    });
  }

  async notifyInfo(message) {
    return await this.send({
      title: 'ClawMind',
      message: message,
      type: 'info',
      sound: false
    });
  }

  async notifyWarning(message) {
    return await this.send({
      title: 'ClawMind 警告',
      message: message,
      type: 'warning',
      sound: true
    });
  }

  enable() {
    this.enabled = true;
    return {
      success: true,
      enabled: true
    };
  }

  disable() {
    this.enabled = false;
    return {
      success: true,
      enabled: false
    };
  }

  getStatus() {
    return {
      success: true,
      enabled: this.enabled,
      historyCount: this.history.length
    };
  }

  getHistory(limit = 20) {
    const history = this.history.slice(-limit).reverse();

    return {
      success: true,
      count: history.length,
      history: history
    };
  }

  clearHistory() {
    this.history = [];

    return {
      success: true
    };
  }

  addToHistory(notification) {
    this.history.push(notification);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getIcon(type) {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    return fsSync.existsSync(iconPath) ? iconPath : undefined;
  }
}

module.exports = NotificationSystem;
