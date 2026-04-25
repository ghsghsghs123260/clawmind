"""PyInstaller runtime hook: add bundle directories to sys.path"""
import sys
import os

# In onefile mode, PyInstaller extracts to sys._MEIPASS
# In onedir mode, use the executable's directory
if getattr(sys, 'frozen', False):
    base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    # Add the bundle root so bare imports (from executor import ...) work
    if base not in sys.path:
        sys.path.insert(0, base)
