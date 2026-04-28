FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=dev_project.settings

WORKDIR /app

COPY backend/ /app/

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py loaddata seed && python manage.py runserver 0.0.0.0:8000"]
