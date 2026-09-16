@echo off
title StockVision - Stop

echo.
echo  Stopping StockVision servers...
echo.

:: Kill node processes on ports 5000 and 5173
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    echo  Killing backend process (PID %%p)...
    taskkill /F /PID %%p >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo  Killing frontend process (PID %%p)...
    taskkill /F /PID %%p >nul 2>&1
)

:: Close the named terminal windows
taskkill /FI "WINDOWTITLE eq StockVision Backend :5000" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq StockVision Frontend :5173" /F >nul 2>&1

echo  [OK] StockVision servers stopped.
echo.
pause
