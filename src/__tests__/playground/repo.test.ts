import z from "zod";
import { describe, it } from "node:test";
import { deepEqual } from "node:assert/strict";
import {
    type TagTypes,
    zt
} from "../../../dist/main.js";

const params = {
    select: zt.p(
        'select',
        z.array(
            z.string().trim().regex(/^\w+$/)
        ).min(1).default(['*']),
        e => zt.unsafe(z.string(), e.join(', '))
    ),

    orderBy: zt.p(
        'orderBy',
        z.object({
            column: z.string().optional(),
            order: z.enum(['ASC', 'DESC']).default('ASC')
        }).optional(),
        (q => {
            if (!q?.column) return zt.t``;
            return zt.t`ORDER BY ${q.column} ${zt.unsafe(z.enum(['ASC', 'DESC']), q.order)}`
        })),

    limit: zt.p(
        'limit',
        z.number().min(1).max(1000).default(1),
        limit => zt.t`LIMIT ${limit}`
    ),

}

class Repository {
    private readonly table: string;
    constructor(table: string) {
        this.table = table;
    }

    sql = <
        S extends z.ZodRawShape
    >(s: S) => {
        const t = zt.z(s)
        type Output = z.output<z.ZodObject<S>>
        const r =
            <
                L extends T,
                R extends T[],
                T extends TagTypes<Output>,
            >(str: TemplateStringsArray, ...vals: [L, ...R]) => {
                const i = t(str, ...vals)

                return (...args: Parameters<typeof i.render>) => {
                    const [karg] = args
                    const [queryStrings, ...queryArgs] = i.render(karg);

                    return {
                        get sql() {
                            return queryStrings.join('?');
                        },
                        get text() {
                            const rawQuery = String.raw({
                                raw: queryStrings,
                            }, ...Array.from({ length: queryArgs.length }, (_, i) => '$' + i));

                            return rawQuery;
                        },
                        args: queryArgs
                    }
                }
            }

        return r;
    }

    getById = this.sql({
        id: z.uuid()
    })`
            SELECT ${params.select}
            FROM ${() => zt.unsafe(z.string().regex(/^\w+$/), this.table)}
            ${params.orderBy}
            WHERE (id = ${e => e.id})
            ${params.limit}
        `
}


describe('Repository', () => {
    describe('Users', () => {
        const Users = new Repository('Users');
        it('getById', () => {
            const result = Users.getById({
                id: '653de00a-9708-4655-94ff-2e604934f3b6',
                select: ['id', 'name'],
                orderBy: {
                    column: 'created_at',
                    order: 'DESC'
                },
                limit: 50,
            })

            deepEqual({ ...result }, {
                sql: '\n            SELECT id, name\n            FROM Users\n            ORDER BY ? DESC\n            WHERE (id = ?)\n            LIMIT ?\n        ',
                text: '\n            SELECT id, name\n            FROM Users\n            ORDER BY $0 DESC\n            WHERE (id = $1)\n            LIMIT $2\n        ',
                args: ['created_at', '653de00a-9708-4655-94ff-2e604934f3b6', 50]
            }, 'test not implemented')
        })
    })
})
