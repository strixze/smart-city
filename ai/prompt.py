"""
Smart City Civic AI Prompts
System prompts, multimodal templates, few-shot examples,
and structured JSON formatting instructions for LLM / vision classification.
"""

from typing import Dict, Any, List
from schemas import CIVIC_TAXONOMY

SUPPORTED_CIVIC_CATEGORIES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]

SYSTEM_PROMPT = """You are the official Smart City Civic AI Grievance Classifier.
Your mission is to analyze citizen grievance reports (both visual images and textual descriptions),
accurately determine the civic problem category, identify the specific subcategory, evaluate the urgency/priority level,
assign the appropriate municipal department, generate an objective description, provide a clear rationale, and produce strict structured JSON output.
"""

FEW_SHOT_EXAMPLES = [
    {
        "description": "Deep crater on 5th main road causing bike riders to slip and fall, traffic completely jammed",
        "output": {
            "category": "Roads",
            "subcategory": "Pothole",
            "department": "Public Works Department (PWD) - Roads & Bridges",
            "priority": "HIGH",
            "confidence": 0.95,
            "description": "Large deep pothole on an asphalt roadway creating traffic disruption and safety hazard for two-wheelers.",
            "reason": "Dangerous road crater causing vehicle skids and congestion.",
            "needsReview": False
        }
    },
    {
        "description": "Black sewage water overflowing from uncovered gutter directly in front of primary school gate, unbearable stench",
        "output": {
            "category": "Drainage",
            "subcategory": "Drainage Overflow",
            "department": "Municipal Water Supply & Sewerage Board (Drainage Wing)",
            "priority": "CRITICAL",
            "confidence": 0.96,
            "description": "Overflowing black sewage water from a choked open drain directly outside a school entrance.",
            "reason": "Severe public health and child safety hazard from overflowing sewage near school.",
            "needsReview": False
        }
    },
    {
        "description": "Street light not working for past 4 days, entire road is completely dark at night causing safety concern",
        "output": {
            "category": "Street Light",
            "subcategory": "Street Light Not Working",
            "department": "Electrical Engineering & Public Lighting Division",
            "priority": "MEDIUM",
            "confidence": 0.96,
            "description": "Non-operational street light luminaire leaving roadway in darkness at night.",
            "reason": "Street light failure resulting in hazardous dark road conditions.",
            "needsReview": False
        }
    },
    {
        "description": "Large pile of uncollected plastic waste and rotting domestic trash beside residential sidewalk",
        "output": {
            "category": "Waste Management",
            "subcategory": "Garbage Dump",
            "department": "Department of Solid Waste Management & Sanitation",
            "priority": "HIGH",
            "confidence": 0.94,
            "description": "Uncollected domestic garbage and discarded plastic waste accumulating along pedestrian footpath.",
            "reason": "Accumulated solid waste creating sanitary nuisance and blocking pedestrian pathway.",
            "needsReview": False
        }
    },
    {
        "description": "Pressurized clean water gushing from cracked underground water pipeline onto main road",
        "output": {
            "category": "Water Supply",
            "subcategory": "Pipeline Damage",
            "department": "Municipal Water Supply & Sewerage Board (Water Wing)",
            "priority": "HIGH",
            "confidence": 0.93,
            "description": "Ruptured municipal water pipe leaking clean potable water onto the road surface.",
            "reason": "Active drinking water pipeline rupture causing resource wastage and roadway water accumulation.",
            "needsReview": False
        }
    }
]


def get_taxonomy_summary() -> str:
    """Formats the 6 master civic categories into a concise prompt string."""
    lines = []
    for cat in SUPPORTED_CIVIC_CATEGORIES:
        info = CIVIC_TAXONOMY.get(cat, {})
        dept = info.get("department", "General Municipal Grievance Cell")
        subcats = ", ".join(info.get("subcategories", ["General Issue"]))
        lines.append(f"- **{cat}** (Dept: {dept})\n  Subcategories: {subcats}")
    return "\n".join(lines)


def build_civic_analysis_prompt(description: str = "", has_image: bool = False) -> str:
    """
    Constructs a complete instruction prompt for Gemini vision multimodal classification.
    """
    citizen_desc = description.strip() if description else "None provided by citizen."
    prompt = f"""{SYSTEM_PROMPT}

### Master Civic Categories (Select EXACTLY ONE):
{get_taxonomy_summary()}

### Priority Tiers:
- "CRITICAL": Imminent threat to human life, live electrical hazards, open manholes, burst water mains, catastrophic flooding.
- "HIGH": Severe disruption, large potholes, blocked arterial drainage, drinking water contamination, major garbage dumps.
- "MEDIUM": Broken/dark street lights, broken footpaths, minor leaks, overflowing public bins.
- "LOW": Minor cosmetic wear, non-hazardous general issues, general inquiries.

### Citizen Description:
\"\"\"{citizen_desc}\"\"\"

### Analysis Instructions:
1. {'Carefully examine the visual evidence in the image and cross-reference with any citizen description.' if has_image else 'Analyze the citizen grievance description.'}
2. Select the `category` strictly from the 6 supported categories:
   ["Drainage", "Other", "Roads", "Street Light", "Waste Management", "Water Supply"].
3. Select an appropriate `subcategory` under that category.
4. Assign the corresponding municipal `department`.
5. Set `priority` based on severity and life-safety impact ("LOW", "MEDIUM", "HIGH", or "CRITICAL").
6. Provide an objective, clear 1-2 sentence `description` summarizing the civic defect observed.
7. Provide a concise `reason` explaining your classification rationale.
8. Set `needsReview` (boolean):
   - `true`: if image is ambiguous, blurry, corrupt, uncertain, or citizen description contradicts visual evidence.
   - `false`: if the issue is clearly identifiable and unambiguous.
9. Provide a realistic `confidence` score (float between 0.50 and 0.99).

Return ONLY valid JSON matching this schema:
{{
  "category": "Drainage | Other | Roads | Street Light | Waste Management | Water Supply",
  "subcategory": "String",
  "department": "String",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": Float,
  "description": "String",
  "reason": "String",
  "needsReview": Boolean
}}
"""
    return prompt.strip()
