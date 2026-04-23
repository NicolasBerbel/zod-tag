import { z } from 'zod'
import { zt } from '../../../dist/main.js'

// ----------------------------------------------------------------
// 1. Reusable building blocks
// ----------------------------------------------------------------

// Tone modifier – a tiny template that conditionally renders a sentence
const toneModifier = zt.z({
  tone: z.enum(['formal', 'casual', 'academic']).default('formal')
})`
${(ctx) => {
  switch (ctx.tone) {
    case 'casual':
      return `Keep your language relaxed and friendly, as if chatting with a colleague.\n`
    case 'academic':
      return `Use a scholarly tone with precise terminology and citations where appropriate.\n`
    default:
      return `Maintain a professional and polished tone.\n`
  }
}}`

// Expertise adapter – produces tailored instructions for the AI
const expertiseAdapter = zt.z({
  expertise: z
    .enum(['expert', 'professional', 'hobbyist', 'beginner', 'explain-like-im-5'])
    .default('professional')
})`
${(ctx) => {
  const map = {
    expert:     'Assume the audience has deep domain knowledge. You may skip fundamentals.',
    professional:'Assume a competent working knowledge. Define advanced terms briefly.',
    hobbyist:   'Assume enthusiasm but incomplete knowledge. Explain concepts thoroughly.',
    beginner:   'Assume no prior knowledge. Build understanding from the ground up.',
    'explain-like-im-5': 'Explain every concept using simple analogies a child would understand.',
  }
  return `\n[Audience level: ${ctx.expertise}. ${map[ctx.expertise]}]\n`
}}`

// ----------------------------------------------------------------
// 2. Main prompt template – composes the blocks
// ----------------------------------------------------------------
const technicalExplanationPrompt = zt.z({
  topic: z.string().min(5, 'Topic must be at least 5 characters'),
  context: z.string().optional().default(''),
})`
[System]
You are a knowledgeable technical explainer.

${toneModifier}
${expertiseAdapter}
When answering, structure your response with:
- A brief overview
- Key concepts explained
- Practical examples if helpful

${(ctx) => ctx.context ? `\nAdditional context: ${ctx.context}\n` : ''}
---

[User Question]
Please explain: ${(ctx) => ctx.topic}
`

// ----------------------------------------------------------------
// 3. Rendering a prompt
// ----------------------------------------------------------------
const promptInterpolation = technicalExplanationPrompt.render({
  topic: 'How do TypeScript template literal types work?',
  tone: 'academic',                     // inferred as 'formal' | 'casual' | 'academic'
  expertise: 'professional',             // inferred as the enum values
  context: 'The reader has basic TypeScript experience.',
})

// Convert to actual prompt string
const finalPrompt = zt.debug(promptInterpolation)
console.log(finalPrompt)