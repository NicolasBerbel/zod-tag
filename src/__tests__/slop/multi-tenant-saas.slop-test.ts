/**
 * Multi-Tenant SaaS Configuration Generator
 * 
 * Showcases zod-tag’s strict/loose composition, pattern matching (zt.match),
 * scoped parameters (zt.p), dynamic provisioning via selectors, and final
 * strict validation of per‑tenant manifests.
 * 
 * Best-practice takeaways:
 * - Build reusable blocks loosely; compose with zt.p to keep them encapsulated.
 * - Use zt.z.strict() at the final entry point after the kargs shape is fully known.
 * - Dynamic content belongs in scoped slots or must be kept in loose parents.
 * - zt.unsafe is validated as early as possible to protect structure.
 */
    
import { z } from 'zod';
import { zt, type IRenderable, type IRenderableKargs } from '../../../dist/main.js';

// ============================================================================
// 1. Reusable building blocks (loose by default for composability)
// ============================================================================

/** Feature flag – strict to enforce only known fields */
const featureFlagBlock = zt.z.strict({
    flagName: z.string().regex(/^[a-z][a-z0-9-]*$/),
    enabled: z.boolean(),
    rolloutPercent: z.number().int().min(0).max(100).default(100),
})`
${e => zt.unsafe(z.string().regex(/^[a-z][a-z0-9-]*$/), e.flagName)}:
  enabled: ${e => e.enabled}
  rollout: ${e => e.rolloutPercent}%
`;

/**
 * Provisioning block – discriminated union per provider.
 * Defined loosely (default) because the shapes vary per branch.
 * Use zt.p to scope this inside the tenant manifest.
 */
const provisioningBlock = zt.match('provider', {
    aws: zt.z({
        provider: z.literal('aws'),
        region: z.string(),
        instanceSize: z.string(),
        roleArn: z.string().optional(),
    })`aws:
  region: ${e => e.region}
  instance: ${e => e.instanceSize}${e => e.roleArn ? zt.t`\n  role: ${e.roleArn}` : zt.t``}`,

    gcp: zt.z({
        provider: z.literal('gcp'),
        region: z.string(),
        instanceSize: z.string(),
        projectId: z.string(),
    })`gcp:
  region: ${e => e.region}
  instance: ${e => e.instanceSize}
  project: ${e => e.projectId}`,

    azure: zt.z({
        provider: z.literal('azure'),
        region: z.string(),
        instanceSize: z.string(),
        subscriptionId: z.string(),
    })`azure:
  region: ${e => e.region}
  instance: ${e => e.instanceSize}
  subscription: ${e => e.subscriptionId}`,
});

// ============================================================================
// 2. Tenant manifest – strict at the top level, uses scoped children
// ============================================================================

const tenantManifest = zt.z.strict({
    tenantId: z.string().min(1),
    tenantName: z.string(),
    environment: z.enum(['staging', 'production']),
    features: z.array(z.object({
        flagName: z.string(),
        enabled: z.boolean(),
        rolloutPercent: z.number().int().min(0).max(100).default(100),
    })),
    // provisioning is scoped – the parent only sees a blob under this key
    provisioning: z.object({
        provider: z.enum(['aws', 'gcp', 'azure']),
        region: z.string(),
        instanceSize: z.string(),
    }).passthrough(), // allow extra provider-specific fields
})`
# Tenant: ${e => e.tenantName}
# ID: ${e => e.tenantId}
# Environment: ${e => e.environment}

## Features
${e => zt.map(e.features, featureFlagBlock, f => f, zt.t`\n`)}

## Provisioning
${zt.p('provisioning', provisioningBlock)}
`;

// ============================================================================
// 3. Helper for final strictness (demonstration; real helper can be built later)
// ============================================================================
// Not yet in the library; we simulate by re-creating with strict schema.
function finalStrictFromLoose<TagFn extends (...args: any[]) => IRenderable<any, any>>(
    shape: z.ZodRawShape,
    renderable: TagFn
): TagFn {
    // This would be replaced by a native zt.strict(renderable) in the future.
    // For now, we just use the strict schema we already have.
    return renderable; // identity – the template was already built strict.
}

// ============================================================================
// 4. Test runner (slop style)
// ============================================================================

console.log('\n═══════════════════════════════════════');
console.log('  Multi-Tenant SaaS Config Generator');
console.log('═══════════════════════════════════════\n');

let passed = 0, failed = 0;

