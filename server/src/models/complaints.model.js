import mongoose, { Schema } from 'mongoose';

export const COMPLAINT_CATEGORIES = {
  "Waste Management": [
    "Garbage Dump",
    "Overflowing Dustbin",
    "Illegal Waste Disposal"
  ],
  "Roads": [
    "Pothole",
    "Damaged Road",
    "Broken Footpath"
  ],
  "Drainage": [
    "Blocked Drain",
    "Drainage Overflow",
    "Sewage Leakage"
  ],
  "Water Supply": [
    "Water Leakage",
    "Pipeline Damage",
    "Water Supply Issue"
  ],
  "Street Light": [
    "Street Light Not Working",
    "Street Light Damaged",
    "Street Light Missing",
    "Street Light Flickering",
    "Street Light Pole Damaged",
    "Multiple Street Lights Not Working"
  ],
  "Street Infrastructure": [
    "Broken Street Light",
    "Damaged Traffic Signal",
    "Damaged Sign Board"
  ],
  "Public Property": [
    "Damaged Bench",
    "Damaged Park Equipment",
    "Vandalism"
  ],
  "Other": [
    "General Issue",
    "Other"
  ]
};

export const COMPLAINT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REOPENED",
  "REJECTED"
];

export const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const complaintSchema = new Schema(
  {
    complaintNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    citizen: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: [true, "Complaint title is required"],
      trim: true
    },
    description: {
      type: String,
      required: [true, "Complaint description is required"],
      trim: true
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: Object.keys(COMPLAINT_CATEGORIES)
    },
    subcategory: {
      type: String,
      default: ""
    },
    aiCategory: {
      type: String,
      default: ""
    },
    aiSubcategory: {
      type: String,
      default: ""
    },
    aiConfidence: {
      type: Number,
      default: 0
    },
    predictedCategory: {
      type: String,
      default: ""
    },
    predictedSubcategory: {
      type: String,
      default: ""
    },
    confidence: {
      type: Number,
      default: 0
    },
    predictionSource: {
      type: String,
      enum: ["mobilenet", "gemini_vision", "rules", "manual"],
      default: "rules"
    },
    modelLoaded: {
      type: Boolean,
      default: false
    },
    modelVersion: {
      type: String,
      default: null
    },
    fallbackUsed: {
      type: Boolean,
      default: false
    },
    fallbackReason: {
      type: String,
      default: ""
    },
    requestId: {
      type: String,
      default: ""
    },
    priority: {
      type: String,
      enum: COMPLAINT_PRIORITIES,
      default: "MEDIUM"
    },
    aiPriority: {
      type: String,
      default: "MEDIUM"
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: "SUBMITTED",
      index: true
    },
    assignedStaff: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    locationAddress: {
      type: String,
      required: [true, "Location address is required"],
      trim: true
    },
    citizenConfirmed: {
      type: Boolean,
      default: null
    },
    reopenReason: {
      type: String,
      default: ""
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
export default Complaint;
