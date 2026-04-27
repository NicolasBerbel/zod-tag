// feature-flags.slop-test.ts
/**
 * Feature Flag DSL – Type-Safe Configuration Generation
 *
 * Showcases zod-tag as a lightweight embedded DSL for generating structured
 * configuration files. Each feature flag is a validated renderable that
 * composes into deployment environment manifests.
 *
 * Strength spotlight: the structure/value boundary makes it impossible to
 * accidentally inject a flag name as a value or misspell an environment name.
 * The generated output is a clean tuple ready for YAML/JSON serialization.
 */

import { z } from 'zod'
import { zt, type IRenderable, type IRenderableKargs } from '../../../dist/main.js'

// ============================================================================
// Domain Types
// ============================================================================

const FLAG_TYPES = ['boolean', 'string', 'number', 'json'] as const
const ENVIRONMENTS = ['development', 'staging', 'production'] as const
const ROLLOUT_STRATEGIES = ['instant', 'gradual', 'scheduled'] as const

// ============================================================================
// Reusable Fragments
// ============================================================================

/**
 * A single feature flag definition.
 * The flag name is STRUCTURE (it's part of your application's contract).
 * The value and rollout are VALUES (they change per environment).
 * 
 * Notice: the key 'featureName' versus the key 'value'—one becomes YAML
 * structure, the other becomes a parameterized value. The boundary is
 * visible right here in the template.
 */
const featureFlag = zt.z({
    featureName: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*$/),
    flagType: z.enum(FLAG_TYPES).default('boolean'),
    description: z.string().max(500).optional(),
    value: z.unknown(),  // will be validated per-environment below
    rolloutPercentage: z.number().int().min(0).max(100).default(100),
    rolloutStrategy: z.enum(ROLLOUT_STRATEGIES).default('instant'),
    scheduledAt: z.coerce.date().optional(),
})`
${e => zt.unsafe(z.string().regex(/^[a-z][a-z0-9-]*$/), e.featureName)}:
  type: ${e => e.flagType}
  value: ${e => typeof e.value === 'string' ? e.value : JSON.stringify(e.value)}
  description: ${e => zt.if(e.description, zt.t`"${e.description!}"`)}
  rollout:
    percentage: ${e => e.rolloutPercentage}
    strategy: ${e => e.rolloutStrategy}${e =>
        e.scheduledAt ? zt.t`\n    scheduled_at: ${e.scheduledAt}` : zt.t``
    }
`
// The flag name goes through zt.unsafe → trusted structure (validated by regex).
// The value stays a parameterized VALUE.
// Conditional rollout fields use renderable-or-empty pattern for clean YAML.

/**
 * An environment groups feature flags with their specific values.
 * Uses zt.map to lift a list of flag definitions into a composed block.
 * 
 * Here's where the magic happens: each flag in the array gets bound to
 * a featureFlag renderable, producing a clean structural YAML block
 * separated by newlines. No manual .render() calls, no string munging.
 */
const environmentBlock = zt.z({
    envName: z.enum(ENVIRONMENTS),
    flags: z.array(z.object({
        featureName: z.string().min(1),
        value: z.unknown(),
        rolloutPercentage: z.number().int().min(0).max(100).default(100),
        rolloutStrategy: z.enum(ROLLOUT_STRATEGIES).default('instant'),
        scheduledAt: z.coerce.date().optional(),
    })).min(1),
})`
# ${e => zt.unsafe(z.enum(ENVIRONMENTS), e.envName)} environment
${e => zt.map(
    e.flags,
    featureFlag,
    flag => ({
        featureName: flag.featureName,
        flagType: 'boolean' as const, // could be inferred from registry
        value: flag.value,
        rolloutPercentage: flag.rolloutPercentage,
        rolloutStrategy: flag.rolloutStrategy,
        scheduledAt: flag.scheduledAt,
    }),
    zt.t`\n`
)}
`

/**
 * This is important!
 * TODO: we need a kind of zt.opaque(renderer) that drops inference of output tuple, that rises the ts inference wall higher
 */
const _safeEnvironmentBlock = zt.opaque(environmentBlock)

// ============================================================================
// Full Feature Flag Manifest
// ============================================================================

/**
 * The top-level manifest composes environment blocks into a complete
 * configuration file. Global settings are STRUCTURE, environments are
 * scoped renderables.
 */
const featureFlagManifest = zt.z({
    project: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    description: z.string().optional(),
})`
# ============================================================================
# Feature Flags Manifest
# Project: ${e => e.project}
# Version: ${e => e.version}
# Generated: ${new Date().toISOString()}
# ============================================================================
${e => zt.if(e.description, zt.t`
# ${e.description}
`)}
${zt.p('development', _safeEnvironmentBlock)}
${zt.p('staging', _safeEnvironmentBlock)}
${zt.p('production', _safeEnvironmentBlock)}
`

// ============================================================================
// Type-Safe Configuration Objects
// ============================================================================

type ManifestConfig = IRenderableKargs<typeof featureFlagManifest>

