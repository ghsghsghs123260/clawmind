"""
Skills Integration for Hermes
将 Node.js Skills 系统集成到 Python Hermes，带内存缓存
在独立模式下（无 Node.js）优雅降级
"""

import asyncio
import json
import logging
import shutil
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger('SkillsIntegration')


class SkillsIntegration:
    """Skills 系统集成，带缓存避免重复 subprocess 调用"""

    def __init__(self):
        # 检测 Node.js 是否可用 — 如果没有 Node.js，所有 Skills 功能优雅降级
        self._node_available = shutil.which('node') is not None
        if not self._node_available:
            logger.warning('Node.js not found — Skills matching disabled (standalone mode)')
            self.skills_cli = None
            self.project_root = None
        else:
            # Only compute paths when Node.js is available
            self.project_root = Path(__file__).parent.parent
            self.skills_cli = self.project_root / 'skills' / 'cli.js'
            if not self.skills_cli.exists():
                logger.warning(f'Skills CLI not found at {self.skills_cli} — Skills disabled')
                self._node_available = False

        # 缓存
        self._skills_list_cache: Optional[List[Dict[str, Any]]] = None
        self._skills_list_time: float = 0
        self._cache_ttl: float = 300  # 5 分钟

        # match 结果短缓存（同一输入短时间内不重复调用）
        self._match_cache: Dict[str, tuple] = {}
        self._match_cache_ttl: float = 60  # 1 分钟
        self._match_cache_max: int = 200

    def _run_cli(self, args: list, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """调用 Node.js Skills CLI（同步版本，用于非 async 上下文）"""
        if not self._node_available:
            return None
        try:
            result = subprocess.run(
                ['node', str(self.skills_cli)] + args,
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=timeout,
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout.strip())
            if result.stderr:
                logger.warning(f"CLI stderr: {result.stderr.strip()}")
        except FileNotFoundError:
            self._node_available = False
            logger.warning('Node.js not found — Skills CLI disabled')
        except Exception as e:
            logger.warning(f"CLI error: {e}")
        return None

    async def _run_cli_async(self, args: list, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """调用 Node.js Skills CLI（异步版本，不阻塞事件循环）"""
        return await asyncio.to_thread(self._run_cli, args, timeout)

    async def match_input(self, user_input: str, threshold: float = 0.3) -> Optional[Dict[str, Any]]:
        """
        匹配用户输入到 Skill（带短缓存）
        """
        cache_key = f"{user_input}:{threshold}"

        # 检查缓存
        if cache_key in self._match_cache:
            cached_result, cached_time = self._match_cache[cache_key]
            if time.time() - cached_time < self._match_cache_ttl:
                return cached_result

        result = await self._run_cli_async(['match', user_input, '--threshold', str(threshold)])

        # 缓存结果（包括 None 表示无匹配）
        self._match_cache[cache_key] = (result, time.time())

        # 清理过期缓存
        now = time.time()
        expired = [k for k, (_, t) in self._match_cache.items() if now - t > self._match_cache_ttl]
        for k in expired:
            del self._match_cache[k]

        # 超过上限时删除最早的条目
        if len(self._match_cache) > self._match_cache_max:
            oldest_keys = sorted(self._match_cache, key=lambda k: self._match_cache[k][1])[:len(self._match_cache) - self._match_cache_max]
            for k in oldest_keys:
                del self._match_cache[k]

        return result

    def execute_skill(self, skill_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行 Skill（不缓存，每次都实际执行）
        """
        result = self._run_cli(
            ['execute', skill_name, '--params', json.dumps(params)],
            timeout=30,
        )
        return result or {'success': False, 'error': 'Skill execution failed'}

    def get_skill_detail(self, skill_name: str) -> Optional[Dict[str, Any]]:
        """
        获取单个 Skill 的完整定义（含 trigger、parameters、actions）
        """
        result = self._run_cli(['get', skill_name])
        return result.get('skill') if result and result.get('success') else None

    def list_skills(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        列出所有 Skills（带 5 分钟缓存）
        """
        now = time.time()
        if not force_refresh and self._skills_list_cache and (now - self._skills_list_time < self._cache_ttl):
            return self._skills_list_cache

        data = self._run_cli(['list'])
        skills = data.get('skills', []) if data else []

        # Only cache on successful response
        if data:
            self._skills_list_cache = skills
            self._skills_list_time = now
        return skills
