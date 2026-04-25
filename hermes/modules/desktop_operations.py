"""
桌面控制模块 (PyAutoGUI)
"""

import pyautogui
import time
from typing import Dict, Any


class DesktopOperations:
    """桌面控制操作"""

    def __init__(self):
        # 设置安全延迟
        pyautogui.PAUSE = 0.1
        # 启用故障安全（鼠标移到屏幕角落会抛出异常）
        pyautogui.FAILSAFE = True

    def screenshot(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """截图"""
        path = params.get('path')
        region = params.get('region')  # (x, y, width, height)

        if not path:
            raise ValueError('缺少参数: path')

        try:
            if region:
                screenshot = pyautogui.screenshot(region=region)
            else:
                screenshot = pyautogui.screenshot()

            screenshot.save(path)

            return {
                'success': True,
                'path': path,
                'size': screenshot.size
            }
        except Exception as e:
            raise Exception(f'截图失败: {str(e)}')

    def mouse_move(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """移动鼠标"""
        x = params.get('x')
        y = params.get('y')
        duration = params.get('duration', 0.2)

        if x is None or y is None:
            raise ValueError('缺少参数: x 或 y')

        try:
            pyautogui.moveTo(x, y, duration=duration)

            return {
                'success': True,
                'position': (x, y)
            }
        except Exception as e:
            raise Exception(f'移动鼠标失败: {str(e)}')

    def mouse_click(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """鼠标点击"""
        x = params.get('x')
        y = params.get('y')
        button = params.get('button', 'left')  # left, right, middle
        clicks = params.get('clicks', 1)

        try:
            if x is not None and y is not None:
                pyautogui.click(x, y, clicks=clicks, button=button)
            else:
                pyautogui.click(clicks=clicks, button=button)

            return {
                'success': True,
                'button': button,
                'clicks': clicks
            }
        except Exception as e:
            raise Exception(f'鼠标点击失败: {str(e)}')

    def mouse_drag(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """鼠标拖拽"""
        x = params.get('x')
        y = params.get('y')
        duration = params.get('duration', 0.2)
        button = params.get('button', 'left')

        if x is None or y is None:
            raise ValueError('缺少参数: x 或 y')

        try:
            pyautogui.drag(x, y, duration=duration, button=button)

            return {
                'success': True,
                'offset': (x, y)
            }
        except Exception as e:
            raise Exception(f'鼠标拖拽失败: {str(e)}')

    def mouse_scroll(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """鼠标滚动"""
        clicks = params.get('clicks', 1)  # 正数向上，负数向下

        try:
            pyautogui.scroll(clicks)

            return {
                'success': True,
                'clicks': clicks
            }
        except Exception as e:
            raise Exception(f'鼠标滚动失败: {str(e)}')

    def get_mouse_position(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取鼠标位置"""
        try:
            x, y = pyautogui.position()

            return {
                'success': True,
                'position': {'x': x, 'y': y}
            }
        except Exception as e:
            raise Exception(f'获取鼠标位置失败: {str(e)}')

    def keyboard_type(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """键盘输入（支持中文等非 ASCII 字符）"""
        text = params.get('text')
        interval = params.get('interval', 0.05)

        if text is None:
            raise ValueError('缺少参数: text')

        try:
            # For non-ASCII text, use clipboard paste instead of pyautogui.write
            if text and not text.isascii():
                import pyperclip
                pyperclip.copy(text)
                # Ctrl+V on Windows/Linux, Cmd+V on macOS
                import platform
                if platform.system() == 'Darwin':
                    pyautogui.hotkey('command', 'v')
                else:
                    pyautogui.hotkey('ctrl', 'v')
            else:
                pyautogui.write(text, interval=interval)

            return {
                'success': True,
                'text': text
            }
        except Exception as e:
            raise Exception(f'键盘输入失败: {str(e)}')

    def keyboard_press(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """按键"""
        key = params.get('key')
        presses = params.get('presses', 1)

        if not key:
            raise ValueError('缺少参数: key')

        try:
            pyautogui.press(key, presses=presses)

            return {
                'success': True,
                'key': key,
                'presses': presses
            }
        except Exception as e:
            raise Exception(f'按键失败: {str(e)}')

    def keyboard_hotkey(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """组合键"""
        keys = params.get('keys')

        if not keys or not isinstance(keys, list):
            raise ValueError('缺少参数: keys (必须是列表)')

        try:
            pyautogui.hotkey(*keys)

            return {
                'success': True,
                'keys': keys
            }
        except Exception as e:
            raise Exception(f'组合键失败: {str(e)}')

    def find_image(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """查找图像"""
        image_path = params.get('image')
        confidence = params.get('confidence', 0.9)

        if not image_path:
            raise ValueError('缺少参数: image')

        try:
            location = pyautogui.locateOnScreen(image_path, confidence=confidence)

            if location:
                center = pyautogui.center(location)
                return {
                    'success': True,
                    'found': True,
                    'location': {
                        'left': location.left,
                        'top': location.top,
                        'width': location.width,
                        'height': location.height
                    },
                    'center': {'x': center.x, 'y': center.y}
                }
            else:
                return {
                    'success': True,
                    'found': False
                }
        except Exception as e:
            raise Exception(f'查找图像失败: {str(e)}')

    def get_screen_size(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """获取屏幕尺寸"""
        try:
            width, height = pyautogui.size()

            return {
                'success': True,
                'width': width,
                'height': height
            }
        except Exception as e:
            raise Exception(f'获取屏幕尺寸失败: {str(e)}')

    def alert(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """显示警告框"""
        text = params.get('text', '')
        title = params.get('title', 'Alert')

        try:
            pyautogui.alert(text=text, title=title)

            return {
                'success': True
            }
        except Exception as e:
            raise Exception(f'显示警告框失败: {str(e)}')
