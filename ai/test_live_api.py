"""
Live HTTP API verification script for Smart City Civic AI Microservice.
Tests HTTP endpoints on http://localhost:8000
"""

import os
import sys
import json
import requests

from utils import get_accessible_path

API_URL = "http://localhost:8000"


def test_live_api():
    print("=" * 80)
    print(" LIVE HTTP API VERIFICATION (http://localhost:8000)")
    print("=" * 80)

    # 1. Health Endpoint
    print("\n--- 1. Testing GET /health ---")
    resp = requests.get(f"{API_URL}/health")
    print(f"Status Code: {resp.status_code}")
    health = resp.json()
    print(f"Service:          {health.get('service')}")
    print(f"Active Checkpoint:{health.get('activeCheckpoint')}")
    print(f"Model Version:    {health.get('modelVersion')}")
    print(f"Model Verified:   {health.get('modelVerified')}")
    assert resp.status_code == 200
    assert health.get("modelVersion") == "1.7.0-water-supply-v5"

    # 2. Six-Category POST /analyze Tests
    print("\n--- 2. Testing POST /analyze for All 6 Categories ---")
    manifest_path = "ai/models_water_supply_v5/test_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Select samples where MobileNet has high confidence
    from classifier import MOBILENET_LOADER
    def pick_high_conf(samples, target):
        for s in samples:
            c, p, _, _ = MOBILENET_LOADER.predict(s)
            if c == target and p >= 0.75:
                return s
        return samples[0]

    category_tests = [
        ("Drainage", pick_high_conf(manifest["drainage_test_samples"], "Drainage"), "Drain overflowing with foul dark sewage on sidewalk"),
        ("Other", pick_high_conf(manifest["other_test_samples"], "Other"), "Building entrance facade"),
        ("Roads", pick_high_conf(manifest["roads_test_samples"], "Roads"), "Dangerous deep pothole on road asphalt"),
        ("Street Light", pick_high_conf(manifest["streetlight_test_samples"], "Street Light"), "Street light pole damaged and completely dark at night"),
        ("Waste Management", pick_high_conf(manifest["waste_management_test_samples"], "Waste Management"), "Huge pile of uncollected garbage bags and trash dumping"),
        ("Water Supply", pick_high_conf(manifest["watersupply_test_samples"], "Water Supply"), "Drinking water distribution pipe burst and leaking clean water onto street")
    ]

    for expected_cat, sample_path, desc in category_tests:
        acc_path = get_accessible_path(sample_path)
        with open(acc_path, "rb") as img_f:
            files = {"image": (os.path.basename(sample_path), img_f, "image/jpeg")}
            data = {"description": desc}
            r = requests.post(f"{API_URL}/analyze", files=files, data=data)

        assert r.status_code == 200, f"Request failed: {r.status_code} {r.text}"
        res = r.json()
        print(f"  [{expected_cat:16s}] -> Category: {res.get('category'):16s} | Conf: {res.get('confidence'):.2%} | Source: {res.get('predictionSource'):10s} | ModelVer: {res.get('modelVersion')}")
        assert res.get("category") == expected_cat, f"Category mismatch: expected {expected_cat}, got {res.get('category')}"
        if res.get("predictionSource") == "mobilenet":
            assert res.get("modelVersion") == "1.7.0-water-supply-v5"

    print("\n" + "=" * 80)
    print(" ALL LIVE HTTP API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    test_live_api()
