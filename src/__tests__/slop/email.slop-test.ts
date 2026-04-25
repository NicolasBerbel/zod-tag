import { z } from 'zod';
import { zt, type IRenderableKargs } from '../../../dist/main.js';

// ----------------------------------------------------------------------
// 1. Static header / footer (no arguments)
// ----------------------------------------------------------------------
const header = zt.z({
    storeTitle: z.string(),
    headerTitle: z.string(),
})`
========================================
   ${(ctx) => ctx.storeTitle} - ${(ctx) => ctx.headerTitle}
========================================
`;

const footer = zt.t`
========================================
 Thank you for shopping with us!
 Questions? Reply to ${zt.p('supportEmail', z.email())}
========================================
`;

// ----------------------------------------------------------------------
// 2. Customer greeting – requires a name (keyword argument)
// ----------------------------------------------------------------------
const greeting = zt.z({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
})`
Dear ${(ctx) => `${ctx.firstName} ${ctx.lastName}`},
`;

// ----------------------------------------------------------------------
// 3. Order items list
// ----------------------------------------------------------------------
const itemSchema = z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
});

// Inside the template we use a function that receives the validated array
// and formats each line. The function returns a string, but it could also
// return another renderable if we wanted to append structural content.

const itemsParam = zt.p(
    'items',
    z.array(itemSchema).min(1),
    (items) => {
        // Transform the array into a formatted string
        const lines = items.map(
            (item, i) => `${i + 1}. ${item.name} - ${item.quantity} x $${item.price.toFixed(2)}`
        );
        return lines.join('\n');
    }
)

type ItemsOutput = z.output<typeof itemsParam>

const orderItemsList = zt.t`
${itemsParam}

`;

// Better: use a selector function that returns a string.

// ----------------------------------------------------------------------
// 4. Shipping address – another named parameter block
// ----------------------------------------------------------------------
const addressSchema = z.object({
    street: z.string(),
    city: z.string().transform(e => e.toUpperCase()),
    zip: z.string(),
    country: z.string(),
});

// ----------------------------------------------------------------------
// 5. Aditional note – demonstrates zt.p and inner selectors
// ----------------------------------------------------------------------
const additionalNote = zt.t`
    ${zt.p('note', z.string(), note => zt.if(note, zt.t`Note: ${note}`))}
    ${zt.p('note2', z.string(), note => zt.if(note, zt.t`Note2: ${note}`))}
    ${zt.p('additionalNotes', z.array(z.string()))}
    ${() => () => () => zt.z({ returnedProp: z.string().optional() })`asd ${e => e.returnedProp || zt.t``}`}
    ${() => zt.t`Void`}
`;

const shippingInfo = zt.z({
    address: addressSchema,
    method: z.enum(['Standard', 'Express']),
})`
---- SHIPING ----

Shipping Method: ${(ctx) => ctx.method}
Shipping Address:
  ${(ctx) => ctx.address.street}
  ${(ctx) => ctx.address.city}, ${(ctx) => ctx.address.zip}
  ${(ctx) => ctx.address.country}

    ${zt.p('extra', additionalNote)}
`;


// ----------------------------------------------------------------------
// 6. Compose the full email template
// ----------------------------------------------------------------------
export const orderConfirmationEmail = zt.t`
${header}

${greeting}

Thank you for your order!

${orderItemsList}

${(e: IRenderableKargs<typeof shippingInfo>) => e.address ? zt.t`[shipping address] ${e.address.city} < warning e.address.city is not validated yet` : zt.t``}
${shippingInfo}
${(e: IRenderableKargs<typeof shippingInfo>) => e.address ? zt.t`[shipping address] ${e.address.city} < after shippingInfo e.address.city is still not validated yet` : zt.t``}

${footer}
`;

type EmailData = IRenderableKargs<typeof orderConfirmationEmail>

const emailData = {
    supportEmail: 'support@acme.test',
    storeTitle: 'ACME STORE',
    headerTitle: 'ORDER CONFIRMATION',
    // For greeting
    firstName: 'Jane',
    lastName: 'Smith',
    
    extra: {
        additionalNotes: [],
        note: '',
        note2: '',
        returnedProp: 'returnedProp'
    },

    // For order items
    items: [
        { name: 'Wireless Mouse', quantity: 1, price: 29.99 },
        { name: 'Mechanical Keyboard', quantity: 1, price: 89.99 },
        { name: 'USB-C Hub', quantity: 2, price: 45.50 },
    ],

    // For shipping info
    address: {
        street: '123 Main St',
        city: 'Springfield',
        zip: '62701',
        country: 'USA',
    },
    method: 'Express'
} satisfies EmailData

function renderEmail() {
    // const rendered = orderConfirmationEmail.render(emailData, ['Additional note'])
    const rendered = orderConfirmationEmail.render(emailData)

    const finalTemplate = zt.debug(rendered)

    console.log(finalTemplate)
}


try {

    renderEmail()
} catch (e) {
    console.log(e)
}