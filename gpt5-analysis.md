Blog Part Summaries
Part 1 (July 1, 2016) Core points:
Kinect v2 provides 25 joints with a fixed parent-child hierarchy rooted at SpineBase (0). Correct hierarchical matching with your rig improves results.
SDK sample (Body Basics) shows joint positions, but for animation you need jointOrientations (quaternions), not just joint positions.
Each tracked body exposes joints (positions) and jointOrientations (absolute rotations in world/camera space).
Output needed per frame: count of tracked bodies + 25 joint orientation quaternions per body.
Skeleton-driven animation applies rotations per joint to deform mesh; positions alone are insufficient.
Part 2 (July 8, 2016) Core points:
Kinect quaternions are ABSOLUTE (world/camera space), not local relative to parent. You don’t accumulate; each joint already contains the final global orientation.
Kinect assumes each bone initially points along +Y with an “up” vector along +Z (away from sensor).
If your rig uses a different bind pose axis (e.g. Z-forward bones), you must remap (e.g. multiply by a -90° X-axis rotation) then optionally add corrective rolls (some 90° / 180° Z rotations) to match the rig's stored bind “up” vectors.
Leaf joints (hands tips, thumbs, feet, head top) have zero quaternions: use parent orientation instead.
Data is mirror-adjusted for player comfort — may need Z (or handedness) flip depending on model facing.
Arm roll ambiguity: orientation requires correct “up” vector alignment or limbs twist.
Part 3 (July 15, 2016) Core points:
Sensor tilt causes forward/back lean because camera space Y/Z are defined from sensor pose, not gravity. Use floorClipPlane normal (A,B,C) to compute a corrective quaternion: rotate from floor normal to global up (0,1,0) AFTER axis remap.
SpineBase position can be used for vertical translation (jumping) proportionally: initial height via plane equation distance (Ax+By+Cz+D). Later: percentHeight = current/initial; scale model’s root height accordingly. Same approach could extend to lateral movement.
Must guard for floorClipPlane all zero (floor not detected) and skip tilt correction then.
Limb rotation glitches (180° flips) will appear; filtering/smoothing needed beyond raw data.
ElfWithKinect Analysis (Where It Went Wrong)
Observed implementation traits in ElfWithKinect.jsx:

Uses joint positions (cameraX/Y/Z) to derive direction vectors between joints and then constructs quaternions via setFromUnitVectors(defaultDir, dir). It entirely ignores the provided Kinect orientation quaternions in the data (orientationX/Y/Z/W) — core mismatch with blog guidance (should use jointOrientations).
Treats each bone rotation as local by computing parent world quaternion and inverting it to approximate a local target from a direction. This contradicts the fact Kinect orientations are already absolute. Proper approach: take Kinect joint absolute quaternion, remap axes, then derive local by multiplying parentWorld.invert() * jointWorld.
Assumes a default bone rest direction of (0,1,0) for all bones (hardcoded defaultDir). That matches Kinect’s assumed bone direction but only if the rig also used +Y as bone pointing axis, which Mixamo rigs typically use +Y (up) for hierarchy but limbs often extend along local -Z or X depending on bind pose. Need to confirm rig bind axes and apply consistent remap; current code applies ad-hoc calibration only to arms.
Axis / up-vector remapping not done. No -90° X rotation or per-bone corrective roll quaternions. Result: likely twisted or misaligned limbs (arm roll artifacts suppressed only partially by calibration step).
Ignores leaf joint zero quaternion handling; instead for head uses direction neck→head tip; for hands uses wrist→handTip mapping via positions. This is okay for deriving aiming direction, but forfeits parent orientation inheritance logic (could introduce jitter).
Calibration logic (armCalibration) presumes first frame approximates a rest/T-pose; Kinect first frame might not be neutral. Mapping sensorLocalDir to restLocalDir with setFromUnitVectors handles only directional alignment (no roll), and then reuses rest.localDir baseline for delta. This can cause cumulative drift or forearm twist errors (no constraints).
Leg and spine mapping uses custom indices (j[32], j[1], etc.) referencing a landmark set that appears inconsistent with genuine Kinect index ordering (Kinect has 0–24; code references indices up to 32). Suggests a mismatched landmark mapping layer -> potential wrong joints driving bones.
No mirroring or handedness adjustment; if model faces +Z forward and Kinect data is mirror-adjusted, limbs may appear inverted unless earlier mapping already implicitly flips axes.
No floor plane tilt correction; if sensor pitched, avatar may lean incorrectly.
No proportional vertical translation using SpineBase; avatar roots stay static, eliminating jump / crouch fidelity.
Smoothing: basic slerp with constant factor; no temporal filtering for sudden 180° flips.
Does not validate or fallback when orientation data is all zeros (leaf joints) — but ignored because orientation quats not used anyway.
Scaling difference between human subject and elf rig not accounted for; using raw positional deltas for direction vectors could distort when joints are close (short limbs) vs recorded person (long limbs).
Potential performance: recalculates world matrices each frame and repeatedly in different effects; multi-effect splitting complicates consistent order of operations.
Key Mismatches to Blog Guidance
Should use Kinect quaternion orientations, not reconstruct from positions.
Should perform axis remap (-90° X) and per-bone corrective roll before applying.
Should derive local bone rotations from absolute ones via parent inversion, not direction vector fitting.
Should incorporate floorClipPlane for tilt correction and SpineBase proportional translation.
Should handle leaf joint zero quaternions by inheriting parent orientation.
Should include mirroring / handedness correction if rig not built mirrored.
Calibration approach insufficient: need consistent bind-pose reference, not first live frame.
Index mapping inconsistent — risks incorrect limb driving.
Recommended Corrections (Priority Order)
Data Source Shift:

