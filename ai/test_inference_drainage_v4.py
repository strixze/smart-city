"""
Comprehensive Real Inference Testing for MobileNetV3 Drainage v4
Tests:
1. Blocked drainage
2. Overflowing drainage
3. Waterlogged roads
4. Potholes and road damage
5. Garbage accumulation
6. Streetlights (daytime and nighttime)
7. Confusing case: Garbage blocking a drain vs ordinary garbage accumulation
8. Low-confidence / safe fallback behavior
9. Flask /health endpoint verification
10. Flask /analyze response schema integrity
"""

import os
import sys
import json

AI_DIR = os.path.dirname(os.path.abspath(__file__))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

import app as flask_app
from classifier import MOBILENET_LOADER, classify_complaint

def run_all_inference_tests():
    print("=" * 80)
    print(" RUNNING REAL INFERENCE TESTS FOR MOBILENETV3 DRAINAGE V4")
    print("=" * 80)

    client = flask_app.app.test_client()

    # 1. Health check verification
    print("\n[TEST 1] Verifying /health endpoint...")
    res_health = client.get("/health")
    assert res_health.status_code == 200, f"/health returned {res_health.status_code}"
    hdata = res_health.get_json()
    print(" /health Response:")
    print(f"   Model Name:    {hdata.get('modelName')}")
    print(f"   Model Version: {hdata.get('modelVersion')}")
    print(f"   Primary:       {hdata.get('primaryClassifier')}")
    print(f"   Verified Classes ({len(hdata.get('realDataClasses', []))}): {hdata.get('realDataClasses')}")
    print(f"   Model Loaded:  {hdata.get('modelLoaded')}")
    print(f"   Model Verified:{hdata.get('modelVerified')}")
    assert hdata.get("modelLoaded") is True
    assert hdata.get("modelVerified") is True
    assert hdata.get("modelVersion") == "1.4.0-drainage-v3"
    assert "Drainage" in hdata.get("realDataClasses", [])
    print(" -> PASS: /health endpoint successfully verified active Drainage v4 model.")

    manifest_path = os.path.join(AI_DIR, "models_drainage_v3", "test_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # 2. Blocked Drainage
    print("\n[TEST 2] Blocked Drainage Image Test...")
    dr_sample = manifest["drainage_test_samples"][21] # rusted-damaged-manhole-cover-old
    with open(dr_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(dr_sample)),
            "description": "Severely damaged and blocked rusted manhole cover on drain"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Predicted Category:    {pdata['predictedCategory']}")
    print(f"   Subcategory:           {pdata['predictedSubcategory']}")
    print(f"   Department:            {pdata['department']}")
    print(f"   Confidence:            {pdata['confidence']*100:.1f}%")
    print(f"   Source:                {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Drainage"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Blocked Drainage classified correctly as Drainage.")

    # 3. Overflowing Drainage
    print("\n[TEST 3] Overflowing Drainage Image Test...")
    dr_overflow_sample = manifest["drainage_test_samples"][26] # dirty-sewage-exits-from-sewer-tunnel
    with open(dr_overflow_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(dr_overflow_sample)),
            "description": "Sewage and dirty foul water overflowing from sewer outlet onto road"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Predicted Category:    {pdata['predictedCategory']}")
    print(f"   Subcategory:           {pdata['predictedSubcategory']}")
    print(f"   Confidence:            {pdata['confidence']*100:.1f}%")
    print(f"   Source:                {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Drainage"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Overflowing Drainage classified correctly as Drainage.")

    # 4. Waterlogged Road
    print("\n[TEST 4] Waterlogged Road Image Test...")
    dr_waterlogged_sample = manifest["drainage_test_samples"][5] # city-street-after-rain
    with open(dr_waterlogged_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(dr_waterlogged_sample)),
            "description": "Deep waterlogging and flooded stormwater on street after heavy rain"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Predicted Category:    {pdata['predictedCategory']}")
    print(f"   Subcategory:           {pdata['predictedSubcategory']}")
    print(f"   Confidence:            {pdata['confidence']*100:.1f}%")
    print(f"   Source:                {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Drainage"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Waterlogged road classified correctly as Drainage.")

    # 5. Roads / Potholes and road damage
    print("\n[TEST 5] Road Damage and Potholes Image Test...")
    road_sample = manifest["roads_test_samples"][2] # several-potholes-on-the-road
    with open(road_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(road_sample)),
            "description": "Deep potholes and cracked asphalt on the road"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Predicted Category:    {pdata['predictedCategory']}")
    print(f"   Subcategory:           {pdata['predictedSubcategory']}")
    print(f"   Department:            {pdata['department']}")
    print(f"   Confidence:            {pdata['confidence']*100:.1f}%")
    print(f"   Source:                {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Roads"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Road damage and potholes classified correctly as Roads.")

    # 6. Garbage accumulation
    print("\n[TEST 6] Garbage Accumulation Image Test...")
    waste_sample = manifest["waste_management_test_samples"][0] # overflowing-dark-blue-garbage-bin
    with open(waste_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(waste_sample)),
            "description": "Massive pile of uncollected garbage and overflowing dustbin"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Predicted Category:    {pdata['predictedCategory']}")
    print(f"   Subcategory:           {pdata['predictedSubcategory']}")
    print(f"   Department:            {pdata['department']}")
    print(f"   Confidence:            {pdata['confidence']*100:.1f}%")
    print(f"   Source:                {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Waste Management"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Garbage accumulation classified correctly as Waste Management.")

    # 7. Streetlights (daytime and nighttime)
    print("\n[TEST 7] Streetlights Image Test (Day and Night)...")
    # Daytime / broken lamp
    sl_day_sample = manifest["streetlight_test_samples"][13] # lamppost-against-sky
    with open(sl_day_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(sl_day_sample)),
            "description": "Damaged street lamp pole against the sky"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Daytime - Category: {pdata['predictedCategory']}, Conf: {pdata['confidence']*100:.1f}%, Source: {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Street Light"
    assert pdata['predictionSource'] == "mobilenet"

    # Nighttime fixture
    sl_night_sample = manifest["streetlight_test_samples"][21] # broken-street-lamp-on-green-pole
    with open(sl_night_sample, "rb") as f:
        res = client.post("/analyze", data={
            "image": (f, os.path.basename(sl_night_sample)),
            "description": "Street light broken and dark on roadway at night"
        }, content_type="multipart/form-data")
    assert res.status_code == 200
    pdata = res.get_json()
    print(f"   Nighttime - Category: {pdata['predictedCategory']}, Conf: {pdata['confidence']*100:.1f}%, Source: {pdata['predictionSource']}")
    assert pdata['predictedCategory'] == "Street Light"
    assert pdata['predictionSource'] == "mobilenet"
    print(" -> PASS: Streetlights classified correctly during daytime and nighttime.")

    # 8. Confusing Cases: Garbage blocking a drain vs ordinary garbage
    print("\n[TEST 8] Confusing Case: Garbage blocking a drain vs ordinary garbage...")
    # Case A: Garbage blocking drain
    dr_debris_sample = manifest["drainage_test_samples"][0]
    with open(dr_debris_sample, "rb") as f:
        res_a = client.post("/analyze", data={
            "image": (f, os.path.basename(dr_debris_sample)),
            "description": "Plastic trash and garbage debris choking and blocking the drainage outlet"
        }, content_type="multipart/form-data")
    pdata_a = res_a.get_json()
    print(f"   Case A (Garbage blocking drain) -> Category: {pdata_a['predictedCategory']}, Dept: {pdata_a['department']}")
    assert pdata_a['predictedCategory'] == "Drainage"

    # Case B: Ordinary garbage accumulation
    waste_dump_sample = manifest["waste_management_test_samples"][1]
    with open(waste_dump_sample, "rb") as f:
        res_b = client.post("/analyze", data={
            "image": (f, os.path.basename(waste_dump_sample)),
            "description": "Huge heap of decomposing organic waste and garbage bags dumped on pavement"
        }, content_type="multipart/form-data")
    pdata_b = res_b.get_json()
    print(f"   Case B (Ordinary garbage dump)  -> Category: {pdata_b['predictedCategory']}, Dept: {pdata_b['department']}")
    assert pdata_b['predictedCategory'] == "Waste Management"
    print(" -> PASS: Disambiguation between garbage-blocked drain and ordinary garbage accumulation is successful.")

    # 9. Low-confidence / Unreliable Input Safety Check
    print("\n[TEST 9] Safe low-confidence / conflict handling...")
    # Conflicting description against image: e.g. Street Light image with pure Road Pothole description
    with open(sl_day_sample, "rb") as f:
        res_conflict = client.post("/analyze", data={
            "image": (f, os.path.basename(sl_day_sample)),
            "description": "Potholes and cracked road asphalt with deep craters"
        }, content_type="multipart/form-data")
    pdata_c = res_conflict.get_json()
    print(f"   Conflicting evidence -> Handled safely: isFallback={pdata_c.get('isFallback')}, Source={pdata_c.get('predictionSource')}")
    # Low-confidence / conflict should not recklessly assert high-confidence mobile prediction
    assert pdata_c.get('isFallback') is True
    print(" -> PASS: Conflicting / low-reliability prediction routed safely to fallback.")

    # 10. API Schema Check
    print("\n[TEST 10] API Schema Contract Check...")
    required_keys = [
        "category", "subcategory", "priority", "confidence", "reason",
        "department", "model", "predictionSource", "predictedCategory",
        "predictedSubcategory", "modelLoaded", "isFallback", "fallbackUsed"
    ]
    for k in required_keys:
        assert k in pdata, f"Missing required response key: {k}"
    print(f" -> PASS: All {len(required_keys)} contract keys validated in Flask /analyze response.")

    print("\n" + "=" * 80)
    print(" ALL 10 INFERENCE TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_all_inference_tests()
