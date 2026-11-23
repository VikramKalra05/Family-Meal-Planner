/**
 * Measurement merging. The form submits every field, but blank inputs mean
 * "not measured today" — they must not wipe values already stored for the
 * same date. Explicit values always win.
 */

export interface MeasurementFields {
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
}

export interface MeasurementInput {
  waist?: number;
  chest?: number;
  arm?: number;
  thigh?: number;
  hip?: number;
  neck?: number;
  notes?: string;
}

export function mergeMeasurement(
  existing: MeasurementFields | null,
  input: MeasurementInput,
): MeasurementFields {
  return {
    waist_cm: input.waist ?? existing?.waist_cm ?? null,
    chest_cm: input.chest ?? existing?.chest_cm ?? null,
    arm_cm: input.arm ?? existing?.arm_cm ?? null,
    thigh_cm: input.thigh ?? existing?.thigh_cm ?? null,
    hip_cm: input.hip ?? existing?.hip_cm ?? null,
    neck_cm: input.neck ?? existing?.neck_cm ?? null,
    notes: input.notes ?? existing?.notes ?? null,
  };
}
