import asyncio
from typing import Any, Dict, Optional

from modules.desktop_operations import DesktopOperations


class TaskExecutor:
    def __init__(self, max_retries: int = 3, retry_delay: float = 1.0):
        self.pending_commands: Dict[str, asyncio.Future] = {}
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.desktop = DesktopOperations()

    def register_result(self, command_id: str, result: Dict[str, Any]):
        future = self.pending_commands.pop(command_id, None)
        if future and not future.done():
            future.set_result(result)

    async def execute_step_with_retry(
        self,
        task_id: str,
        index: int,
        step: Dict[str, Any],
        openclaw_socket,
        send_command
    ) -> Dict[str, Any]:
        """Execute a single step with retry mechanism."""
        action = step.get('action', '')

        # 桌面操作直接在 Hermes 端执行（PyAutoGUI），不转发给 OpenClaw
        if action.startswith('desktop.'):
            result = await self.execute_desktop_action(action, step.get('params', {}))
            return {
                'index': index,
                'action': action,
                'reason': step.get('reason'),
                'result': result,
                'attempts': 1,
            }

        last_error = None

        for attempt in range(self.max_retries):
            command_id = f"{task_id}:step:{index}:attempt:{attempt + 1}"
            future = asyncio.get_running_loop().create_future()
            self.pending_commands[command_id] = future

            try:
                await send_command({
                    'type': 'command',
                    'id': command_id,
                    'action': action,
                    'params': step.get('params', {}),
                })

                result = await asyncio.wait_for(future, timeout=60)

                # Success - return immediately
                if result.get('success'):
                    return {
                        'index': index,
                        'action': action,
                        'reason': step.get('reason'),
                        'result': result,
                        'attempts': attempt + 1,
                    }

                # Failed but might retry
                last_error = result.get('error', 'Unknown error')

            except asyncio.TimeoutError:
                self.pending_commands.pop(command_id, None)
                last_error = f'Step {index} execution timeout'
            except Exception as e:
                self.pending_commands.pop(command_id, None)
                last_error = str(e)

            # If not last attempt, wait before retry (exponential backoff)
            if attempt < self.max_retries - 1:
                wait_time = self.retry_delay * (2 ** attempt)
                await asyncio.sleep(wait_time)

        # All retries failed
        return {
            'index': index,
            'action': action,
            'reason': step.get('reason'),
            'result': {
                'success': False,
                'error': last_error,
            },
            'attempts': self.max_retries,
        }

    async def execute_plan(self, task_id: str, plan: Dict[str, Any], openclaw_socket, send_command):
        steps = plan.get('steps', [])

        # 如果计划中有非桌面操作但没有 OpenClaw 连接，报错
        has_non_desktop = any(
            not s.get('action', '').startswith('desktop.')
            for s in steps
        )
        if has_non_desktop and openclaw_socket is None:
            raise RuntimeError('OpenClaw 未连接，无法执行计划')

        step_results = []

        for index, step in enumerate(steps, start=1):
            step_result = await self.execute_step_with_retry(
                task_id, index, step, openclaw_socket, send_command
            )
            step_results.append(step_result)

            if not step_result['result'].get('success'):
                return {
                    'success': False,
                    'plan': plan,
                    'stepResults': step_results,
                    'failedStep': index,
                    'error': step_result['result'].get('error', 'Step failed after retries'),
                }

        return {
            'success': True,
            'plan': plan,
            'stepResults': step_results,
        }

    # 桌面操作方法映射
    DESKTOP_METHODS = {
        'desktop.screenshot': 'screenshot',
        'desktop.capture_screen': 'screenshot',
        'desktop.mouse_move': 'mouse_move',
        'desktop.mouse_click': 'mouse_click',
        'desktop.mouse_drag': 'mouse_drag',
        'desktop.mouse_scroll': 'mouse_scroll',
        'desktop.get_mouse_position': 'get_mouse_position',
        'desktop.key_type': 'keyboard_type',
        'desktop.key_press': 'keyboard_press',
        'desktop.key_hotkey': 'keyboard_hotkey',
        'desktop.find_image': 'find_image',
        'desktop.get_screen_size': 'get_screen_size',
        'desktop.alert': 'alert',
    }

    async def execute_desktop_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """在 Hermes 端执行桌面操作（PyAutoGUI）"""
        method_name = self.DESKTOP_METHODS.get(action)
        if not method_name:
            return {'success': False, 'error': f'未知的桌面操作: {action}'}

        method = getattr(self.desktop, method_name, None)
        if not method:
            return {'success': False, 'error': f'桌面方法不存在: {method_name}'}

        try:
            # PyAutoGUI 是同步的，放到线程池中执行避免阻塞事件循环
            result = await asyncio.get_running_loop().run_in_executor(
                None, method, params
            )
            return result
        except Exception as e:
            return {'success': False, 'error': str(e)}
