from django.urls import path
from . import views

urlpatterns = [
    path('risk/', views.RiskAreaAPIView.as_view(), name='risk-area'),
    path('risk-areas/', views.RiskAreaAPIView.as_view(), name='risk-areas'),
    path('map-risk-areas/', views.MapRiskAreasAPIView.as_view(), name='map-risk-areas'),
    path('report-crime/', views.ReportCrimeAPIView.as_view(), name='report-crime'),
    path('crime-reports/', views.ReportCrimeAPIView.as_view(), name='crime-reports'),
    path('crime-incidents/', views.CrimeIncidentListView.as_view(), name='crime-incidents'),
    path('manage-risk-areas/', views.MapRiskAreasAPIView.as_view(), name='manage-risk-areas'),
    path('register-device/', views.register_device, name='register-device'),
    path('safe-route/', views.SafeRouteAPIView.as_view(), name='safe-route'),
    path('optimized-route/', views.SafeRouteAPIView.as_view(), name='optimized-route'),
]