from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "financetrace",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.worker_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "monthly-financial-summary-1st": {
            "task": "app.tasks.worker_tasks.monthly_summary_task",
            "schedule": crontab(day_of_month="1", hour=8, minute=0),
        }
    },
)
