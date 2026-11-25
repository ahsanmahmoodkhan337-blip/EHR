import { describe, expect, test } from "bun:test";
import { rosLineFor, withRosLine } from "../src/components/WorkflowAthena/ExamROSStage";

describe("the review of systems is written into the Subjective in plain words", () => {
  test("a positive finding is named, not given as an internal id", () => {
    const line = rosLineFor({ "gen-fever": true, "gi-abd": false });
    expect(line).toContain("ROS: Positive for abdominal pain");
    expect(line).not.toContain("gi-abd");
  });

  test("nothing reviewed writes nothing", () => {
    expect(rosLineFor({})).toBe("");
  });

  test("the ROS line is appended to the HPI once and replaced, never doubled", () => {
    const hpi = "3 weeks of epigastric burning.";
    const once = withRosLine(hpi, "ROS: Positive for nausea/vomiting. Other systems reviewed are negative.");
    expect(once).toBe(`${hpi}\n\nROS: Positive for nausea/vomiting. Other systems reviewed are negative.`);
    const twice = withRosLine(once, "ROS: Systems reviewed are negative.");
    expect(twice).toBe(`${hpi}\n\nROS: Systems reviewed are negative.`);
    expect(withRosLine(twice, "")).toBe(hpi);
  });
});
