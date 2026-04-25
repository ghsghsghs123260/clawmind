import asyncio
import json
import logging
from typing import Any, Dict, Optional
from urllib import error, request
from skills_integration import SkillsIntegration

logger = logging.getLogger('Planner')


SUPPORTED_ACTIONS = {
    # File operations
    'file.read',
    'file.write',
    'file.delete',
    'file.list',
    'file.search',
    'file.copy',
    'file.move',
    'file.info',
    # Terminal operations
    'terminal.exec',
    'terminal.exec_script',
    'terminal.get_cwd',
    'terminal.set_cwd',
    'terminal.get_env',
    'terminal.set_env',
    # Browser operations
    'browser.launch',
    'browser.close',
    'browser.open',
    'browser.click',
    'browser.input',
    'browser.extract',
    'browser.screenshot',
    'browser.wait_for',
    'browser.evaluate',
    'browser.navigate',
    # Clipboard operations
    'clipboard.read',
    'clipboard.write',
    'clipboard.clear',
    # Desktop operations (must match executor.py DESKTOP_METHODS)
    'desktop.screenshot',
    'desktop.capture_screen',
    'desktop.mouse_move',
    'desktop.mouse_click',
    'desktop.mouse_drag',
    'desktop.mouse_scroll',
    'desktop.key_press',
    'desktop.key_hotkey',
    'desktop.key_type',
    'desktop.find_image',
    'desktop.get_screen_size',
    'desktop.get_mouse_position',
    'desktop.alert',
    # Memory operations
    'memory.save_conversation',
    'memory.load_conversation',
    'memory.list_conversations',
    'memory.save_preference',
    'memory.get_preference',
    'memory.save_task',
    'memory.list_tasks',
    # Skill operations
    'skill.get',
    'skill.list',
    'skill.execute',
    'skill.create',
    'skill.search',
    # Notification operations
    'notification.send',
    'notification.task_complete',
    'notification.error',
}

# Dangerous actions that require extra caution
DANGEROUS_ACTIONS = {
    'file.delete',
    'file.move',
    'terminal.exec',
    'terminal.exec_script',
    'desktop.mouse_click',
    'desktop.key_press',
    'desktop.key_hotkey',
}


class PlanningError(Exception):
    pass


