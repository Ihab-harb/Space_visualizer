import { z } from 'zod';

const SourceId = z.string().min(1);
const NumberValue = z.object({ value: z.number(), sourceId: SourceId });
const Text = z.object({ text: z.string().min(1), sourceId: SourceId });
const IsoDate = z.iso.date();

export const BoundFormSchema = z.enum(['radius', 'depth', 'percent']);

/**
 * A cited range. For an interior bound, `min`/`max` are always radii in km (the cutaway needs them); `from` records the form
 * the source stated the bound in, and `stated` the numbers as the source gives them (km deep, or percent of the radius).
 * `stated` is absent for a radius bound, whose stated numbers are `min`/`max`.
 */
export const SourcedRangeSchema = z
  .object({
    min: z.number(), max: z.number(), sourceId: SourceId,
    from: BoundFormSchema.optional(),
    stated: z.object({ min: z.number(), max: z.number() }).optional(),
  })
  .refine((r) => r.min <= r.max, { message: 'range min must not exceed max' });

export const InteriorLayerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  outerRadiusKm: SourcedRangeSchema,
  innerRadiusKm: SourcedRangeSchema,
  from: BoundFormSchema,
  state: z.enum(['solid', 'liquid', 'gas', 'plasma', 'unknown']),
  /** The source that states the layer's state, when one does. */
  stateSourceId: SourceId.optional(),
  composition: Text.nullable(),
  uncertain: z.boolean(),
});

const GasBase = { name: z.string().min(1), formula: z.string().min(1), amount: z.number().nonnegative(), uncertainty: z.number().nonnegative().nullable(), sourceId: SourceId };
export const MajorGasSchema = z.object({ ...GasBase, unit: z.literal('%') });
export const MinorGasSchema = z.object({ ...GasBase, unit: z.literal('ppm') });

export const AtmosphereSchema = z.object({
  basis: z.string().min(1),
  major: z.array(MajorGasSchema),
  minor: z.array(MinorGasSchema),
  note: Text.nullable(),
});

export const MagnetosphereSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), sourceId: SourceId }),
  z.object({
    kind: z.literal('dipole'),
    strengthGaussR3: NumberValue,
    tiltDeg: NumberValue.nullable(),
    tiltLongitudeDeg: NumberValue.nullable(),
    dipolePole: z.object({ latDeg: z.number(), lonDegE: z.number(), sourceId: SourceId }).nullable(),
    offsetRadii: NumberValue.nullable(),
    referenceRadiusKm: NumberValue,
    surfaceFieldGauss: SourcedRangeSchema.nullable(),
  }),
  z.object({ kind: z.literal('other'), note: Text }),
]);

export const MISSION_TYPES = ['flyby', 'orbiter', 'lander', 'rover', 'probe', 'sample-return', 'impactor', 'observatory'] as const;
export const MISSION_OUTCOMES = ['success', 'partial', 'failure', 'ongoing', 'planned'] as const;

export const MissionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  agency: z.string().min(1),
  type: z.enum(MISSION_TYPES),
  launchDate: IsoDate,
  arrivalDate: IsoDate.nullable(),
  endDate: IsoDate.nullable(),
  outcome: z.enum(MISSION_OUTCOMES),
  sourceId: SourceId,
});

export const DiscoverySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('antiquity'), sourceId: SourceId }),
  z.object({ kind: z.literal('discovered'), by: z.string().min(1), date: IsoDate, method: z.string().min(1), sourceId: SourceId }),
]);

export const FeatureItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  latDeg: z.number(),
  lonDegE: z.number(),
  diameterKm: z.number(),
  origin: z.string(),
  approvedYear: z.number().int().nullable(),
});

export const FeaturesSchema = z.object({
  totalApproved: NumberValue,
  thresholdKm: z.number().nonnegative(),
  sourceId: SourceId,
  items: z.array(FeatureItemSchema),
});

export const BodyDetailsSchema = z.object({
  schemaVersion: z.literal(1),
  bodyId: z.string().regex(/^[a-z0-9-]+$/),
  generatedAt: z.iso.datetime(),
  interior: z.object({ layers: z.array(InteriorLayerSchema).min(1) }).nullable(),
  atmosphere: AtmosphereSchema.nullable(),
  magnetosphere: MagnetosphereSchema,
  missions: z.array(MissionSchema),
  discovery: DiscoverySchema.nullable(),
  features: FeaturesSchema.nullable(),
});

export type SourcedRange = z.infer<typeof SourcedRangeSchema>;
export type InteriorLayer = z.infer<typeof InteriorLayerSchema>;
export type Gas = z.infer<typeof MajorGasSchema> | z.infer<typeof MinorGasSchema>;
export type Atmosphere = z.infer<typeof AtmosphereSchema>;
export type Magnetosphere = z.infer<typeof MagnetosphereSchema>;
export type MissionType = (typeof MISSION_TYPES)[number];
export type MissionOutcome = (typeof MISSION_OUTCOMES)[number];
export type Mission = z.infer<typeof MissionSchema>;
export type Discovery = z.infer<typeof DiscoverySchema>;
export type FeatureItem = z.infer<typeof FeatureItemSchema>;
export type Features = z.infer<typeof FeaturesSchema>;
export type BodyDetails = z.infer<typeof BodyDetailsSchema>;
