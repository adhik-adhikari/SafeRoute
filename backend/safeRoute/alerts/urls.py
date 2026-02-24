from django.urls import path
from . import views

urlpatterns = [
    path('risk/', views.RiskAreaAPIView.as_view(), name='risk-area'),
    path('map-risk-areas/', views.MapRiskAreasAPIView.as_view(), name='map-risk-areas'),
    path('report-crime/', views.ReportCrimeAPIView.as_view(), name='report-crime'),
    path('manage-risk-areas/', views.MapRiskAreasAPIView.as_view(), name='manage-risk-areas'),
]