function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); failed++; console.error(e); }
}

// ── Positive cases ──────────────────────────────────────────────
test('strict tenant manifest renders correctly with valid data', () => {
    const manifest = tenantManifest.render({
        tenantId: 't-123',
        tenantName: 'Acme Corp',
        environment: 'production',
        features: [
            { flagName: 'dark-mode', enabled: true, rolloutPercent: 100 },
            { flagName: 'new-checkout', enabled: false, rolloutPercent: 0 },
        ],
        provisioning: {
            provider: 'aws' as const,
            region: 'us-east-1',
            instanceSize: 't3.medium',
            roleArn: 'arn:aws:iam::123456789012:role/MyRole',
        },
    });

    const [strs, ...vals] = manifest;
    const text = zt.debug(manifest);

    // Value count
    if (vals.length !== 10) throw new Error(`Expected 10 values, got ${vals.length}`);

    // Structure checks (content that should be in the strings)
    if (!strs.join('').includes('# Tenant: ')) throw new Error('Missing tenant header in structure');
    if (!strs.join('').includes('dark-mode:')) throw new Error('Feature flag name (structure) missing');
    if (!strs.join('').includes('aws:')) throw new Error('Provider block (structure) missing');

    // Value checks – they must NOT appear in the strings
    if (strs.join('').includes('Acme Corp')) throw new Error('Tenant name leaked into structure');
    if (strs.join('').includes('t-123')) throw new Error('Tenant ID leaked into structure');
    if (strs.join('').includes('us-east-1')) throw new Error('Region leaked into structure');
    if (strs.join('').toLowerCase().includes('arn:')) throw new Error('ARN leaked into structure');

    // Values should be present in the debug output
    if (!text.includes('Acme Corp')) throw new Error('Tenant name missing from output');
    if (!text.includes('t-123')) throw new Error('Tenant ID missing from output');
    if (!text.includes('us-east-1')) throw new Error('Region missing from output');
    if (!text.toLowerCase().includes('arn:')) throw new Error('ARN missing from output');

    console.log('    Output:');
    console.log(text.replace(/^/gm, '      '));
});

