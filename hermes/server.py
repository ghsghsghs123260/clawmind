"""
Hermes WebSocket Server
ClawMind 的消息中心，负责接收和分发所有消息
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Set

import websockets

from executor import TaskExecutor
from planner import OpenAICompatiblePlanner, PlanningError

# 配置日志（强制 UTF-8 编码，解决 Windows 中文乱码）
import sys
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('HermesServer')


class HermesServer:
    """Hermes WebSocket 服务器"""

    def __init__(self, host: str = 'localhost', port: int = 8765, config: Optional[Dict[str, Any]] = None):
        self.host = host
        self.port = port
        self.config = config or {}
        self.clients: set = set()
        self.client_roles: dict = {}
        self.message_handlers: Dict[str, callable] = {}
        self.executor = TaskExecutor()
        self.planner = OpenAICompatiblePlanner(self.config)

    async def register_client(self, websocket: Any):
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"客户端已连接: {client_id}")
        logger.info(f"当前连接数: {len(self.clients)}")

    async def unregister_client(self, websocket: Any):
        self.clients.discard(websocket)
        self.client_roles.pop(websocket, None)
        client_id = id(websocket)
        logger.info(f"客户端已断开: {client_id}")
        logger.info(f"当前连接数: {len(self.clients)}")

    def get_openclaw_socket(self):
        for websocket, role in self.client_roles.items():
            if role == 'openclaw':
                return websocket
        return None

    async def handle_message(self, websocket: Any, message: str):
        try:
            data = json.loads(message)

            if not isinstance(data, dict):
                await self.send_error(websocket, '消息格式错误：必须是 JSON 对象')
                return

            if 'type' not in data:
                await self.send_error(websocket, '消息格式错误：缺少 type 字段')
                return

            msg_type = data['type']
            msg_id = data.get('id', None)

            logger.info(f"收到消息: type={msg_type}, id={msg_id}")

            if msg_type in self.message_handlers:
                response = await self.message_handlers[msg_type](websocket, data)
                if response is not None:
                    await self.send_response(websocket, response, msg_id)
            else:
                response = {
                    'type': 'echo',
                    'data': data,
                    'timestamp': datetime.now().isoformat()
                }
                await self.send_response(websocket, response, msg_id)

        except json.JSONDecodeError as e:
            await self.send_error(websocket, f"JSON 解析错误: {str(e)}")
        except Exception as e:
            logger.error(f"处理消息时出错: {str(e)}", exc_info=True)
            await self.send_error(websocket, f"服务器错误: {str(e)}")

    async def send_response(self, websocket: Any,
                            response: Dict[str, Any], msg_id: str = None):
        if msg_id and 'id' not in response:
            response['id'] = msg_id
        response['timestamp'] = datetime.now().isoformat()

        try:
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.debug(f"发送响应: {response.get('type', 'unknown')}")
        except Exception as e:
            logger.error(f"发送响应失败: {str(e)}")

    async def send_error(self, websocket: Any, error_msg: str, msg_id: str = None):
        error_response = {
            'type': 'error',
            'error': error_msg,
            'timestamp': datetime.now().isoformat()
        }
        if msg_id:
            error_response['id'] = msg_id
        try:
            await websocket.send(json.dumps(error_response, ensure_ascii=False))
            logger.warning(f"发送错误: {error_msg}")
        except Exception as e:
            logger.error(f"发送错误消息失败: {str(e)}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.clients:
            logger.warning('没有连接的客户端，无法广播')
            return

        message['timestamp'] = datetime.now().isoformat()
        message_str = json.dumps(message, ensure_ascii=False)

        await asyncio.gather(
            *[client.send(message_str) for client in self.clients],
            return_exceptions=True
        )
        logger.info(f"广播消息到 {len(self.clients)} 个客户端")

    def register_handler(self, msg_type: str, handler: callable):
        self.message_handlers[msg_type] = handler
        logger.info(f"注册消息处理器: {msg_type}")

    async def send_command_to_openclaw(self, payload: Dict[str, Any]):
        openclaw_socket = self.get_openclaw_socket()
        if openclaw_socket is None:
            raise RuntimeError('OpenClaw 未连接')
        await openclaw_socket.send(json.dumps(payload, ensure_ascii=False))

    async def handle_register(self, websocket: Any, data: Dict[str, Any]):
        client_name = data.get('client', 'unknown')
        self.client_roles[websocket] = client_name
        return {
            'type': 'registered',
            'client': client_name,
            'capabilities': data.get('capabilities', []),
        }

    async def handle_ping(self, websocket: Any, data: Dict[str, Any]):
        return {'type': 'pong', 'data': 'pong'}

    async def handle_status(self, websocket: Any, data: Dict[str, Any]):
        return {
            'type': 'status',
            'data': {
                'server': 'running',
                'clients': len(self.clients),
                'openclaw_connected': self.get_openclaw_socket() is not None,
            }
        }

    async def handle_command_result(self, websocket: Any, data: Dict[str, Any]):
        command_id = data.get('id')
        if command_id:
            self.executor.register_result(command_id, data)
        return None

    async def handle_desktop_execute(self, websocket: Any, data: Dict[str, Any]):
        """处理来自 OpenClaw 的桌面操作请求"""
        action = data.get('action', '')
        params = data.get('params', {})
        result = await self.executor.execute_desktop_action(action, params)
        return result

    async def handle_task_run(self, websocket: Any, data: Dict[str, Any]):
        task_id = data.get('id') or f"task_{int(datetime.now().timestamp())}"
        user_input = data.get('input', '').strip()

        if not user_input:
            return {
                'type': 'task.result',
                'success': False,
                'error': '缺少 input',
                'plan': None,
                'stepResults': [],
            }

        try:
            plan = await self.planner.create_plan(user_input)
            execution_result = await self.executor.execute_plan(
                task_id,
                plan,
                self.get_openclaw_socket(),
                self.send_command_to_openclaw,
            )
            return {
                'type': 'task.result',
                'success': execution_result['success'],
                'plan': execution_result['plan'],
                'stepResults': execution_result['stepResults'],
                'failedStep': execution_result.get('failedStep'),
            }
        except PlanningError as exc:
            return {
                'type': 'task.result',
                'success': False,
                'error': str(exc),
                'plan': None,
                'stepResults': [],
            }
        except Exception as exc:
            logger.error(f"任务执行失败: {exc}", exc_info=True)
            return {
                'type': 'task.result',
                'success': False,
                'error': str(exc),
                'plan': None,
                'stepResults': [],
            }

    async def handler(self, websocket: Any):
        await self.register_client(websocket)

        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info('客户端连接关闭')
        except Exception as e:
            logger.error(f"连接处理出错: {str(e)}", exc_info=True)
        finally:
            await self.unregister_client(websocket)

    async def start(self):
        logger.info(f"启动 Hermes WebSocket Server: {self.host}:{self.port}")

        async with websockets.serve(self.handler, self.host, self.port):
            logger.info(f"✓ Hermes Server 运行中: ws://{self.host}:{self.port}")
            await asyncio.Future()


def load_runtime_config() -> Dict[str, Any]:
    data_dir = os.environ.get('CLAWMIND_DIR')
    if not data_dir:
        data_dir = str(Path.home() / 'ClawMind')
        logger.warning(f'CLAWMIND_DIR not set, using default: {data_dir}')

    config_path = Path(data_dir) / 'config.json'
    if not config_path.exists():
        logger.warning(f'Config file not found: {config_path}, using defaults')
        return {
            'provider': 'openai',
            'apiEndpoint': 'https://api.openai.com/v1',
            'authHeaderName': 'Authorization',
            'authHeaderValuePrefix': 'Bearer ',
            'apiKey': '',
            'model': 'gpt-4',
            'websocketPort': 8765,
        }

    try:
        with config_path.open('r', encoding='utf-8') as fh:
            config = json.load(fh)

            # Ensure required fields exist (backward compatibility)
            if 'apiEndpoint' not in config:
                logger.warning('Config missing apiEndpoint, using default')
                config['apiEndpoint'] = 'https://api.openai.com/v1'

            if 'authHeaderName' not in config:
                logger.warning('Config missing authHeaderName, using default')
                config['authHeaderName'] = 'Authorization'

            if 'authHeaderValuePrefix' not in config:
                # Infer from provider
                if config.get('provider') == 'anthropic':
                    config['authHeaderValuePrefix'] = ''
                else:
                    config['authHeaderValuePrefix'] = 'Bearer '

            if 'model' not in config:
                logger.warning('Config missing model, using default')
                config['model'] = 'gpt-4'

            logger.info(f'Config loaded: provider={config.get("provider")}, model={config.get("model")}')
            return config
    except Exception as e:
        logger.error(f'Failed to load config: {e}, using defaults')
        return {
            'provider': 'openai',
            'apiEndpoint': 'https://api.openai.com/v1',
            'authHeaderName': 'Authorization',
            'authHeaderValuePrefix': 'Bearer ',
            'apiKey': '',
            'model': 'gpt-4',
            'websocketPort': 8765,
        }


async def main():
    config = load_runtime_config()
    port = int(os.environ.get('CLAWMIND_WEBSOCKET_PORT', config.get('websocketPort', 8765)))
    server = HermesServer(host='localhost', port=port, config=config)

    server.register_handler('register', server.handle_register)
    server.register_handler('ping', server.handle_ping)
    server.register_handler('status', server.handle_status)
    server.register_handler('command_result', server.handle_command_result)
    server.register_handler('task.run', server.handle_task_run)
    server.register_handler('desktop.execute', server.handle_desktop_execute)

    await server.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('服务器已停止')
