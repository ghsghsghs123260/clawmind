/**
 * config command - Show current configuration
 */

const chalk = require('chalk');
const { loadConfig, resolveDataDir, saveConfig } = require('../utils/config');
const { getConfigManager, PROVIDER_PRESETS } = require('../utils/config-manager');
const path = require('path');

function register(program, context) {
  const cmd = program
    .command('config')
    .description('Show or edit ClawMind configuration');

  cmd
    .option('--set-provider <provider>', 'Set the provider name')
    .option('--set-api-endpoint <url>', 'Set the model API endpoint')
    .option('--set-auth-header <name>', 'Set the auth header name')
    .option('--set-auth-prefix <prefix>', 'Set the auth header value prefix')
    .option('--set-api-key <key>', 'Set the API key')
    .option('--set-model <model>', 'Set the model name')
    .option('--set-port <port>', 'Set the WebSocket port')
    .option('--set-data-dir <dir>', 'Set the data directory')
    .option('--set-log-level <level>', 'Set log level (debug/info/warn/error)')
    .option('--set-execution-mode <mode>', 'Set execution mode (serial/parallel)')
    .option('--set-notification <enabled>', 'Enable/disable notifications (true/false)')
    .option('--set-trust-timeout <seconds>', 'Set trust mode timeout in seconds')
    .option('--wizard', 'Run interactive configuration wizard')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      await runConfig(context.CLAWMIND_DIR, opts);
    });
}