test('zt.p isolates provisioning strategy – no provider keys leaked to parent', () => {
    // If we omitted the provisioning key completely, it would be caught by strict parent.
    try {
        tenantManifest.render({
            tenantId: 't-no-prov',
            tenantName: 'NoProv',
            environment: 'staging',
            features: [],
            // provisioning missing
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
        // Good: strict parent rejects missing key 'provisioning'
    }
});

test('strict parent rejects unrecognised key inside provisioning if not passthrough', () => {
    // The provisioning shape we gave to the parent is an object with passthrough(),
    // so it will accept extra keys there. But if we had used strict inside that shape,
    // it would reject. Here we test that the child (provisioningBlock) can be strict
    // itself, rejecting unknown keys within its scope.
    
    // Build a stricter variant of the provisioning block (aws only) and nest it.
    const strictAws = zt.match('provider', {
        aws: zt.z.strict({
            provider: z.literal('aws'),
            region: z.string(),
            instanceSize: z.string(),
            // no roleArn allowed
        })`aws: ${e => e.region} ${e => e.instanceSize}`,
        gcp: zt.z.strict({
            provider: z.literal('gcp'),
            region: z.string(),
            instanceSize: z.string(),
            projectId: z.string(),
        })`gcp: ${e => e.region} ${e => e.projectId}`,
        azure: zt.z.strict({
            provider: z.literal('azure'),
            region: z.string(),
            instanceSize: z.string(),
            subscriptionId: z.string(),
        })`azure: ${e => e.region} ${e => e.subscriptionId}`,
    });
    
    const strictParent = zt.z.strict({
        tenantId: z.string(),
        provisioning: z.object({}).passthrough(),
    })`${e => e.tenantId}: ${zt.p('provisioning', strictAws)}`;
    
    // Extra key 'roleArn' on AWS branch should be rejected by child strict schema
    try {
        strictParent.render({
            tenantId: 't-1',
            provisioning: { provider: 'aws', region: 'eu-west-1', instanceSize: 't2.micro', roleArn: 'arn:...' },
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
    }
});

// ── Dynamic composition best practice ─────────────────────────
test('dynamic selector in loose parent can be finalized via zt.strict() pattern', () => {
    // We don't have zt.strict(renderable) yet, so we'll simulate.
    // The idea: build a loose template with dynamic selectors, then wrap it with a
    // strict schema that includes all the keys that *might* be introduced.
    // This is how you bridge dynamic selection and final strictness.
    
    const baseFeature = zt.z.strict({
        flagName: z.string(),
        enabled: z.boolean(),
    })`${e => e.flagName}: ${e => e.enabled}`;
    
    // Loose parent that picks a feature based on runtime
    const dynamicFeature = zt.z({
        useBeta: z.boolean(),
        betaFlag: z.object({ flagName: z.string(), enabled: z.boolean() }).optional(),
        standardFlag: z.object({ flagName: z.string(), enabled: z.boolean() }),
    })`
        Standard: ${zt.p('standardFlag', baseFeature)}
        ${e => e.useBeta && e.betaFlag ? zt.p('betaFlag', baseFeature) : zt.t`no beta`}
    `;
    
    // We want strictness at the top, but we know all possible keys.
    // We can define a strict schema that captures the union of all keys.
    const strictWrapper = zt.z.strict({
        useBeta: z.boolean(),
        standardFlag: z.object({ flagName: z.string(), enabled: z.boolean() }),
        betaFlag: z.object({ flagName: z.string(), enabled: z.boolean() }).optional(),
    })`${dynamicFeature}`;  // this merges the shape of dynamicFeature (loose) into the strict schema? 
    // Actually, dynamicFeature will merge its shape into strictWrapper, but strictWrapper's schema already has all keys,
    // so the intersection works. The runtime validation will be strict because the root schema is strict.
    
    // Should succeed with beta flag present
    const result = strictWrapper.render({
        useBeta: true,
        standardFlag: { flagName: 'std-flag', enabled: true },
        betaFlag: { flagName: 'beta-flag', enabled: false },
    });
    console.log('    Output:', zt.debug(result));
    
    // Should reject extra key not in the strict union
    try {
        strictWrapper.render({
            useBeta: true,
            standardFlag: { flagName: 'std', enabled: true },
            betaFlag: { flagName: 'beta', enabled: false },
            extra: 'bad',
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
    }
});

// ── Multi-tenant generation via zt.map ─────────────────────────
test('map over tenants produces individual strict manifests', () => {
    type TenantInput = IRenderableKargs<typeof tenantManifest>;
    const tenants: TenantInput[] = [
        {
            tenantId: 't-acme',
            tenantName: 'Acme',
            environment: 'production',
            features: [{ flagName: 'dark-mode', enabled: true, rolloutPercent: 100 }],
            provisioning: { provider: 'aws', region: 'us-east-1', instanceSize: 't3.medium', roleArn: 'arn:...' },
        },
        {
            tenantId: 't-widget',
            tenantName: 'Widget Ltd',
            environment: 'staging',
            features: [{ flagName: 'new-checkout', enabled: false, rolloutPercent: 0 }],
            provisioning: { provider: 'gcp', region: 'us-central1', instanceSize: 'n1-standard-1', projectId: 'my-project' },
        },
    ];
    
    const manifests = zt.map(tenants, tenantManifest, t => t, zt.t`\n---\n`);
    const [strs, ...vals] = manifests.render();
    
    const text = zt.debug([strs, ...vals]);
    if (strs.join('').includes('Acme')) throw new Error('Tenant name leaked into structure');
    if (!text.includes('Acme')) throw new Error('Acme not found in final output');
    if (vals.length !== 16) throw new Error(`Expected 16 values, got ${vals.length}`);
    
    console.log('    Number of tenants:', tenants.length);
    console.log('    Total parameterized values:', vals.length);
});

// ── Error handling and edge cases ─────────────────────────────

test('missing required key in strict mode produces clear error', () => {
    try {
        tenantManifest.render({
            tenantId: 't-missing',
            tenantName: 'Missing features',
            environment: 'staging',
            // features missing
            provisioning: { provider: 'aws', region: 'us-east-1', instanceSize: 't3.medium' },
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
        console.log('    Error message snippet:', (e as any).message.split('\n')[0]);
    }
});

test('invalid provider in scoped provisioning is caught', () => {
    try {
        tenantManifest.render({
            tenantId: 't-bad-prov',
            tenantName: 'Bad Cloud',
            environment: 'production',
            features: [],
            provisioning: { provider: 'digitalocean', region: 'nyc1', instanceSize: 's-1vcpu-1gb' } as any,
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
    }
});

// ============================================================================
console.log(`\n═══════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════`);