const config: ManifestConfig = {
    project: 'my-saas-platform',
    version: '2.4.1',
    description: 'Feature flags for Q3 2026 release',

    development: {
        envName: 'development' as const,
        flags: [
            {
                featureName: 'dark-mode',
                value: true,
                rolloutPercentage: 100,
                rolloutStrategy: 'instant' as const,
            },
            {
                featureName: 'new-checkout-flow',
                value: true,
                rolloutPercentage: 100,
                rolloutStrategy: 'instant' as const,
            },
            {
                featureName: 'ai-recommendations',
                value: true,
                rolloutPercentage: 50,
                rolloutStrategy: 'gradual' as const,
            },
            {
                featureName: 'beta-analytics-dashboard',
                value: true,
                rolloutPercentage: 100,
                rolloutStrategy: 'instant' as const,
            },
        ],
    },

    staging: {
        envName: 'staging' as const,
        flags: [
            {
                featureName: 'dark-mode',
                value: true,
                rolloutPercentage: 100,
                rolloutStrategy: 'instant' as const,
            },
            {
                featureName: 'new-checkout-flow',
                value: true,
                rolloutPercentage: 75,
                rolloutStrategy: 'gradual' as const,
            },
            {
                featureName: 'ai-recommendations',
                value: true,
                rolloutPercentage: 25,
                rolloutStrategy: 'gradual' as const,
            },
            {
                featureName: 'beta-analytics-dashboard',
                value: false,  // disabled in staging for now
                rolloutPercentage: 0,
                rolloutStrategy: 'instant' as const,
            },
        ],
    },

    production: {
        envName: 'production' as const,
        flags: [
            {
                featureName: 'dark-mode',
                value: true,
                rolloutPercentage: 100,
                rolloutStrategy: 'instant' as const,
            },
            {
                featureName: 'new-checkout-flow',
                value: false,  // not yet in prod
                rolloutPercentage: 0,
                rolloutStrategy: 'scheduled' as const,
                scheduledAt: '2026-07-15T09:00:00Z',
            },
            {
                featureName: 'ai-recommendations',
                value: false,
                rolloutPercentage: 0,
                rolloutStrategy: 'scheduled' as const,
                scheduledAt: '2026-08-01T00:00:00Z',
            },
            {
                featureName: 'beta-analytics-dashboard',
                value: false,  // internal beta only
                rolloutPercentage: 0,
                rolloutStrategy: 'instant' as const,
            },
        ],
    },
}

// ============================================================================
// Render & Inspect
// ============================================================================

const [strings, ...values] = featureFlagManifest.render(config)

console.log('═══════════════════════════════════════════')
console.log('  Feature Flag Manifest via zod-tag')
console.log('═══════════════════════════════════════════\n')

console.log('▶ STRUCTURE (YAML syntax, flag names, keys):')
strings.forEach((s, i) => {
    const preview = s.length > 100 ? s.slice(0, 100) + '…' : s
    console.log(`  [${i}] ${JSON.stringify(preview)}`)
})

console.log('\n▶ VALUES (flag values, percentages, dates):')
values.forEach((v, i) => {
    const display = typeof v === 'object' ? JSON.stringify(v) : String(v)
    console.log(`  [${i}] ${display}`)
})

console.log('\n▶ Full Manifest (zt.debug):')
console.log(zt.debug([strings, ...values]))

console.log('\n▶ Parameterized only (zt.$n):')
console.log(zt.$n([strings, ...values]))

// ============================================================================
// Demonstrate Safety Properties
// ============================================================================

console.log('\n═══════════════════════════════════════════')
console.log('  SAFETY PROPERTIES DEMONSTRATED')
console.log('═══════════════════════════════════════════\n')

// 1. Misspelled environment name caught by Zod enum
try {
    featureFlagManifest.render({
        ...config,
        production: { envName: 'prod' as any, flags: [] },
    })
} catch {
    console.log('✓ Invalid environment name "prod" rejected by z.enum()')
}

// 2. Invalid flag name (capital letter) caught by regex
try {
    featureFlagManifest.render({
        ...config,
        development: {
            envName: 'development',
            flags: [{ featureName: 'Dark-Mode', value: true }],
        },
    } as any)
} catch {
    console.log('✓ Invalid flag name "Dark-Mode" rejected by /^[a-z][a-z0-9-]*$/')
}

// 3. Flag names never appear in VALUES array—they're zt.unsafe STRUCTURE
const flagNames = config.development.flags.map(f => f.featureName)
const valuesContainFlagName = values.some(v =>
    typeof v === 'string' && flagNames.includes(v)
)
console.log(`${valuesContainFlagName ? '✗' : '✓'} Flag names are STRUCTURE, never leak into VALUES array`)

// 4. Scheduled rollout dates are VALUES, not concatenated into structure
const hasScheduledDate = values.some(v =>
    typeof v === 'string' && v.startsWith('2026-')
)
console.log(`${hasScheduledDate ? '✓' : '✗'} Scheduled rollout dates appear as parameterized VALUES`)

// ============================================================================
// Key Takeaway
// ============================================================================

console.log('\n═══════════════════════════════════════════')
console.log('  WHY ZOD-TAG FOR CONFIG GENERATION')
console.log('═══════════════════════════════════════════\n')

console.log('1. Flag names are code structure → zt.unsafe after regex validation')
console.log('2. Flag values are deployment data → parameterized VALUES')
console.log('3. Environment names are enum-validated → rejected at render time')
console.log('4. Conditional YAML blocks use zt.if/zt.t`` pattern')
console.log('5. zt.map lifts flag arrays into composed YAML blocks')
console.log('6. The output tuple is ready for YAML.stringify() or direct file write')
console.log('7. No template injection possible: values never become YAML syntax')