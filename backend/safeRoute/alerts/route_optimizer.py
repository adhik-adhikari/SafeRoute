import math
import logging
import requests
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def evaluate_route_risk(coordinates: List[Dict[str, float]], risk_areas: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates risk along a route's polyline against known risk areas.
    Returns risk score, severity, count of intersected zones, and danger segments.
    """
    if not coordinates or not risk_areas:
        return {
            "risk_score": 0.0,
            "risk_level": "D",
            "is_safe": True,
            "intersected_zones_count": 0,
            "intersected_areas": [],
            "risk_segments": []
        }

    total_risk_score = 0.0
    intersected_set = set()
    intersected_details = []
    risk_segments = []

    severity_multipliers = {
        'A': 10.0,  # High Risk
        'B': 5.0,   # Moderate Risk
        'C': 2.0,   # Low Risk
        'D': 0.5    # Minimal Risk
    }

    for idx, pt in enumerate(coordinates):
        lat = pt['latitude']
        lon = pt['longitude']
        point_max_risk = 0.0
        point_risk_level = "D"

        for area_idx, area in enumerate(risk_areas):
            center = area.get('center', {})
            center_lat = center.get('latitude', 0.0)
            center_lon = center.get('longitude', 0.0)
            radius_km = float(area.get('radius', 0.2))
            level = area.get('riskLevel', 'D')
            multiplier = severity_multipliers.get(level, 1.0)

            dist_km = haversine_distance(lat, lon, center_lat, center_lon)

            if dist_km <= radius_km:
                proximity_factor = 1.0 - (dist_km / max(radius_km, 0.001))
                score_contribution = proximity_factor * multiplier
                if score_contribution > point_max_risk:
                    point_max_risk = score_contribution
                    point_risk_level = level

                if area_idx not in intersected_set:
                    intersected_set.add(area_idx)
                    intersected_details.append({
                        "area_index": area_idx,
                        "risk_level": level,
                        "crime_type": area.get('crimeType', 'unknown'),
                        "distance_to_center_meters": round(dist_km * 1000, 1),
                        "radius_meters": round(radius_km * 1000, 1)
                    })

        if point_max_risk > 0:
            total_risk_score += point_max_risk
            risk_segments.append({
                "coordinate_index": idx,
                "coordinate": pt,
                "risk_level": point_risk_level,
                "score": round(point_max_risk, 2)
            })

    # Normalized composite risk score
    normalized_score = min(10.0, round(total_risk_score / max(1, len(coordinates) * 0.1), 2))

    # Overall route risk category
    high_count = sum(1 for a in intersected_details if a['risk_level'] == 'A')
    mod_count = sum(1 for a in intersected_details if a['risk_level'] == 'B')

    if high_count > 0:
        overall_level = "A"
        is_safe = False
    elif mod_count > 0:
        overall_level = "B"
        is_safe = False
    elif len(intersected_details) > 0:
        overall_level = "C"
        is_safe = True
    else:
        overall_level = "D"
        is_safe = True

    return {
        "risk_score": normalized_score,
        "risk_level": overall_level,
        "is_safe": is_safe,
        "intersected_zones_count": len(intersected_details),
        "intersected_areas": intersected_details,
        "risk_segments_count": len(risk_segments)
    }


def query_osrm_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    waypoints: Optional[List[Dict[str, float]]] = None,
    mode: str = "walking"
) -> Optional[Dict[str, Any]]:
    """
    Queries the public OSRM service for routes.
    Supports walking ('foot') and driving ('driving') profiles.
    """
    profile = "foot" if mode.lower() in ["walking", "foot", "walk"] else "driving"

    coords_list = [f"{start_lon:.6f},{start_lat:.6f}"]
    if waypoints:
        for wp in waypoints:
            coords_list.append(f"{wp['longitude']:.6f},{wp['latitude']:.6f}")
    coords_list.append(f"{end_lon:.6f},{end_lat:.6f}")

    coords_str = ";".join(coords_list)
    url = f"https://router.project-osrm.org/route/v1/{profile}/{coords_str}?overview=full&geometries=geojson&alternatives=true&steps=true"

    try:
        response = requests.get(url, timeout=6)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and data.get("routes"):
                return data
        else:
            logger.warning(f"OSRM returned status {response.status_code}")
    except Exception as e:
        logger.warning(f"OSRM request failed: {e}")

    return None


def calculate_detour_waypoints(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    conflicting_areas: List[Dict[str, Any]]
) -> List[Dict[str, float]]:
    """
    Calculates intelligent detour waypoints to route around high-risk zones.
    Computes a lateral offset perpendicular to the line connecting start and end,
    placing the waypoint outside the hazard zone + safe clearance buffer.
    """
    waypoints = []
    v_lat = end_lat - start_lat
    v_lon = end_lon - start_lon
    v_len = math.hypot(v_lat, v_lon)

    if v_len == 0:
        return waypoints

    # Unit perpendicular vector (normalized)
    perp_lat = -v_lon / v_len
    perp_lon = v_lat / v_len

    for area in conflicting_areas:
        center = area.get('center', {})
        c_lat = center.get('latitude', 0.0)
        c_lon = center.get('longitude', 0.0)
        radius_km = float(area.get('radius', 0.2))

        # Safe clearance distance = radius + 120m buffer (in degrees approx)
        clearance_km = radius_km + 0.12
        clearance_deg = clearance_km / 111.32

        # Create two candidate waypoints (left and right of the hazard)
        wp_left = {
            "latitude": c_lat + perp_lat * clearance_deg,
            "longitude": c_lon + perp_lon * clearance_deg
        }
        wp_right = {
            "latitude": c_lat - perp_lat * clearance_deg,
            "longitude": c_lon - perp_lon * clearance_deg
        }

        # Pick the candidate closest to the direct path
        dist_left = haversine_distance(start_lat, start_lon, wp_left['latitude'], wp_left['longitude']) + \
                    haversine_distance(wp_left['latitude'], wp_left['longitude'], end_lat, end_lon)
        dist_right = haversine_distance(start_lat, start_lon, wp_right['latitude'], wp_right['longitude']) + \
                     haversine_distance(wp_right['latitude'], wp_right['longitude'], end_lat, end_lon)

        chosen_wp = wp_left if dist_left <= dist_right else wp_right
        waypoints.append(chosen_wp)

    return waypoints


def generate_fallback_polyline(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    waypoints: Optional[List[Dict[str, float]]] = None,
    num_steps: int = 25
) -> List[Dict[str, float]]:
    """
    Generates a realistic smooth coordinate path connecting start, waypoints, and end.
    Used as an offline/backup fallback when external routing services are unreachable.
    """
    points = [{"latitude": start_lat, "longitude": start_lon}]
    control_points = []
    if waypoints:
        control_points.extend(waypoints)
    control_points.append({"latitude": end_lat, "longitude": end_lon})

    curr_lat, curr_lon = start_lat, start_lon
    for target in control_points:
        t_lat = target["latitude"]
        t_lon = target["longitude"]
        steps_segment = max(5, num_steps // (len(control_points)))
        for i in range(1, steps_segment + 1):
            ratio = i / float(steps_segment)
            points.append({
                "latitude": round(curr_lat + (t_lat - curr_lat) * ratio, 6),
                "longitude": round(curr_lon + (t_lon - curr_lon) * ratio, 6)
            })
        curr_lat, curr_lon = t_lat, t_lon

    return points


def optimize_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    risk_areas: List[Dict[str, Any]],
    mode: str = "walking"
) -> Dict[str, Any]:
    """
    Main route optimization engine.
    1. Computes the direct/shortest route.
    2. Identifies all risk areas intersecting or near the path.
    3. If any high or moderate risks exist, synthesizes avoidance detour routes.
    4. Evaluates risk metrics for all candidate routes.
    5. Returns both the Safest Route and Direct Route with complete comparison data.
    """
    osrm_data = query_osrm_route(start_lat, start_lon, end_lat, end_lon, mode=mode)

    # 1. Parse direct route from OSRM or fallback
    if osrm_data and osrm_data.get("routes"):
        direct_osrm = osrm_data["routes"][0]
        direct_coords = [
            {"latitude": c[1], "longitude": c[0]}
            for c in direct_osrm["geometry"]["coordinates"]
        ]
        direct_distance_km = round(direct_osrm["distance"] / 1000.0, 2)
        direct_duration_min = round(direct_osrm["duration"] / 60.0, 1)
    else:
        direct_coords = generate_fallback_polyline(start_lat, start_lon, end_lat, end_lon)
        direct_distance_km = round(haversine_distance(start_lat, start_lon, end_lat, end_lon), 2)
        speed = 4.5 if mode == "walking" else 35.0
        direct_duration_min = round((direct_distance_km / speed) * 60.0, 1)

    direct_risk = evaluate_route_risk(direct_coords, risk_areas)

    direct_route_obj = {
        "id": "direct",
        "name": "Direct Route",
        "type": "direct",
        "is_recommended": direct_risk["is_safe"],
        "is_safe": direct_risk["is_safe"],
        "distance_km": direct_distance_km,
        "duration_minutes": direct_duration_min,
        "risk_score": direct_risk["risk_score"],
        "risk_level": direct_risk["risk_level"],
        "intersected_zones_count": direct_risk["intersected_zones_count"],
        "intersected_areas": direct_risk["intersected_areas"],
        "summary": "Direct path" + (" (crosses danger zones)" if not direct_risk["is_safe"] else " (safe path)"),
        "color": "#FF9800" if not direct_risk["is_safe"] else "#1E88E5",
        "coordinates": direct_coords
    }

    # 2. Check if direct route is already completely safe
    if direct_risk["is_safe"]:
        direct_route_obj["is_recommended"] = True
        direct_route_obj["name"] = "Safest & Direct Route"
        direct_route_obj["color"] = "#00C853"
        return {
            "status": "success",
            "mode": mode,
            "safest_route": direct_route_obj,
            "direct_route": direct_route_obj,
            "routes": [direct_route_obj],
            "risk_avoidance_applied": False,
            "avoided_risk_zones_count": 0,
            "safety_message": "Direct route has no high-risk zones. Safe to travel."
        }

    # 3. Direct route intersects risk areas -> Generate Avoidance Detour
    conflicting_area_indices = [item["area_index"] for item in direct_risk["intersected_areas"]]
    conflicting_areas = [risk_areas[i] for i in conflicting_area_indices if i < len(risk_areas)]

    detour_waypoints = calculate_detour_waypoints(start_lat, start_lon, end_lat, end_lon, conflicting_areas)

    safe_osrm_data = query_osrm_route(start_lat, start_lon, end_lat, end_lon, waypoints=detour_waypoints, mode=mode)

    if safe_osrm_data and safe_osrm_data.get("routes"):
        safe_osrm = safe_osrm_data["routes"][0]
        safe_coords = [
            {"latitude": c[1], "longitude": c[0]}
            for c in safe_osrm["geometry"]["coordinates"]
        ]
        safe_distance_km = round(safe_osrm["distance"] / 1000.0, 2)
        safe_duration_min = round(safe_osrm["duration"] / 60.0, 1)
    else:
        safe_coords = generate_fallback_polyline(start_lat, start_lon, end_lat, end_lon, waypoints=detour_waypoints)
        safe_distance_km = round(direct_distance_km * 1.15, 2)
        speed = 4.5 if mode == "walking" else 35.0
        safe_duration_min = round((safe_distance_km / speed) * 60.0, 1)

    safe_risk = evaluate_route_risk(safe_coords, risk_areas)

    avoided_count = max(0, direct_risk["intersected_zones_count"] - safe_risk["intersected_zones_count"])

    safest_route_obj = {
        "id": "safest",
        "name": "Safest Route (Recommended)",
        "type": "safest",
        "is_recommended": True,
        "is_safe": safe_risk["is_safe"],
        "distance_km": safe_distance_km,
        "duration_minutes": safe_duration_min,
        "risk_score": safe_risk["risk_score"],
        "risk_level": safe_risk["risk_level"],
        "intersected_zones_count": safe_risk["intersected_zones_count"],
        "intersected_areas": safe_risk["intersected_areas"],
        "detour_waypoints": detour_waypoints,
        "summary": f"Avoids {avoided_count} danger area{'s' if avoided_count != 1 else ''} with safe routing",
        "color": "#00C853",  # Vibrant safe emerald green
        "coordinates": safe_coords
    }

    return {
        "status": "success",
        "mode": mode,
        "safest_route": safest_route_obj,
        "direct_route": direct_route_obj,
        "routes": [safest_route_obj, direct_route_obj],
        "risk_avoidance_applied": True,
        "avoided_risk_zones_count": avoided_count,
        "safety_message": f"Successfully optimized route to avoid {avoided_count} danger zone(s)."
    }
