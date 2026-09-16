@echo off
setlocal EnableDelayedExpansion
title StockVision Launcher

:: ============================================================
::  StockVision - Local Development Launcher
::  Starts Backend (port 5000) + Frontend (port 5173)
:: ============================================================

:: --- Paths (strip trailing backslash from %~dp0) ------------
set "ROOT=%~dp0"
if "!ROOT:~-1!"=="\" set "ROOT=!ROOT:~0,-1!"
set "BE=!ROOT!\backend"
set "FE=!ROOT!\frontend"
set "ENV=!BE!\.env"
set "ENVEX=!BE!\.env.example"

cls
echo.
echo  ==============================================
echo    StockVision  ^|  AI-Powered Stock Platform
echo  ==============================================
echo.

:: --- 1. Node.js check ---------------------------------------
echo  [1/6] Checking Node.js...
where node 1>nul 2>nul
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install from: https://nodejs.org/
    goto :fail
)
for /f "tokens=*" %%V in ('node --version 2^>nul') do echo         OK  Node.js %%V

:: --- 2. Project structure check -----------------------------
echo  [2/6] Checking project structure...
if not exist "!BE!\package.json" (
    echo  [ERROR] !BE!\package.json not found.
    echo          Make sure start.bat is inside the StockVision\ folder.
    goto :fail
)
if not exist "!FE!\package.json" (
    echo  [ERROR] !FE!\package.json not found.
    goto :fail
)
echo         OK  backend and frontend folders found

:: --- 3. .env setup ------------------------------------------
echo  [3/6] Checking .env...
if not exist "!ENV!" (
    if exist "!ENVEX!" (
        copy "!ENVEX!" "!ENV!" 1>nul
        echo         OK  Created backend\.env from .env.example
    ) else (
        echo  [ERROR] backend\.env.example missing.
        goto :fail
    )
) else (
    echo         OK  backend\.env found
)

:: --- 4. Create logs folder (Winston needs it) ---------------
if not exist "!BE!\logs" mkdir "!BE!\logs" 1>nul

:: --- 5. Backend npm install ---------------------------------
echo  [4/6] Installing backend packages...
pushd "!BE!"
if exist "node_modules\express\package.json" (
    echo         OK  Backend already installed
) else (
    echo         Running npm install ^(first run ^- please wait^)...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Backend npm install failed - see output above.
        popd
        goto :fail
    )
    echo         OK  Backend installed
)
popd

:: --- 6. Frontend npm install --------------------------------
echo  [5/6] Installing frontend packages...
pushd "!FE!"
if exist "node_modules\vite\package.json" (
    echo         OK  Frontend already installed
) else (
    echo         Running npm install ^(first run ^- please wait^)...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Frontend npm install failed - see output above.
        popd
        goto :fail
    )
    echo         OK  Frontend installed
)
popd

:: --- 7. Write helper bat files to %TEMP% -------------------
::  (avoids all nested-quote issues when paths have spaces)

set "BE_BAT=%TEMP%\sv_backend.bat"
set "FE_BAT=%TEMP%\sv_frontend.bat"

echo @echo off                                         > "!BE_BAT!"
echo title StockVision BACKEND                         >> "!BE_BAT!"
echo cd /d "!BE!"                                      >> "!BE_BAT!"
echo echo.                                             >> "!BE_BAT!"
echo echo  ====================================         >> "!BE_BAT!"
echo echo   StockVision BACKEND   port 5000            >> "!BE_BAT!"
echo echo   Ctrl+C to stop                             >> "!BE_BAT!"
echo echo  ====================================         >> "!BE_BAT!"
echo echo.                                             >> "!BE_BAT!"
echo npm run dev                                       >> "!BE_BAT!"
echo echo.                                             >> "!BE_BAT!"
echo echo  Backend stopped.                            >> "!BE_BAT!"
echo pause                                             >> "!BE_BAT!"

echo @echo off                                         > "!FE_BAT!"
echo title StockVision FRONTEND                        >> "!FE_BAT!"
echo cd /d "!FE!"                                      >> "!FE_BAT!"
echo echo.                                             >> "!FE_BAT!"
echo echo  ====================================         >> "!FE_BAT!"
echo echo   StockVision FRONTEND  port 5173            >> "!FE_BAT!"
echo echo   Ctrl+C to stop                             >> "!FE_BAT!"
echo echo  ====================================         >> "!FE_BAT!"
echo echo.                                             >> "!FE_BAT!"
echo npm run dev                                       >> "!FE_BAT!"
echo echo.                                             >> "!FE_BAT!"
echo echo  Frontend stopped.                           >> "!FE_BAT!"
echo pause                                             >> "!FE_BAT!"

:: --- 8. Launch servers in separate windows -----------------
echo  [6/6] Starting servers...

start "StockVision BACKEND"  cmd /k "!BE_BAT!"
echo         Backend  window opened ^(port 5000^)

timeout /t 4 /nobreak >nul

start "StockVision FRONTEND" cmd /k "!FE_BAT!"
echo         Frontend window opened ^(port 5173^)

:: --- 9. Wait then open browser ----------------------------
echo.
echo  Waiting for Vite to start ^(10 sec^)...
timeout /t 10 /nobreak >nul

echo  Opening http://localhost:5173 ...
start "" "http://localhost:5173"

:: --- Done -------------------------------------------------
echo.
echo  ==============================================
echo   StockVision is running!
echo  ==============================================
echo.
echo   App      :  http://localhost:5173
echo   API      :  http://localhost:5000
echo   Health   :  http://localhost:5000/health
echo.
echo   Two windows are open (BACKEND + FRONTEND).
echo   Close them to stop the servers.
echo.
echo   FIRST TIME?  Register at /register
echo   ADMIN?       Set ADMIN_REGISTRATION_SECRET in
echo                backend\.env then POST to
echo                /api/auth/register-admin
echo.
echo  Press any key to close this launcher.
pause >nul
goto :eof

:fail
echo.
echo  -----------------------------------------------
echo   Launch failed. Fix the error above and retry.
echo  -----------------------------------------------
pause
exit /b 1
