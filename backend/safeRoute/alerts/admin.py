from django.contrib import admin
from .models import CrimeIncident, RiskArea

# Register your models here.
admin.site.register(CrimeIncident)
admin.site.register(RiskArea)
