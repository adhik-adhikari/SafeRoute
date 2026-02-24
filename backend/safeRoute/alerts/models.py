from django.db import models

class CrimeIncident(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField()
    reported_at = models.DateTimeField(auto_now_add=True)
    severity = models.IntegerField(default = 1)
    
    def __str__(self):
        return f"Crime at ({self.latitude}, {self.longitude})-{self.description}"
  
class RiskArea(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    risk_score = models.FloatField()
    risk_category = models.CharField(max_length = 1)
    crime_type = models.CharField(max_length = 50, default='unknown')
    computed_at = models.DateTimeField(auto_now = True)
    
    def __str__(self):
        return f"RiskArea at ({self.latitude}, {self.longitude}): {self.risk_category}"

class Device(models.Model):
    push_token = models.CharField(max_length=255, unique=True)
    device_id = models.CharField(max_length=255)
    platform = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.platform} device ({self.device_id})"
