"""CH-625: the backend settings for the GitHub screen-sweep job only. Copied
into the backend's config/ by .github/workflows/isolation-screens.yml.

The test settings (no Redis, no Celery broker, no .env needed) with a file
database of its own, so the seeded accounts are there when the server runs.
"""
from config.test_settings import *  # noqa: F401,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': '/tmp/isolation/db.sqlite3'}}
ALLOWED_HOSTS = ['*']
DEBUG = False
MAIN_ORGANIZATION_SLUG = 'interns'
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
