import { z } from 'zod';
import { FACT_KEYS } from './facts';

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const Poly3Schema = z.tuple([z.number(), z.number(), z.number()]);
const SourceIdSchema = z.string().min(1);
const finite = (n: number) => Number.isFinite(n);

export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  retrievedAt: z.iso.date(),
  license: z.string().min(1),
});

export const SourcedValueSchema = z
  .object({
    value: z.union([z.number(), z.string().min(1), z.boolean()]),
    unit: z.string().optional(),
    uncertainty: z.number().nonnegative().optional(),
    note: z.string().min(1).optional(),
    sourceId: SourceIdSchema,
  })
  .refine((v) => typeof v.value !== 'number' || finite(v.value), { message: 'value must be a finite number' });

const KeplerSetSchema = z.object({
  a: z.number(),
  e: z.number(),
  I: z.number(),
  L: z.number(),
  varpi: z.number(),
  Omega: z.number(),
});

const ErrorFigureSchema = z.object({
  longitudeArcsec: z.number().nonnegative(),
  latitudeArcsec: z.number().nonnegative(),
  distanceKm: z.number().nonnegative(),
});

export const ApproxTableSchema = z
  .object({
    id: z.enum(['1800-2050', '3000BC-3000AD']),
    validFromJdTdb: z.number(),
    validToJdTdb: z.number(),
    elements: KeplerSetSchema,
    ratesPerCentury: KeplerSetSchema,
    extraTerms: z.object({ b: z.number(), c: z.number(), s: z.number(), f: z.number() }).optional(),
    nominalError: ErrorFigureSchema,
    horizonsCheck: z
      .object({
        sampleCount: z.number().int().positive(),
        maxAngularErrorArcsec: z.number().nonnegative(),
        maxDistanceErrorKm: z.number().nonnegative(),
        sourceId: SourceIdSchema,
      })
      .optional(),
  })
  .refine((t) => t.validFromJdTdb < t.validToJdTdb, { message: 'validFromJdTdb must precede validToJdTdb' })
  .refine((t) => t.elements.a > 0 && t.elements.e >= 0 && t.elements.e < 1, { message: 'elements out of range (need a > 0, 0 <= e < 1)' });

export const PlanetApproxOrbitSchema = z.object({
  type: z.literal('planet-approx'),
  sourceId: SourceIdSchema,
  represents: z.enum(['planet', 'earth-moon-barycenter']),
  tables: z.array(ApproxTableSchema).min(1),
});

export const FixedOrbitSchema = z.object({
  type: z.literal('fixed'),
  positionKm: Vec3Schema,
  note: z.string().min(1),
});

export const OrbitSchema = z.discriminatedUnion('type', [PlanetApproxOrbitSchema, FixedOrbitSchema]);

export const RotationModelSchema = z.object({
  sourceId: SourceIdSchema,
  poleRa: Poly3Schema,
  poleDec: Poly3Schema,
  pm: Poly3Schema,
  nutPrecRa: z.array(z.number()),
  nutPrecDec: z.array(z.number()),
  nutPrecPm: z.array(z.number()),
  nutPrecAngles: z.array(Poly3Schema),
});

export const BODY_CATEGORIES = ['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'comet', 'spacecraft'] as const;

export const TIERS = ['1k', '2k', '4k', '8k'] as const;

export const TextureRefSchema = z
  .object({
    tiers: z.partialRecord(z.enum(TIERS), z.string().min(1)),
    sourceId: SourceIdSchema,
    derivation: z.string().min(1).optional(),
    illustrative: z.boolean().optional(),
  })
  .refine((t) => Object.keys(t.tiers).length > 0, { message: 'texture needs at least one tier' });

export const ImagerySchema = z.object({
  color: TextureRefSchema.optional(),
  normal: TextureRefSchema.optional(),
  night: TextureRefSchema.optional(),
  clouds: TextureRefSchema.optional(),
  specular: TextureRefSchema.optional(),
  radar: TextureRefSchema.optional(),
  rings: z.object({ texture: TextureRefSchema, innerKm: SourcedValueSchema, outerKm: SourcedValueSchema }).optional(),
});

export const RenderSchema = z.object({
  shader: z.enum(['earth', 'rocky', 'giant', 'venus', 'sun']),
  atmosphere: z.enum(['earth', 'mars', 'venus']).nullable(),
  lommelSeeliger: z.number().min(0).max(1),
  normalStrength: z.number().nonnegative(),
  bandFlow: z.boolean(),
});

export const BodySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: z.enum(BODY_CATEGORIES),
  parentId: z.string().nullable(),
  regionId: z.string().min(1),
  naifId: z.number().int(),
  facts: z.partialRecord(z.enum(FACT_KEYS), SourcedValueSchema),
  orbit: OrbitSchema,
  rotation: RotationModelSchema.nullable(),
  shape: z.object({
    equatorialRadiusKm: z.number().positive(),
    polarRadiusKm: z.number().positive(),
    sourceId: SourceIdSchema,
  }),
  description: z.object({ text: z.string().min(1), sourceId: SourceIdSchema }).nullable(),
  imagery: ImagerySchema.nullable(),
  render: RenderSchema,
  display: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), note: z.literal('illustrative') }),
});

export const RegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  parentId: z.string().nullable(),
  frame: z.enum(['heliocentric-ecliptic-j2000']),
  unit: z.enum(['km']),
  originInParentKm: Vec3Schema,
  activeRangeKm: z.tuple([z.number().nonnegative(), z.number().positive()]),
  dataManifest: z.string().min(1),
});

export const RegionsFileSchema = z.object({ schemaVersion: z.literal(1), regions: z.array(RegionSchema).min(1) });
export const SourcesFileSchema = z.object({ schemaVersion: z.literal(1), sources: z.array(SourceSchema).min(1) });
export const BodiesFileSchema = z.object({
  schemaVersion: z.literal(1),
  regionId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  bodies: z.array(BodySchema).min(1),
});

export const ImageryFileSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  sources: z.array(SourceSchema),
  bodies: z.record(z.string(), ImagerySchema),
});

export type Source = z.infer<typeof SourceSchema>;
export type SourcedValue = z.infer<typeof SourcedValueSchema>;
export type ApproxTable = z.infer<typeof ApproxTableSchema>;
export type PlanetApproxOrbit = z.infer<typeof PlanetApproxOrbitSchema>;
export type FixedOrbit = z.infer<typeof FixedOrbitSchema>;
export type Orbit = z.infer<typeof OrbitSchema>;
export type RotationModel = z.infer<typeof RotationModelSchema>;
export type Body = z.infer<typeof BodySchema>;
export type BodyCategory = Body['category'];
export type Region = z.infer<typeof RegionSchema>;
export type RegionsFile = z.infer<typeof RegionsFileSchema>;
export type SourcesFile = z.infer<typeof SourcesFileSchema>;
export type BodiesFile = z.infer<typeof BodiesFileSchema>;
export type Tier = (typeof TIERS)[number];
export type TextureRef = z.infer<typeof TextureRefSchema>;
export type Imagery = z.infer<typeof ImagerySchema>;
export type Render = z.infer<typeof RenderSchema>;
export type ImageryFile = z.infer<typeof ImageryFileSchema>;
