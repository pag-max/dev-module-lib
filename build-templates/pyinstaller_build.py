# PyInstaller 打包模板（onedir，免安装、启动快）
# 用法：python pyinstaller_build.py
# 约定：先构建到临时目录再 cp 回产物（见脚本注释），避免污染源码。
import PyInstaller.__main__
import shutil, os, tempfile

APP = 'main.py'                 # 入口
NAME = 'MyTool'
ICON = 'assets/icon.ico'        # 无则删掉 --icon 行
HIDDEN = []                     # 隐藏导入，按需加

tmp = tempfile.mkdtemp(prefix='build_')
PyInstaller.__main__.run([
    APP,
    '--name', NAME,
    '--onedir',                 # onedir：启动快、易排查
    '--noconfirm',
    '--clean',
    '--windowed',               # GUI 程序去控制台；命令行删掉此行
    '--paths', '.',
    *(['--icon', ICON] if os.path.exists(ICON) else []),
    *sum((['--hidden-import', h] for h in HIDDEN), []),
    '--distpath', os.path.join(tmp, 'dist'),
    '--workpath', os.path.join(tmp, 'build'),
])

# 构建落在临时目录，完成后 cp 回 ./dist，保持源码目录干净
dst = os.path.join(os.getcwd(), 'dist')
if os.path.exists(dst): shutil.rmtree(dst)
shutil.copytree(os.path.join(tmp, 'dist', NAME), os.path.join(dst, NAME))
shutil.rmtree(tmp)
print('构建完成 ->', os.path.join(dst, NAME))
