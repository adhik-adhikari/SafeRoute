"""
Unit and integration tests for route optimizer and safe route API view.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'safeRoute.settings')
django.setup()

from alerts.route_optimizer import (
    haversine_distance,
    evaluate_route_risk,
    calculate_detour_waypoints,
    optimize_routes,
    generate_fallback_polyline
)
from alerts.views import risk_areas


def test_haversine_distance():
    # Distance between ULM Library and Schulze Dining (approx 100-150m)
    dist = haversine_distance(32.5293, -92.0745, 32.5285, -92.0739)
    assert 0.05 < dist < 0.20, f"Unexpected distance: {dist}"
    print("✓ haversine_distance test passed")


def test_evaluate_route_risk():
    # A point directly on ULM Library (which is in risk_areas as High Risk 'A')
    coords = [
        {"latitude": 32.5293, "longitude": -92.0745},
        {"latitude": 32.5294, "longitude": -92.0746}
    ]
    res = evaluate_route_risk(coords, risk_areas)
    assert res["risk_level"] == "A", f"Expected 'A', got {res['risk_level']}"
    assert res["is_safe"] is False, "Expected route to be flagged not safe"
    assert res["intersected_zones_count"] >= 1
    print("✓ evaluate_route_risk (danger zone) test passed")

    # A point far away from any danger zone
    safe_coords = [
        {"latitude": 32.5000, "longitude": -92.0000},
        {"latitude": 32.5001, "longitude": -92.0001}
    ]
    safe_res = evaluate_route_risk(safe_coords, risk_areas)
    assert safe_res["risk_level"] == "D"
    assert safe_res["is_safe"] is True
    assert safe_res["intersected_zones_count"] == 0
    print("✓ evaluate_route_risk (safe zone) test passed")


def test_detour_generation_and_optimization():
    # Route passing right through ULM Library risk zone (32.5293, -92.0745)
    start_lat, start_lon = 32.5270, -92.0745  # South
    end_lat, end_lon = 32.5315, -92.0745      # North

    result = optimize_routes(start_lat, start_lon, end_lat, end_lon, risk_areas, mode="walking")

    assert result["status"] == "success"
    assert "safest_route" in result
    assert "direct_route" in result
    assert len(result["routes"]) >= 1

    safest = result["safest_route"]
    direct = result["direct_route"]

    print(f"Direct route risk score: {direct['risk_score']}, level: {direct['risk_level']}")
    print(f"Safest route risk score: {safest['risk_score']}, level: {safest['risk_level']}")
    print(f"Detour generated: {result.get('risk_avoidance_applied')}")

    # The safest route should have a risk score <= direct route risk score
    assert safest["risk_score"] <= direct["risk_score"]
    assert len(safest["coordinates"]) > 0
    assert len(direct["coordinates"]) > 0
    print("✓ optimize_routes test passed")


def test_safe_route_api_view():
    from rest_framework.test import APIRequestFactory
    from alerts.views import SafeRouteAPIView

    factory = APIRequestFactory()
    view = SafeRouteAPIView.as_view()

    # Valid GET request
    request = factory.get('/api/safe-route/?start_lat=32.5270&start_lon=-92.0745&end_lat=32.5315&end_lon=-92.0745&mode=walking')
    response = view(request)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.data
    assert "safest_route" in data
    assert "direct_route" in data
    print("✓ SafeRouteAPIView GET request passed")

    # Missing parameters
    bad_request = factory.get('/api/safe-route/?start_lat=32.5270')
    bad_response = view(bad_request)
    assert bad_response.status_code == 400
    print("✓ SafeRouteAPIView 400 error handling passed")


if __name__ == "__main__":
    test_haversine_distance()
    test_evaluate_route_risk()
    test_detour_generation_and_optimization()
    test_safe_route_api_view()
    print("\n🎉 ALL ROUTE OPTIMIZATION BACKEND TESTS PASSED!")
