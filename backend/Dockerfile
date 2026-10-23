# Используем Python 3.12 (3.14 пока нет в стабильных alpine-образах)
FROM python:3.12-slim

# Устанавливаем системные зависимости (нужны для psycopg2, reportlab и pdf-io)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем только requirements, чтобы кэшировать слой
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код бэкенда
COPY . .

# Создаем папку для хранения parquet-файлов (если ее нет)
RUN mkdir -p storage/wells

# Запускаем через gunicorn (4 воркера для стабильности)
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]