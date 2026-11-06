@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 goto wrongfolder
where git >nul 2>&1
if errorlevel 1 goto missinggit
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto wrongrepo
set "repo="
set "branch="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "repo=%%R"
if not "%repo%"=="https://github.com/7madybar/---------------------.git" goto wrongrepo
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "branch=%%B"
if not "%branch%"=="main" goto wrongbranch
if not exist "index.html" goto missingbuild
if not exist ".nojekyll" goto missingbuild
dir /b "pages-assets\*.js" >nul 2>&1
if errorlevel 1 goto missingbuild
dir /b "pages-assets\*.css" >nul 2>&1
if errorlevel 1 goto missingbuild
if /i "%~1"=="--check" goto checkok
echo Publishing the prepared website source and GitHub Pages files...
git add --all -- .
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 2 goto failed
if not errorlevel 1 goto push
git commit -m "Serve GitHub Pages frontend and add individual team access codes"
if errorlevel 1 goto failed
:push
git push origin main
if errorlevel 1 goto failed
echo.
echo PUBLISH_SUCCESS
echo GitHub Pages may take a few minutes to finish deployment.
echo https://7madybar.github.io/---------------------/
set "publish_exit=0"
goto finish
:checkok
echo CHECK_OK: Git, repository, main branch, and built website files are ready.
exit /b 0
:missinggit
echo ERROR: Git for Windows was not found.
goto stop
:wrongfolder
echo ERROR: Cannot open the project folder.
goto stop
:wrongrepo
echo ERROR: This folder is not connected to the expected GitHub repository.
goto stop
:wrongbranch
echo ERROR: Switch to the main branch before publishing.
goto stop
:missingbuild
echo ERROR: Built website files are missing. Run npm run build:pages first.
goto stop
:failed
echo.
echo ERROR: Publishing did not finish. Read the Git message above.
echo If GitHub asks you to sign in, complete sign-in and run this file again.
:stop
set "publish_exit=1"
:finish
if /i "%~1"=="--check" exit /b %publish_exit%
echo.
pause
exit /b %publish_exit%
