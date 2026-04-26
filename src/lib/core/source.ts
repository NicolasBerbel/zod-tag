
export function filterStackTrace(stack?: string | null) {
    return (stack?.split('\n') || []).filter(line => {
        return !line.includes('node_modules/zod-tag') &&
            !line.includes('zod-tag/dist') &&
            !line.includes('node_modules') &&
            (line.includes('.ts') || line.includes('.js'))
    });
}

export function captureTemplateSource(): TemplateSource {
    return { stack: filterStackTrace(new Error().stack).join('\n') }
}

export interface TemplateSource {
    stack: string,
}

export function withSource<T extends object>(
    renderable: T,
): T {
    (renderable as any).__templateSource = captureTemplateSource();
    return renderable;
}

export function getTemplateSource(renderable: any) {
    let src = null;
    if (typeof renderable === 'object' && !!renderable) src = (renderable as any)?.__templateSource || null
    return src as TemplateSource | null;
}