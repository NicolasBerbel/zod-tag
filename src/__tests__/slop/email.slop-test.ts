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
// 3. Order items list – uses variadic arguments for line items
// ----------------------------------------------------------------------
const itemSchema = z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
});

const orderItems = zt.t`
Your order contains:
${itemSchema.array().min(1).describe('items')}
`;

// Inside the template we use a function that receives the validated array
// and formats each line. The function returns a string, but it could also
// return another renderable.

// Wait – the above won't work because `itemSchema.array()` is a Zod schema,
// so it will be treated as a variadic argument expecting an array.
// Let's refine:

const orderItemsList = zt.t`
${zt.p(
    'items',
    z.array(itemSchema).min(1),
    (items) => {
        // Transform the array into a formatted string
        const lines = items.map(
            (item, i) => `${i + 1}. ${item.name} - ${item.quantity} x $${item.price.toFixed(2)}`
        );
        return lines.join('\n');
    }
)}

`;

// Better: use a selector function that returns a string.

// ----------------------------------------------------------------------
// 4. Shipping address – another named parameter block
// ----------------------------------------------------------------------
const addressSchema = z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
    country: z.string(),
});

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


${() => additionalNote}
`;

// ----------------------------------------------------------------------
// 5. Aditional note – demonstrates variadic argument
// ----------------------------------------------------------------------
const additionalNote = zt.t`
Note: ${z.string()}
Note2: ${z.string()}

`;

// ----------------------------------------------------------------------
// 6. Compose the full email template
// ----------------------------------------------------------------------
export const orderConfirmationEmail = zt.t`
${header}

${greeting}

Thank you for your order!

${orderItemsList}

${shippingInfo}

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
    const rendered = orderConfirmationEmail.render(emailData, ['Additional note content', 'Second note content'])

    const finalTemplate = zt.debug(rendered)

    console.log(finalTemplate)
}


try {

    renderEmail()
} catch(e) {
    console.log(e)
}