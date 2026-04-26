
/**
 * Structural merging of two interpolations at index i
 * 
 * @param i Index of the source values array where the target values array items will be inserted and edge strings concatenated
 * @param targetS target strings (child interpolation)
 * @param targetV target values/substitutions (child interpolation)
 * @param sourceS source strings (parent interpolation)
 * @param sourceV source values/substitutions (parent interpolation)
 */
export function spliceInterpolation(i: number, targetS: string[], targetV: unknown[], sourceS: string[], sourceV: unknown[]) {
    targetS[i] += sourceS[0]
    targetV.splice(i, 1)
    if (sourceS.length > 1) {
        targetS[i + 1] = sourceS.at(-1) + targetS[i + 1]
        targetV.splice(i, 0, ...sourceV)
        targetS.splice(i + 1, 0, ...sourceS.slice(1, -1))
    } else if (sourceS.length === 1) {
        targetS[i] += targetS[i + 1]
        targetS.splice(i + 1, 1)
    }
}

