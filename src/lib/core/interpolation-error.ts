import { ZodType } from "zod";
import { type IZodTagRenderable, type IRenderable } from "./renderable";
import { filterStackTrace, getTemplateSource } from "./source";

const join = (str: unknown[]) => str.join('\n')

export type InterpolationOperation = 'root-schema' | 'karg-schema' | 'renderable' | 'selector'

type InterpolationErrorCause = {
    error: unknown,
    trace: { template: string, preview: string }[]
}

export class InterpolationError extends Error {
    #error: unknown;
    get error() { return this.#error }

    private constructor(message: string, options: { stack: string, cause: InterpolationErrorCause }) {
        const { error, trace } = (options?.cause ?? {}) as any;
        super(message, { cause: { trace, error } })
        this.stack = options?.stack ?? super.stack;
        this.#error = error;
    }

    static format = (raw: string[], start = 0) => {
        return String.raw({ raw }, ...Array.from({ length: raw.length - 1 }, (_, j) => `\${values[${start + j}]}`));
    }

    static for(exception: unknown, context: {
        value: any,
        index: number,
        strings: string[],
        renderer: IRenderable<any, any>,
        op: InterpolationOperation,
    }) {
        const _e = exception as any
        const {
            op,
            index: i,
            value: _value,
            strings
        } = context;
        const renderer = context.renderer as any as IZodTagRenderable
        const schemaType = (_value as ZodType)?._zod?.def?.type;

        let valueType = schemaType ? `${op}(${schemaType})` : op;
        let operationMessage = '';
        switch (op) {
            case 'root-schema':
                operationMessage += `Keyword error (root)`
                break;
            case 'karg-schema':
                operationMessage += `Keyword error`
                break;
            case 'renderable':
                operationMessage += `Renderable error`
                break;
            case 'selector':
                operationMessage += `Selector value error`
                valueType = _value.name ? `${op}(${_value?.name})` : 'anonymous-fn';
                break;
        }
        const scope = _value?.__ztScope || renderer.scope;
        if (scope) operationMessage += ` at scope "${scope.join('.')}"`
        const operation = `${valueType}[${i}]`

        const before = InterpolationError.format(strings.slice(0, i + 1), 0);
        const after = InterpolationError.format(strings.slice(i + 1), strings.length - i + 2);
        const preview = before.slice(-80) + '${>>>>   ERROR(' + operation + ')   <<<<}' + after.slice(0, 80);

        const template = getTemplateSource(renderer)?.stack || ''
        const trace = join(filterStackTrace(new Error().stack))


        const cause = {
            trace: [{ op, operation, operationMessage, message: _e?.message, template, preview }],
            error: null as unknown,
        }

        if (_e?.cause?.trace) {
            cause.trace.unshift(..._e?.cause?.trace)
            cause.error = _e?.cause?.error
        } else {
            const rootStack = filterStackTrace(_e.stack).filter(v => !trace.includes(v)).concat(
                cause.trace[0].template
            );
            cause.trace[0].template = join(rootStack)
            cause.error = _e
        }

        const stack = cause.trace.map((e) => e.template)
        const rootCause = cause.trace.at(0)

        const message = `${operation} > ${_e.message}`
        const traceMessage =
            `InterpolationError: ${rootCause?.operationMessage} at operation ${rootCause?.operation} with message: ${rootCause?.message}

Caused by template ${rootCause?.template.trim()}

--- PREVIEW ---
${rootCause?.preview}

Error triggered in callsite ${trace?.trim()}

--- TRACE ---:
${message}

`;

        const finalStackTrace = join([
            traceMessage,
            ...stack, trace, '\n'
        ])
        const error = new InterpolationError(message, { cause, stack: finalStackTrace });

        return error;
    }
}