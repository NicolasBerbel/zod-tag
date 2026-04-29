import { z } from 'zod'
import { zt } from '../../../dist/main.js'

// ------------------------------------------------------------------
// Reusable sub‑templates
// ------------------------------------------------------------------

// Persona block – sets the reviewer’s "voice"
const personaBlock = zt.z({
    persona: z.enum(['senior-dev', 'mentor', 'pedantic-reviewer']).default('mentor')
})`
${(ctx) => {
        // Dont mistake these aren't zod tag IRenderable's they're strings, processed in the values array
        switch (ctx.persona) {
            case 'senior-dev':
                // Strings are primitives, when returned by selectors they become values
                return `Act as a senior software engineer with 15 years of experience.`
            case 'mentor':
                return `Act as a supportive coding mentor who explains the *why* behind each suggestion.`
            case 'pedantic-reviewer':
                return `Act as a strictly pedantic reviewer who flags every deviation from best practices, no matter how minor.`
        }
    }}
`

/** Recommended approach */
const _personaBlock = zt.match('persona', {
    none: zt.empty,
    // These literal strings strings on zod tag templates:
    // These are zod tag IRenderable's processed in the renderable render loop array
    'senior-dev': zt.z({ xp: z.number().positive().min(10) })`Act as a senior software engineer with ${e => e.xp} years of experience.`,
    'mentor': zt.t`Act as a supportive coding mentor who explains the *why* behind each suggestion.`,
    'pedantic-reviewer': zt.t`Act as a strictly pedantic reviewer who flags every deviation from best practices, no matter how minor.`,
})
// zt.empty
const identity = zt.bind(_personaBlock, { persona: 'none' })

const reviewer = zt.bind(_personaBlock, { persona: 'pedantic-reviewer' })
const senior20 = zt.bind(_personaBlock, { persona: 'senior-dev', xp: 15 })
const senior10 = zt.bind(_personaBlock, { persona: 'senior-dev', xp: 10 })

// type bindPartial = () => IRenderable
try {
    // @ts-expect-error xp should be number
    const _senior = zt.bind(_personaBlock, { persona: 'senior-dev', xp: 'string' })
    throw new Error('persona should be validated by zt.match branch validation')
} catch (e) { /* Expected */ }

console.log(
    { _personaBlock: zt.debug(identity.render()) }
);

_personaBlock.render({
    persona: 'none'
})

// Output format directive
const outputFormatBlock = zt.z({
    format: z.enum(['diff', 'bullets', 'checklist']).default('bullets')
})`
${(ctx) => {
        const instructions = {
            diff: `Output your review as a unified diff patch with inline comments.`,
            bullets: `Output your review as a bulleted list grouped by severity.`,
            checklist: `Output your review as a markdown checklist that can be ticked off.`,
        }
        return `\n[Format]: ${instructions[ctx.format]}\n`
    }}
`

// Severity level – influences how aggressive the feedback is
const severityBlock = zt.z({
    severity: z.enum(['gentle', 'strict', 'nitpicky']).default('gentle')
})`
${(ctx) => {
        const modifiers = {
            gentle: `Focus only on impactful issues. Prefer positive reinforcement.`,
            strict: `Flag all issues that could lead to bugs, performance problems, or maintainability concerns.`,
            nitpicky: `Flag even stylistic inconsistencies, naming conventions, and cosmetic issues.`
        }
        return `[Severity level]: ${ctx.severity.toUpperCase()}. ${modifiers[ctx.severity]}\n`
    }}
`

// Focus areas – an array that must contain specific allowed values
const focusAreasSchema = z.array(
    z.enum(['security', 'performance', 'readability', 'testing', 'architecture'])
).min(1).default(['readability', 'performance'])

const focusAreasBlock = zt.z({
    focusAreas: focusAreasSchema
})`
[Focus areas]: ${(ctx) => ctx.focusAreas.join(', ')}.
Only comment on issues related to these domains unless a critical bug is found.
`
// ------------------------------------------------------------------
// Main prompt template
// ------------------------------------------------------------------
const codeReviewPrompt = zt.z({
    language: z.string().min(1).describe('The programming language of the code'),
    code: z.string().min(1).describe('The source code to review'),
})`
[System]
You are an automated code review assistant.

${personaBlock}
${outputFormatBlock}
${severityBlock}
${focusAreasBlock}

The following ${(ctx) => ctx.language} code was submitted for review.
Provide actionable, constructive feedback.

---
[Code]
${(ctx) => ctx.code}
`
const interpolation = codeReviewPrompt.render({
    language: 'TypeScript',
    code: `
    function add(a, b) { return a + b }
  `,
    persona: 'pedantic-reviewer',
    format: 'diff',
    severity: 'gentle',
    focusAreas: ['readability', 'performance', 'architecture'],
})

console.log(zt.debug(interpolation));

// >
`
[System]
You are an automated code review assistant.


Act as a strictly pedantic reviewer who flags every deviation from best practices, no matter how minor.



[Format]: Output your review as a unified diff patch with inline comments.



[Severity level]: GENTLE. Focus only on impactful issues. Prefer positive reinforcement.



[Focus areas]: readability, performance, architecture.
Only comment on issues related to these domains unless a critical bug is found.


The following TypeScript code was submitted for review.
Provide actionable, constructive feedback.

---
[Code]

    function add(a, b) { return a + b }
  
`