@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: =====================================================================
:: iDempiere SPA Plugin Build Script (路徑強制校準版)
:: =====================================================================

:: 1. 設定路徑
set "PLUGIN_DIR=%~dp0"
set "PLUGIN_DIR=%PLUGIN_DIR:~0,-1%"

:: 強制指定輸出目錄為您確認存在的 D:\Code\plugins
set "OUTPUT_DIR=D:\Code\plugins"
if not exist "%OUTPUT_DIR%" (
    echo [提示] 找不到 D:\Code\plugins，改用插件目錄下的 dist...
    set "OUTPUT_DIR=%PLUGIN_DIR%\dist"
    if not exist "!OUTPUT_DIR!" mkdir "!OUTPUT_DIR!"
)

set PLUGIN_NAME=tw.mxp.emui
set PLUGIN_VERSION=1.0.1
set "JAR_NAME=%PLUGIN_NAME%-%PLUGIN_VERSION%.jar"
set "FULL_JAR_PATH=%OUTPUT_DIR%\%JAR_NAME%"

set "SERVLET_API_JAR=%PLUGIN_DIR%\lib\servlet-api.jar"
set "BUILD_DIR=%PLUGIN_DIR%\build"
set "BUILD_CLASSES_DIR=%BUILD_DIR%\classes"
set "WEB_CONTENT_DIR=%PLUGIN_DIR%\web-content"

echo [1/5] 環境檢查...
echo 插件路徑: %PLUGIN_DIR%
echo 輸出路徑: %FULL_JAR_PATH%

:: 2. 前端構建
echo [2/5] 執行前端 UI 構建...
if exist "%PLUGIN_DIR%\ui" (
    pushd "%PLUGIN_DIR%\ui"
    where bun >nul 2>nul
    if !ERRORLEVEL! neq 0 (
        echo [提示] 使用 npm 構建...
        call npm install --quiet
        if exist "node_modules\.bin\vite.cmd" (
            call .\node_modules\.bin\vite build
        ) else (
            call npm run build
        )
    ) else (
        call bun install && call bun run build
    )
    popd
)

:: 3. 準備編譯依賴
if not exist "%SERVLET_API_JAR%" (
    echo [下載] 下載 servlet-api.jar...
    if not exist "%PLUGIN_DIR%\lib" mkdir "%PLUGIN_DIR%\lib"
    docker run --rm -v "%PLUGIN_DIR%\lib:/out" maven:3.9-eclipse-temurin-17 ^
    mvn -q dependency:copy -Dartifact=javax.servlet:javax.servlet-api:3.1.0 -DoutputDirectory=/out
    move /y "%PLUGIN_DIR%\lib\javax.servlet-api-3.1.0.jar" "%SERVLET_API_JAR%" >nul
)

:: 4. Java 編譯
echo [3/5] 編譯 Java 原始碼...
if not exist "%BUILD_CLASSES_DIR%" mkdir "%BUILD_CLASSES_DIR%"
javac -encoding UTF-8 -cp "%SERVLET_API_JAR%" -d "%BUILD_CLASSES_DIR%" ^
"%PLUGIN_DIR%\src\tw\mxp\emui\SpaFilter.java" ^
"%PLUGIN_DIR%\src\tw\mxp\emui\SpaServlet.java"

:: 5. 打包 JAR (徹底解決 SoɮשΥؿ 亂碼問題)
echo [4/5] 打包 JAR...
if not exist "%BUILD_DIR%\WEB-INF" mkdir "%BUILD_DIR%\WEB-INF"
if exist "%PLUGIN_DIR%\WEB-INF\web.xml" copy /y "%PLUGIN_DIR%\WEB-INF\web.xml" "%BUILD_DIR%\WEB-INF\" >nul

:: 定位 Web 來源
set "WEB_SRC=web-content"
if exist "%WEB_CONTENT_DIR%\dist\index.html" set "WEB_SRC=web-content\dist"

:: 這裡我們進入 PLUGIN_DIR 確保相對路徑 index.html 能被 jar 找到
pushd "%PLUGIN_DIR%"
:: 先建立 JAR
jar cvfm "%FULL_JAR_PATH%" "META-INF\MANIFEST.MF" -C "%BUILD_CLASSES_DIR%" . -C "build" WEB-INF

:: 加入 HTML (直接使用相對路徑)
if exist "%WEB_SRC%\index.html" (
    jar uvf "%FULL_JAR_PATH%" -C "%WEB_SRC%" index.html
) else (
    echo [錯誤] 找不到 index.html，請檢查前端 build 是否成功。
)

:: 加入 Assets
if exist "%WEB_SRC%\assets" (
    jar uvf "%FULL_JAR_PATH%" -C "%WEB_SRC%" assets
)
popd

:: 6. 部署
echo [5/5] 部署至 Docker...
:: 驗證檔案是否真的在那裡
if exist "%FULL_JAR_PATH%" (
    docker ps --format "{{.Names}}" | findstr /X "idempiere-app" >nul
    if !ERRORLEVEL! equ 0 (
        echo 正在部署至 idempiere-app...
        docker cp "%FULL_JAR_PATH%" idempiere-app:/opt/idempiere/plugins/
        docker restart idempiere-app
        echo 部署完成。
    ) else (
        echo [提示] 容器 idempiere-app 未啟動，請手動執行: 
        echo docker cp "%FULL_JAR_PATH%" idempiere-app:/opt/idempiere/plugins/
    )
) else (
    echo [錯誤] JAR 檔案未能生成於 %FULL_JAR_PATH%
)

echo.
pause