class OpenAICompatiblePlanner:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.skills = SkillsIntegration()  # 初始化 Skills 集成

    def validate_config(self):
        if not self.config.get('apiEndpoint'):
            raise PlanningError('缺少 apiEndpoint 配置')
        if not self.config.get('model'):
            raise PlanningError('缺少 model 配置')
        if not self.config.get('apiKey'):
            raise PlanningError('缺少 apiKey 配置')
        if not self.config.get('authHeaderName'):
            raise PlanningError('缺少 authHeaderName 配置')

    def build_headers(self) -> Dict[str, str]:
        header_name = self.config['authHeaderName']
        prefix = self.config.get('authHeaderValuePrefix', '')
        return {
            'Content-Type': 'application/json',
            header_name: f"{prefix}{self.config['apiKey']}",
        }

    def build_prompt(self, user_input: str) -> str:
        allowed = ', '.join(sorted(SUPPORTED_ACTIONS))
        dangerous = ', '.join(sorted(DANGEROUS_ACTIONS))
        return (
            '你是 ClawMind 的计划器。你必须把用户任务拆解为可执行的多步 JSON 计划。\n'
            '\n'
            '要求：\n'
            '1. 只能使用允许的 action。\n'
            '2. 只输出 JSON，不要输出 markdown 代码块。\n'
            '3. JSON 格式必须为 {"goal": string, "steps": [{"action": string, "params": object, "reason": string}]}.\n'
            '4. steps 数量必须在 1 到 8 步之间。\n'
            '5. 每个步骤最多包含 1 个 action，不要在单步中执行多个操作。\n'
            '6. 如果任务无法安全完成，也要输出 JSON，但 steps 为空，并在 goal 中说明原因。\n'
            '\n'
            '危险操作检测：\n'
            f'- 以下操作属于危险操作：{dangerous}\n'
            '- 如果计划包含危险操作，必须在 reason 中明确说明风险和影响范围。\n'
            '- 对于 file.delete 和 file.move，必须在 reason 中说明目标路径。\n'
            '- 对于 terminal.exec，必须在 reason 中说明命令的作用。\n'
            '\n'
            '错误处理：\n'
            '- 如果某步可能失败，在 reason 中说明失败原因和替代方案。\n'
            '- 优先使用安全的操作（如 file.read 而不是 terminal.exec cat）。\n'
            '\n'
            '记忆系统集成：\n'
            '- 对于重要的执行结果，使用 memory.save_task 或 memory.save_preference 持久化。\n'
            '- 对于对话内容，使用 memory.save_conversation 保存。\n'
            '\n'
            f'允许的 action: {allowed}\n'
            f'\n'
            f'用户任务: {user_input}'
        )

    async def create_plan(self, user_input: str) -> Dict[str, Any]:
        # 首先尝试匹配 Skills
        skill_match = await self.skills.match_input(user_input, threshold=0.3)

        if skill_match and skill_match.get('success'):
            # 找到匹配的 Skill，转换为计划格式
            skill = skill_match['skill']
            score = skill_match.get('score', 0)
            logger.info(f"Skill matched: {skill['name']} (score: {score:.3f})")

            # 尝试从 Skills CLI 获取完整 skill 定义来提取参数
            skill_detail = self.skills.get_skill_detail(skill['name'])
            extracted_params = {}

            if skill_detail and skill_detail.get('trigger', {}).get('patterns'):
                # 用 matcher 重新匹配以获取 captures
                import re
                for pattern in skill_detail['trigger']['patterns']:
                    try:
                        # 将 {paramName} 转为正则命名捕获组（使用位置拼接避免前缀冲突）
                        placeholders = list(re.finditer(r'\{(\w+)\}', pattern))
                        total = len(placeholders)
                        processed = ''
                        last_end = 0
                        for idx, m in enumerate(placeholders):
                            processed += pattern[last_end:m.start()]
                            name = m.group(1)
                            replacement = f'(?<{name}>.+)' if idx == total - 1 else f'(?<{name}>.+?)'
                            processed += replacement
                            last_end = m.end()
                        processed += pattern[last_end:]
                        match = re.search(processed, user_input, re.IGNORECASE)
                        if match and match.groupdict():
                            extracted_params = {k: v for k, v in match.groupdict().items() if v}
                            break
                    except re.error:
                        continue

            # 用默认值填充未提取到的参数
            if skill_detail and skill_detail.get('parameters'):
                for param in skill_detail['parameters']:
                    if param['name'] not in extracted_params and 'default' in param:
                        extracted_params[param['name']] = param['default']

            if extracted_params:
                logger.info(f"Extracted params: {extracted_params}")

            return {
                'goal': f"Execute skill: {skill['name']}",
                'steps': [
                    {
                        'action': 'skill.execute',
                        'params': {
                            'skillId': skill['name'],
                            'params': extracted_params,
                        },
                        'reason': f"Skill: {skill.get('description', skill['name'])}"
                    }
                ],
                'source': 'skill',
                'skill_score': score,
            }

        # 没有匹配的 Skill，使用 LLM 规划
        logger.info(f"No skill matched for: '{user_input}', falling back to LLM")
        self.validate_config()
        endpoint = self.config['apiEndpoint'].rstrip('/') + '/chat/completions'
        payload = {
            'model': self.config['model'],
            'temperature': 0,
            'messages': [
                {
                    'role': 'system',
                    'content': '你是严格输出 JSON 的任务计划器。',
                },
                {
                    'role': 'user',
                    'content': self.build_prompt(user_input),
                },
            ],
        }

        body_text = await asyncio.to_thread(self._post_json, endpoint, payload)

        try:
            body = json.loads(body_text)
            content = body['choices'][0]['message']['content']
        except Exception as exc:
            raise PlanningError(f'模型响应格式无法解析: {exc}') from exc

        try:
            plan = json.loads(content)
        except json.JSONDecodeError as exc:
            raise PlanningError(f'模型未返回合法 JSON: {exc}') from exc

        plan['source'] = 'llm'
        self.validate_plan(plan)
        return plan

    def _post_json(self, endpoint: str, payload: Dict[str, Any]) -> str:
        raw = json.dumps(payload).encode('utf-8')
        req = request.Request(endpoint, data=raw, headers=self.build_headers(), method='POST')
        try:
            with request.urlopen(req, timeout=60) as response:
                return response.read().decode('utf-8')
        except error.HTTPError as exc:
            body = exc.read().decode('utf-8', errors='replace')
            raise PlanningError(f'模型接口请求失败: HTTP {exc.code} - {body}') from exc
        except error.URLError as exc:
            raise PlanningError(f'模型接口连接失败: {exc.reason}') from exc

    def validate_plan(self, plan: Dict[str, Any]):
        if not isinstance(plan, dict):
            raise PlanningError('计划必须是 JSON 对象')
        if 'goal' not in plan or 'steps' not in plan:
            raise PlanningError('计划缺少 goal 或 steps 字段')
        if not isinstance(plan['steps'], list):
            raise PlanningError('steps 必须是数组')
        if len(plan['steps']) == 0:
            raise PlanningError('steps 不能为空')
        if len(plan['steps']) > 8:
            raise PlanningError('steps 数量不能超过 8')

        for index, step in enumerate(plan['steps'], start=1):
            if not isinstance(step, dict):
                raise PlanningError(f'第 {index} 步不是对象')
            action = step.get('action')
            params = step.get('params')
            if action not in SUPPORTED_ACTIONS:
                raise PlanningError(f'第 {index} 步包含不支持的 action: {action}')
            if not isinstance(params, dict):
                raise PlanningError(f'第 {index} 步的 params 必须是对象')
