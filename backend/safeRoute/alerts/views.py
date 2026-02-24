from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CrimeIncident, RiskArea
from .models import Device
from .utils import compute_risk_score, ai_predict_risk, calculate_distance
from django.utils import timezone
from .serializers import CrimeIncidentSerializer
import logging
import math
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

logger = logging.getLogger(__name__)

# Initialize risk areas list with dummy data
risk_areas = [
    {
        'center': {'latitude': 32.505, 'longitude': -92.1239},  # Current location (High Risk)
        'radius': 0.2,  # 200 meters
        'riskLevel': 'A',
        'crimeType': 'unknown'
    },
    {
        'center': {'latitude': 32.505224, 'longitude': -92.1239},  # 25 meters north of current location
        'radius': 0.025,  # 25 meters radius
        'riskLevel': 'A',
        'crimeType': 'test_area'
    },
    {
        'center': {'latitude': 32.5293, 'longitude': -92.0745},  # ULM Library (High Risk)
        'radius': 0.2,  # 200 meters
        'riskLevel': 'A',
        'crimeType': 'unknown'
    },
    {
        'center': {'latitude': 32.5285, 'longitude': -92.0739},  # Schulze Dining (Low Risk)
        'radius': 0.2,  # 200 meters
        'riskLevel': 'C',
        'crimeType': 'unknown'
    }
]

class RiskAreaAPIView(APIView):
    def get(self, request, format=None):
        try:
            # Log incoming request
            logger.info(f"Received risk area request with params: {request.query_params}")
            
            lat = request.query_params.get('lat')
            lon = request.query_params.get('lon')
            radius = request.query_params.get('radius', 1.0)
            
            if lat is None or lon is None:
                return Response({
                    "error": "Please provide 'lat' and 'lon' query parameters."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                user_lat = float(lat)
                user_lon = float(lon)
                radius_km = float(radius)
            except ValueError:
                return Response({
                    "error": "'lat', 'lon', and 'radius' must be numeric."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # For now, just return the dummy risk areas
            response_data = {
                "risk_areas": risk_areas,
                "message": "Using dummy data for risk areas"
            }
            
            logger.info(f"Returning dummy risk areas")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing risk area request: {str(e)}", exc_info=True)
            return Response({
                "error": f"An error occurred while processing your request: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ReportCrimeAPIView(APIView):
    def post(self, request, format=None):
        try:
            logger.info(f"Received crime report: {request.data}")
            
            # Prepare the data for the serializer
            data = request.data.copy()
            logger.info(f"Data before processing: {data}")
            
            if 'reported_at' not in data:
                data['reported_at'] = timezone.now()
            
            serializer = CrimeIncidentSerializer(data=data)
            if serializer.is_valid():
                incident = serializer.save()
                logger.info(f"Saved crime incident: {incident.id}")
                
                try:
                    user_lat = float(data.get("latitude"))
                    user_lon = float(data.get("longitude"))
                    # Extract crime type from description
                    description = data.get("description", "")
                    crime_type = description.split(":")[0] if ":" in description else "unknown"
                    # Get risk level based on severity
                    severity = data.get("severity", 1)
                    risk_level = 'A' if severity >= 4 else 'B' if severity >= 3 else 'C' if severity >= 2 else 'D'
                except (ValueError, TypeError) as e:
                    logger.error(f"Invalid coordinates: {e}")
                    return Response({
                        "error": "Invalid latitude or longitude"
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update the risk areas list with the new report
                risk_areas.append({
                    'center': {'latitude': user_lat, 'longitude': user_lon},
                    'radius': 0.2,  # 200 meters
                    'riskLevel': risk_level,
                    'crimeType': crime_type
                })
                
                response_data = {
                    "crime_report": serializer.data,
                    "risk_area": {
                        "risk_category": risk_level,
                        "risk_level": risk_level,  # Include both for backward compatibility
                        "crime_type": crime_type,
                        "message": "Using severity-based risk level"
                    }
                }
                
                logger.info(f"Successfully processed report: {response_data}")
                return Response(response_data, status=status.HTTP_201_CREATED)
                
            else:
                logger.error(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error processing crime report: {str(e)}", exc_info=True)
            return Response({
                "error": f"An error occurred while processing the report: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MapRiskAreasAPIView(APIView):
    def get(self, request, format=None):
        try:
            # Get map bounds from query parameters
            ne_lat = float(request.query_params.get('ne_lat', 0))
            ne_lng = float(request.query_params.get('ne_lng', 0))
            sw_lat = float(request.query_params.get('sw_lat', 0))
            sw_lng = float(request.query_params.get('sw_lng', 0))
            
            # Convert to response format with circles
            areas = []
            for area in risk_areas:
                lat = area['center']['latitude']
                lng = area['center']['longitude']
                radius_km = area['radius']
                
                # Convert radius from kilometers to degrees
                radius_deg = radius_km / 111.32
                
                # Only include areas that are within the map bounds
                if (sw_lat <= lat <= ne_lat and sw_lng <= lng <= ne_lng):
                    # Generate points for a circle
                    points = []
                    for i in range(0, 360, 10):  # Create points every 10 degrees
                        angle = i * (3.14159 / 180)  # Convert to radians
                        point_lat = lat + (radius_deg * math.cos(angle))
                        point_lng = lng + (radius_deg * math.sin(angle))
                        points.append({'latitude': point_lat, 'longitude': point_lng})
                    
                    areas.append({
                        'coordinates': points,
                        'riskLevel': area['riskLevel'],
                        'center': area['center'],
                        'radius': radius_km,
                        'crimeType': area.get('crimeType', 'unknown')
                    })
            
            return Response({'areas': areas}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting map risk areas: {str(e)}")
            return Response({
                'error': 'An error occurred while fetching risk areas'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, format=None):
        try:
            # Clear all risk areas
            risk_areas.clear()
            return Response({
                "message": "Successfully cleared all risk areas"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error deleting risk areas: {str(e)}")
            return Response({
                "error": "An error occurred while deleting risk areas"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
@require_http_methods(["POST"])
def register_device(request):
    try:
        data = json.loads(request.body)
        push_token = data.get('push_token')
        device_id = data.get('device_id')
        platform = data.get('platform')

        if not all([push_token, device_id, platform]):
            return JsonResponse({'error': 'Missing required fields'}, status=400)

        # Update or create device
        device, created = Device.objects.update_or_create(
            device_id=device_id,
            defaults={
                'push_token': push_token,
                'platform': platform
            }
        )

        return JsonResponse({
            'status': 'success',
            'message': 'Device registered successfully',
            'device_id': device.id
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def send_push_notification(device_token, title, body):
    """
    Send a push notification to a specific device
    """
    try:
        message = {
            'to': device_token,
            'sound': 'default',
            'title': title,
            'body': body,
            'data': {'someData': 'goes here'},
        }

        headers = {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        }

        response = requests.post(
            'https://exp.host/--/api/v2/push/send',
            headers=headers,
            json=message
        )

        return response.status_code == 200

    except Exception as e:
        print(f"Error sending push notification: {str(e)}")
        return False 