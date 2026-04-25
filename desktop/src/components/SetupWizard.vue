<template>
  <div class="setup-wizard">
    <div class="wizard-container">
      <!-- Progress Steps -->
      <div class="wizard-steps">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :class="['step', { active: currentStep === index, completed: currentStep > index }]"
        >
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-label">{{ step.label }}</div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="wizard-content">
        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 0" class="step-content">
          <h1>欢迎使用 ClawMind</h1>
          <p class="subtitle">AI Agent 系统 - 一键开箱即用</p>

          <div class="welcome-features">
            <div class="feature">
              <div class="feature-icon">🤖</div>
              <h3>智能规划</h3>
              <p>基于 LLM 的任务分解和执行</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🖥️</div>
              <h3>桌面控制</h3>
              <p>自动化桌面操作和浏览器任务</p>
            </div>
            <div class="feature">
              <div class="feature-icon">💾</div>
              <h3>记忆系统</h3>
              <p>持久化对话和任务历史</p>
            </div>
          </div>

          <p class="info-text">
            首次使用需要配置 AI 模型 API，整个过程只需 2 分钟。
          </p>
        </div>

        <!-- Step 2: API Configuration -->
        <div v-if="currentStep === 1" class="step-content">
          <h2>配置 AI 模型</h2>
          <p class="subtitle">选择您的 AI 服务提供商</p>

          <div class="provider-selection">
            <div
              v-for="provider in providers"
              :key="provider.id"
              :class="['provider-card', { selected: config.provider === provider.id }]"
              @click="selectProvider(provider.id)"
            >
              <div class="provider-name">{{ provider.name }}</div>
              <div class="provider-desc">{{ provider.description }}</div>
            </div>
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input
              v-model="config.apiKey"
              type="password"
              placeholder="输入您的 API Key"
              class="form-input"
            />
            <small class="form-hint">
              {{ getProviderHint() }}
            </small>
          </div>

          <div class="form-group">
            <label>模型名称</label>
            <input
              v-model="config.model"
              type="text"
              :placeholder="getModelPlaceholder()"
              class="form-input"
            />
          </div>

          <div class="form-group" v-if="config.provider === 'custom'">
            <label>API 端点</label>
            <input
              v-model="config.apiEndpoint"
              type="text"
              placeholder="https://api.example.com/v1"
              class="form-input"
            />
          </div>
        </div>

        <!-- Step 3: Service Check -->
        <div v-if="currentStep === 2" class="step-content">
          <h2>启动服务</h2>
          <p class="subtitle">正在初始化后端服务...</p>

          <div class="service-status">
            <div class="service-item">
              <div class="service-name">Hermes Agent</div>
              <div :class="['service-indicator', serviceStatus.hermes ? 'running' : 'stopped']">
                {{ serviceStatus.hermes ? '运行中' : '启动中...' }}
              </div>
            </div>
            <div class="service-item">
              <div class="service-name">OpenClaw Engine</div>
              <div :class="['service-indicator', serviceStatus.openclaw ? 'running' : 'stopped']">
                {{ serviceStatus.openclaw ? '运行中' : '启动中...' }}
              </div>
            </div>
          </div>

          <div v-if="serviceError" class="error-message">
            <strong>启动失败：</strong>{{ serviceError }}
          </div>
        </div>

        <!-- Step 4: Complete -->
        <div v-if="currentStep === 3" class="step-content">
          <div class="success-icon">✓</div>
          <h2>配置完成！</h2>
          <p class="subtitle">ClawMind 已准备就绪</p>

          <div class="completion-info">
            <div class="info-item">
              <strong>AI 提供商：</strong> {{ getProviderName() }}
            </div>
            <div class="info-item">
              <strong>模型：</strong> {{ config.model }}
            </div>
            <div class="info-item">
              <strong>服务状态：</strong>
              <span class="status-ok">全部运行中</span>
            </div>
          </div>

          <p class="info-text">
            您可以在设置中随时修改这些配置。
          </p>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="wizard-actions">
        <button
          v-if="currentStep > 0 && currentStep < 3"
          @click="prevStep"
          class="btn btn-secondary"
        >
          上一步
        </button>
        <button
          v-if="currentStep < 2"
          @click="nextStep"
          :disabled="!canProceed()"
          class="btn btn-primary"
        >
          下一步
        </button>
        <button
          v-if="currentStep === 2"
          @click="startServices"
          :disabled="servicesStarting"
          class="btn btn-primary"
        >
          {{ servicesStarting ? '启动中...' : '启动服务' }}
        </button>
        <button
          v-if="currentStep === 3"
          @click="finishSetup"
          class="btn btn-success"
        >
          开始使用
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const currentStep = ref(0);
const servicesStarting = ref(false);
const serviceError = ref('');

const steps = [
  { label: '欢迎' },
  { label: 'API 配置' },
  { label: '服务启动' },
  { label: '完成' }
];

const providers = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5',
    endpoint: 'https://api.openai.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer '
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3',
    endpoint: 'https://api.anthropic.com/v1',
    authHeader: 'x-api-key',
    authPrefix: ''
  },
  {
    id: 'custom',
    name: '自定义',
    description: '兼容 OpenAI API 的服务'
  }
];