async function runConfig(dataDir, opts) {
  const config = loadConfig(dataDir);
  const resolvedDir = resolveDataDir(config);

  // Interactive wizard
  if (opts.wizard) {
    await runWizard(dataDir, config);
    return;
  }

  let modified = false;

  if (opts.setProvider) {
    config.provider = opts.setProvider.trim();
    modified = true;
  }
  if (opts.setApiEndpoint) {
    config.apiEndpoint = opts.setApiEndpoint.trim();
    modified = true;
  }
  if (opts.setAuthHeader) {
    config.authHeaderName = opts.setAuthHeader.trim();
    modified = true;
  }
  if (opts.setAuthPrefix !== undefined) {
    config.authHeaderValuePrefix = opts.setAuthPrefix;
    modified = true;
  }
  if (opts.setApiKey) {
    config.apiKey = opts.setApiKey.trim();
    modified = true;
  }
  if (opts.setModel) {
    config.model = opts.setModel.trim();
    modified = true;
  }
  if (opts.setPort) {
    const port = parseInt(opts.setPort, 10);
    if (port >= 1024 && port <= 65535) {
      config.websocketPort = port;
      modified = true;
    } else {
      console.log(`  ${chalk.red('✗')} Port must be between 1024 and 65535`);
      return;
    }
  }
  if (opts.setDataDir) {
    config.dataDir = path.resolve(opts.setDataDir);
    modified = true;
  }
  if (opts.setLogLevel) {
    const level = opts.setLogLevel.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.logging = config.logging || {};
      config.logging.level = level;
      modified = true;
    } else {
      console.log(`  ${chalk.red('✗')} Log level must be one of: debug, info, warn, error`);
      return;
    }
  }
  if (opts.setExecutionMode) {
    const mode = opts.setExecutionMode.toLowerCase();
    if (['serial', 'parallel'].includes(mode)) {
      config.execution = config.execution || {};
      config.execution.mode = mode;
      modified = true;
    } else {
      console.log(`  ${chalk.red('✗')} Execution mode must be: serial or parallel`);
      return;
    }
  }
  if (opts.setNotification !== undefined) {
    const enabled = opts.setNotification.toLowerCase() === 'true';
    config.notifications = config.notifications || {};
    config.notifications.enabled = enabled;
    modified = true;
  }
  if (opts.setTrustTimeout) {
    const timeout = parseInt(opts.setTrustTimeout, 10);
    if (timeout > 0) {
      config.trustMode = config.trustMode || {};
      config.trustMode.timeout = timeout;
      modified = true;
    } else {
      console.log(`  ${chalk.red('✗')} Trust timeout must be a positive number`);
      return;
    }
  }

  if (modified) {
    saveConfig(resolvedDir, config);
    console.log(`  ${chalk.green('✓')} Configuration updated`);
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  console.log('');
  console.log(`  ${chalk.bold('ClawMind Configuration')}`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Data Directory  : ${chalk.cyan(resolvedDir)}`);
  console.log(`  WebSocket Port  : ${chalk.cyan(String(config.websocketPort))}`);
  console.log(`  Provider        : ${chalk.cyan(config.provider || 'not set')}`);
  console.log(`  API Endpoint    : ${chalk.cyan(config.apiEndpoint || 'not set')}`);
  console.log(`  Auth Header     : ${chalk.cyan(config.authHeaderName || 'not set')}`);
  console.log(`  Auth Prefix     : ${chalk.cyan(config.authHeaderValuePrefix || '(empty)')}`);
  console.log(`  Model           : ${chalk.cyan(config.model || 'not set')}`);

  if (config.apiKey && config.apiKey.length >= 20) {
    const masked = config.apiKey.slice(0, 6) + '***' + config.apiKey.slice(-4);
    console.log(`  API Key         : ${chalk.cyan(masked)}`);
  } else {
    console.log(`  ${chalk.yellow('!')} API Key         : ${chalk.gray('not configured')}`);
  }

  console.log(`  Execution Mode  : ${chalk.cyan(config.execution?.mode || 'serial')}`);
  console.log(`  Log Level       : ${chalk.cyan(config.logging?.level || 'info')}`);
  console.log(`  Notifications   : ${chalk.cyan(config.notifications?.enabled !== false ? 'enabled' : 'disabled')}`);
  console.log(`  Trust Timeout   : ${chalk.cyan(config.trustMode?.timeout ? `${config.trustMode.timeout}s` : 'not set')}`);
  console.log(`  Language        : ${chalk.cyan(config.language || 'zh')}`);
  console.log('');

  const configPath = path.join(resolvedDir, 'config.json');
  console.log(`  Config file: ${chalk.gray(configPath)}`);
  console.log('');
  console.log(`  ${chalk.bold('Usage:')}`);
  console.log(`    clawmind config --wizard                       Run interactive wizard`);
  console.log(`    clawmind config --set-provider <NAME>          Set provider`);
  console.log(`    clawmind config --set-api-endpoint <URL>       Set API endpoint`);
  console.log(`    clawmind config --set-auth-header <NAME>       Set auth header name`);
  console.log(`    clawmind config --set-auth-prefix <VALUE>      Set auth prefix`);
  console.log(`    clawmind config --set-api-key <KEY>            Set API key`);
  console.log(`    clawmind config --set-model <MODEL>            Set model`);
  console.log(`    clawmind config --set-port <PORT>              Set WebSocket port`);
  console.log(`    clawmind config --set-data-dir <DIR>           Set data directory`);
  console.log(`    clawmind config --set-log-level <LEVEL>        Set log level`);
  console.log(`    clawmind config --set-execution-mode <MODE>    Set execution mode`);
  console.log(`    clawmind config --set-notification <BOOL>      Enable/disable notifications`);
  console.log(`    clawmind config --set-trust-timeout <SECONDS>  Set trust timeout`);
  console.log('');
}

async function runWizard(dataDir, config) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log('');
  console.log(`  ${chalk.bold.cyan('ClawMind Configuration Wizard')}`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log('');

  // 使用新的配置管理器
  const configManager = getConfigManager();
  configManager.config = config;

  // Provider
  console.log(`  ${chalk.bold('1. AI Provider')}`);
  console.log(`     Available: ${Object.keys(PROVIDER_PRESETS).join(', ')}`);
  console.log(`     Current: ${chalk.cyan(config.provider || 'not set')}`);
  const provider = await question('     Enter provider (openai/anthropic/azure/custom) [Enter to skip]: ');

  if (provider.trim()) {
    const providerName = provider.trim().toLowerCase();
    if (PROVIDER_PRESETS[providerName]) {
      configManager.applyProviderPreset(providerName);
      console.log(`     ${chalk.green('✓')} Applied ${providerName} preset`);
    } else {
      console.log(`     ${chalk.yellow('⚠')} Unknown provider, using custom`);
      config.provider = providerName;
    }
  }

  // API Endpoint
  if (config.provider === 'custom') {
    console.log('');
    console.log(`  ${chalk.bold('2. API Endpoint')}`);
    console.log(`     Current: ${chalk.cyan(config.apiEndpoint || 'not set')}`);
    const endpoint = await question('     Enter API endpoint URL [Enter to skip]: ');
    if (endpoint.trim()) {
      config.apiEndpoint = endpoint.trim();
    }

    console.log('');
    console.log(`  ${chalk.bold('3. Auth Header Name')}`);
    console.log(`     Current: ${chalk.cyan(config.authHeaderName || 'Authorization')}`);
    const authHeader = await question('     Enter auth header name [Enter to skip]: ');
    if (authHeader.trim()) {
      config.authHeaderName = authHeader.trim();
    }

    console.log('');
    console.log(`  ${chalk.bold('4. Auth Header Prefix')}`);
    console.log(`     Current: ${chalk.cyan(config.authHeaderValuePrefix || 'Bearer ')}`);
    const authPrefix = await question('     Enter auth prefix [Enter to skip]: ');
    if (authPrefix !== undefined && authPrefix !== '') {
      config.authHeaderValuePrefix = authPrefix;
    }
  } else {
    // Preset already applied by configManager.applyProviderPreset()
    console.log(`     ${chalk.gray('API endpoint and auth headers set automatically')}`);
  }

  // API Key
  console.log('');
  console.log(`  ${chalk.bold('5. API Key')}`);
  if (config.apiKey) {
    const masked = config.apiKey.slice(0, 6) + '***' + config.apiKey.slice(-4);
    console.log(`     Current: ${chalk.cyan(masked)}`);
  } else {
    console.log(`     Current: ${chalk.gray('not set')}`);
  }
  const apiKey = await question('     Enter API key [Enter to skip]: ');
  if (apiKey.trim()) {
    config.apiKey = apiKey.trim();
  }

  // Model
  console.log('');
  console.log(`  ${chalk.bold('6. Model')}`);
  console.log(`     Current: ${chalk.cyan(config.model || 'not set')}`);
  const model = await question('     Enter model name (e.g., gpt-4, claude-3-opus) [Enter to skip]: ');
  if (model.trim()) {
    config.model = model.trim();
  }

  // WebSocket Port
  console.log('');
  console.log(`  ${chalk.bold('7. WebSocket Port')}`);
  console.log(`     Current: ${chalk.cyan(String(config.websocketPort || 8765))}`);
  const port = await question('     Enter port (1024-65535) [Enter to skip]: ');
  if (port.trim()) {
    const portNum = parseInt(port, 10);
    if (portNum >= 1024 && portNum <= 65535) {
      config.websocketPort = portNum;
    } else {
      console.log(`     ${chalk.yellow('⚠')} Invalid port, keeping current value`);
    }
  }

  // Log Level
  console.log('');
  console.log(`  ${chalk.bold('8. Log Level')}`);
  console.log(`     Current: ${chalk.cyan(config.logging?.level || 'info')}`);
  const logLevel = await question('     Enter log level (debug/info/warn/error) [Enter to skip]: ');
  if (logLevel.trim()) {
    const level = logLevel.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.logging = config.logging || {};
      config.logging.level = level;
    } else {
      console.log(`     ${chalk.yellow('⚠')} Invalid level, keeping current value`);
    }
  }

  // Execution Mode
  console.log('');
  console.log(`  ${chalk.bold('9. Execution Mode')}`);
  console.log(`     Current: ${chalk.cyan(config.execution?.mode || 'serial')}`);
  const execMode = await question('     Enter mode (serial/parallel) [Enter to skip]: ');
  if (execMode.trim()) {
    const mode = execMode.toLowerCase();
    if (['serial', 'parallel'].includes(mode)) {
      config.execution = config.execution || {};
      config.execution.mode = mode;
    } else {
      console.log(`     ${chalk.yellow('⚠')} Invalid mode, keeping current value`);
    }
  }

  // Notifications
  console.log('');
  console.log(`  ${chalk.bold('10. Notifications')}`);
  console.log(`     Current: ${chalk.cyan(config.notifications?.enabled !== false ? 'enabled' : 'disabled')}`);
  const notif = await question('     Enable notifications? (y/n) [Enter to skip]: ');
  if (notif.trim()) {
    config.notifications = config.notifications || {};
    config.notifications.enabled = notif.toLowerCase() === 'y';
  }

  // Trust Timeout
  console.log('');
  console.log(`  ${chalk.bold('11. Trust Mode Timeout')}`);
  console.log(`     Current: ${chalk.cyan(config.trustMode?.timeout ? `${config.trustMode.timeout}s` : 'not set')}`);
  const timeout = await question('     Enter timeout in seconds [Enter to skip]: ');
  if (timeout.trim()) {
    const timeoutNum = parseInt(timeout, 10);
    if (timeoutNum > 0) {
      config.trustMode = config.trustMode || {};
      config.trustMode.timeout = timeoutNum;
    } else {
      console.log(`     ${chalk.yellow('⚠')} Invalid timeout, keeping current value`);
    }
  }

  rl.close();

  // 使用新的配置管理器保存
  configManager.config = config;
  try {
    configManager.validate();
    const savedPath = configManager.save();

    console.log('');
    console.log(`  ${chalk.green('✓')} Configuration saved successfully`);
    console.log(`  ${chalk.gray('Location:')} ${savedPath}`);
    console.log('');

    // 显示配置摘要
    console.log(`  ${chalk.bold('Configuration Summary:')}`);
    console.log(`  Provider:   ${chalk.cyan(config.provider)}`);
    console.log(`  Model:      ${chalk.cyan(config.model)}`);
    console.log(`  Endpoint:   ${chalk.cyan(config.apiEndpoint)}`);
    console.log(`  Port:       ${chalk.cyan(config.websocketPort)}`);
    console.log('');
  } catch (error) {
    console.log('');
    console.log(`  ${chalk.red('✗')} Configuration validation failed:`);
    console.log(`  ${chalk.red(error.message)}`);
    console.log('');
  }
}

module.exports = { register };
