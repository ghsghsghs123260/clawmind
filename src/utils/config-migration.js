/**
 * 配置迁移工具
 * 用于将旧配置格式迁移到新格式
 */

const fs = require('fs');
const path = require('path');
const { getConfigManager } = require('./config-manager');

/**
 * 查找所有可能的配置文件
 */
function findAllConfigFiles() {
  const configFiles = [];
  const possiblePaths = [
    path.join(process.env.USERPROFILE || process.env.HOME, 'ClawMind', 'config.json'),
    path.join(process.env.APPDATA || '', 'ClawMind', 'config.json'),
    path.join(__dirname, '..', '..', 'config', 'config.default.json'),
  ];

  for (const configPath of possiblePaths) {
    if (configPath && fs.existsSync(configPath)) {
      configFiles.push(configPath);
    }
  }

  return configFiles;
}

/**
 * 备份配置文件
 */
function backupConfig(configPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = configPath.replace('.json', `.backup.${timestamp}.json`);

  fs.copyFileSync(configPath, backupPath);
  console.log(`Backup created: ${backupPath}`);

  return backupPath;
}

/**
 * 迁移单个配置文件
 */
function migrateConfigFile(configPath) {
  console.log(`\nMigrating: ${configPath}`);

  try {
    // 读取旧配置
    const content = fs.readFileSync(configPath, 'utf-8');
    const oldConfig = JSON.parse(content);

    // 检查是否需要迁移
    const configManager = getConfigManager();
    if (!configManager.needsMigration(oldConfig)) {
      console.log('  ✓ Already in new format, skipping');
      return { success: true, skipped: true };
    }

    // 备份
    const backupPath = backupConfig(configPath);

    // 迁移
    const newConfig = configManager.migrateConfig(oldConfig);

    // 保存
    fs.writeFileSync(
      configPath,
      JSON.stringify(newConfig, null, 2),
      'utf-8'
    );

    console.log('  ✓ Migration successful');
    console.log(`  Backup: ${backupPath}`);

    return { success: true, backupPath };
  } catch (error) {
    console.error(`  ✗ Migration failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 迁移所有配置文件
 */
function migrateAllConfigs() {
  console.log('='.repeat(60));
  console.log('ClawMind Configuration Migration Tool');
  console.log('='.repeat(60));

  const configFiles = findAllConfigFiles();

  if (configFiles.length === 0) {
    console.log('\nNo configuration files found.');
    return;
  }

  console.log(`\nFound ${configFiles.length} configuration file(s):`);
  configFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  const results = [];
  for (const configPath of configFiles) {
    const result = migrateConfigFile(configPath);
    results.push({ path: configPath, ...result });
  }

  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`  Successful: ${successful}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Failed:     ${failed}`);

  if (failed > 0) {
    console.log('\nFailed migrations:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.path}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * 命令行入口
 */
if (require.main === module) {
  migrateAllConfigs();
}

module.exports = {
  findAllConfigFiles,
  backupConfig,
  migrateConfigFile,
  migrateAllConfigs,
};
