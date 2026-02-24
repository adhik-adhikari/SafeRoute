from rest_framework import serializers
from .models import CrimeIncident
from django.utils import timezone

class CrimeIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrimeIncident
        fields = ['latitude', 'longitude', 'description', 'reported_at', 'severity']
    
    def create(self, validated_data):
        # If reported_at is not provided, set it to current time
        if 'reported_at' not in validated_data:
            validated_data['reported_at'] = timezone.now()
        return super().create(validated_data) 