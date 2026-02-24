import os
import django
from datetime import datetime, timedelta

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'safeRoute.settings')
django.setup()

from alerts.models import CrimeIncident

# ULM Library coordinates (high risk)
ULM_LIBRARY_LAT = 32.5293
ULM_LIBRARY_LON = -92.0745

# Schulze Dining coordinates (low risk)
SCHULZE_LAT = 32.5285
SCHULZE_LON = -92.0739

# Clear existing data
CrimeIncident.objects.all().delete()

# Add dummy incidents
incidents = [
    # High-risk area near library (multiple recent, severe incidents)
    {
        'latitude': ULM_LIBRARY_LAT,
        'longitude': ULM_LIBRARY_LON,
        'description': 'Robbery reported',
        'reported_at': datetime.now() - timedelta(hours=2),
        'severity': 4
    },
    {
        'latitude': ULM_LIBRARY_LAT + 0.0001,
        'longitude': ULM_LIBRARY_LON + 0.0001,
        'description': 'Assault incident',
        'reported_at': datetime.now() - timedelta(days=1),
        'severity': 4
    },
    # Moderate risk area (single recent incident)
    {
        'latitude': ULM_LIBRARY_LAT - 0.001,
        'longitude': ULM_LIBRARY_LON - 0.001,
        'description': 'Theft reported',
        'reported_at': datetime.now() - timedelta(days=2),
        'severity': 2
    },
    # Low risk area near Schulze (old, minor incidents)
    {
        'latitude': SCHULZE_LAT,
        'longitude': SCHULZE_LON,
        'description': 'Minor disturbance',
        'reported_at': datetime.now() - timedelta(days=15),
        'severity': 1
    },
    {
        'latitude': SCHULZE_LAT + 0.0001,
        'longitude': SCHULZE_LON + 0.0001,
        'description': 'Suspicious activity',
        'reported_at': datetime.now() - timedelta(days=20),
        'severity': 1
    }
]

# Create incidents
for incident in incidents:
    CrimeIncident.objects.create(**incident)

print("Added dummy incidents successfully!") 