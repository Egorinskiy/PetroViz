# PetroViz - запуск dev-сервера
# Использование: .\run.ps1

$ErrorActionPreference = "Stop"

# Активируем venv
if (-not (Test-Path "venv\Scripts\Activate.ps1")) {
    Write-Host "venv не найден. Создай: python -m venv venv" -ForegroundColor Red
    exit 1
}
& "venv\Scripts\Activate.ps1"

# Убеждаемся, что зависимости установлены
pip install -q -r requirements.txt

# Запускаем сервер
Write-Host "PetroViz API: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Swagger:      http://127.0.0.1:8000/docs" -ForegroundColor Green
uvicorn app.main:app --reload