const config = ref({
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4',
  apiEndpoint: 'https://api.openai.com/v1',
  authHeaderName: 'Authorization',
  authHeaderValuePrefix: 'Bearer '
});

const serviceStatus = ref({
  hermes: false,
  openclaw: false
});

function selectProvider(providerId) {
  config.value.provider = providerId;
  const provider = providers.find(p => p.id === providerId);

  if (provider && provider.endpoint) {
    config.value.apiEndpoint = provider.endpoint;
    config.value.authHeaderName = provider.authHeader;
    config.value.authHeaderValuePrefix = provider.authPrefix;
  }

  // Set default model
  if (providerId === 'openai') {
    config.value.model = 'gpt-4';
  } else if (providerId === 'anthropic') {
    config.value.model = 'claude-3-opus-20240229';
  }
}

function getProviderHint() {
  if (config.value.provider === 'openai') {
    return '在 https://platform.openai.com/api-keys 获取';
  } else if (config.value.provider === 'anthropic') {
    return '在 https://console.anthropic.com/settings/keys 获取';
  }
  return '输入您的 API Key';
}

function getModelPlaceholder() {
  if (config.value.provider === 'openai') {
    return 'gpt-4, gpt-3.5-turbo';
  } else if (config.value.provider === 'anthropic') {
    return 'claude-3-opus-20240229';
  }
  return '输入模型名称';
}

function getProviderName() {
  const provider = providers.find(p => p.id === config.value.provider);
  return provider ? provider.name : config.value.provider;
}

function canProceed() {
  if (currentStep.value === 1) {
    return config.value.apiKey.length > 0 && config.value.model.length > 0;
  }
  return true;
}

function nextStep() {
  if (canProceed()) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

async function startServices() {
  servicesStarting.value = true;
  serviceError.value = '';

  try {
    // Save configuration first
    await saveConfig();

    // Start Hermes
    await invoke('start_hermes');
    serviceStatus.value.hermes = true;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start OpenClaw
    await invoke('start_openclaw');
    serviceStatus.value.openclaw = true;

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Move to completion step
    currentStep.value = 3;
  } catch (error) {
    serviceError.value = error.toString();
  } finally {
    servicesStarting.value = false;
  }
}

async function saveConfig() {
  // Save configuration via Tauri command
  const configData = {
    provider: config.value.provider,
    apiKey: config.value.apiKey,
    model: config.value.model,
    apiEndpoint: config.value.apiEndpoint,
    authHeaderName: config.value.authHeaderName,
    authHeaderValuePrefix: config.value.authHeaderValuePrefix,
    websocketPort: 8765
  };

  try {
    await invoke('save_config', { config: configData });
    console.log('Configuration saved successfully');
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

function finishSetup() {
  // Mark setup as completed and emit event to parent
  localStorage.setItem('clawmind_setup_completed', 'true');
  window.location.reload();
}

onMounted(() => {
  // Check if setup was already completed
  const setupCompleted = localStorage.getItem('clawmind_setup_completed');
  if (setupCompleted === 'true') {
    // Skip wizard
    finishSetup();
  }
});
</script>

<style scoped>
.setup-wizard {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.wizard-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 100%;
  padding: 40px;
}

.wizard-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
  position: relative;
}

.wizard-steps::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  height: 2px;
  background: #e0e0e0;
  z-index: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.step.active .step-number {
  background: #667eea;
  color: white;
  transform: scale(1.1);
}

.step.completed .step-number {
  background: #4caf50;
  color: white;
}

.step-label {
  font-size: 12px;
  color: #666;
}

.wizard-content {
  min-height: 400px;
  margin-bottom: 30px;
}

.step-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

h1 {
  font-size: 32px;
  color: #333;
  margin-bottom: 8px;
  text-align: center;
}

h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  text-align: center;
  margin-bottom: 30px;
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin: 40px 0;
}

.feature {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  background: #f5f5f5;
}

.feature-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.feature h3 {
  font-size: 16px;
  margin-bottom: 8px;
  color: #333;
}

.feature p {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.provider-selection {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 30px;
}

.provider-card {
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.provider-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.provider-card.selected {
  border-color: #667eea;
  background: #f0f4ff;
}

.provider-name {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.provider-desc {
  font-size: 12px;
  color: #666;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

.service-status {
  margin: 40px 0;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 15px;
}

.service-name {
  font-weight: 500;
  color: #333;
}

.service-indicator {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.service-indicator.running {
  background: #4caf50;
  color: white;
}

.service-indicator.stopped {
  background: #ff9800;
  color: white;
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #4caf50;
  color: white;
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.completion-info {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin: 30px 0;
}

.info-item {
  padding: 10px 0;
  border-bottom: 1px solid #e0e0e0;
}

.info-item:last-child {
  border-bottom: none;
}

.status-ok {
  color: #4caf50;
  font-weight: 500;
}

.info-text {
  text-align: center;
  color: #666;
  font-size: 14px;
  margin-top: 20px;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 6px;
  margin-top: 20px;
}

.wizard-actions {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.btn {
  padding: 12px 30px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-success {
  background: #4caf50;
  color: white;
  flex: 1;
}

.btn-success:hover {
  background: #45a049;
  transform: translateY(-1px);
}
</style>