Parse and use orientationX/Y/Z/W per joint.
Maintain mapping from Kinect joint indices (0–24) to Mixamo bone names with validated hierarchy.
Coordinate & Axis Remap:

Precompute global corrective quaternion Q_axis = Quaternion.fromAxisAngle(X, -90°).
Per bone optional roll fix (config map) applied after axis remap.
If mirror needed: apply Z sign flip or a handedness quaternion once at root.
Absolute to Local Conversion:

For each joint, worldQuat = Q_roll * Q_axis * kinectQuat.
parentWorldQuat from bone.parent; localQuat = parentWorldQuat.invert() * worldQuat.
Slerp from current bone.quaternion to localQuat.
Leaf Joint Handling:

If kinectQuat all zeros, substitute parent joint’s worldQuat (or skip rotation).
Floor Tilt Correction:

If floorClipPlane != (0,0,0,0): compute floorQuat (axis-angle between (0,1,0) and normal).
Apply floorQuat after axis remap before parent inversion (i.e., worldQuat = floorQuat * Q_axis * Q_roll * kinectQuat).
Root Translation:

Capture initial SpineBase plane distance; compute percentHeight each frame.
Move hips root bone vertically proportionally (optionally clamp / smooth).
Filtering & Stability:

Detect large sudden quaternion flips (>150° delta) on contiguous frames; apply temporal smoothing or discard single-frame outliers.
Optional low-pass filter: boneQuat = slerp(boneQuat, targetLocal, alpha) with adaptive alpha based on angular velocity.
Calibration Removal / Replacement:

Replace ad-hoc arm calibration with deterministic axis remap + per-bone roll offsets defined in a config table.
Index Validation:

Refactor landmark indexing to pure Kinect joint indices (0–24). Remove references like j[32].
Performance / Structure:

Consolidate all bone updates into a single animation tick (e.g., use useFrame from react-three-fiber).
Cache parent world quats once per frame (traverse once).
Scaling & Direction Derivations:

Stop deriving rotations from joint positions except for optional IK refinement; rely on provided orientations.
Optional Enhancements:

Add lateral translation proportional to SpineBase X/Z movement.
Apply joint confidence weighting (if available) to reduce noise when tracking quality drops.
Next Step (If You Want Code Changes)
Let me know if you’d like me to refactor ElfWithKinect.jsx to implement the quaternion-based pipeline with floor and root translation support; I can proceed with a patch.

Summary
You reconstructed rotations from joint positions, ignored Kinect orientation quaternions, skipped axis and tilt corrections, used inconsistent joint indices, and applied a fragile calibration, leading to misalignment and instability versus the blog’s prescribed direct quaternion usage + axis remap + floor correction + proportional root motion.