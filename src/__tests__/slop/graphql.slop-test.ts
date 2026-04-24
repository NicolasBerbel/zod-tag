import { z } from 'zod';
import { zt, type IRenderableKargs } from '../../../dist/main.js';

/**
 * GraphQL Template Examples - Type-Safe Query Building
 * 
 * Demonstrates composable GraphQL fragments and queries with
 * automatic schema merging and type inference.
 */

// =====================================================================
// 1. BASIC FRAGMENTS - Reusable field selections
// =====================================================================

/**
 * Fragment: UserBase
 * Core user fields needed in multiple queries
 */
const userBaseFragment = zt.t`
fragment UserBase on User {
  id
  name
  email
  createdAt
}
`;

/**
 * Fragment: UserProfile
 * Extended user profile information
 */
const userProfileFragment = zt.z({
    includeRole: z.boolean().default(true),
})`
fragment UserProfile on User {
  ...UserBase
  ${(ctx) => ctx.includeRole ? zt.t`role
  ` : zt.t``}avatar
  bio
  website
}
`;

/**
 * Fragment: Post
 * Blog post structure with author reference
 */
const postFragment = zt.t`
fragment PostFields on Post {
  id
  title
  content
  slug
  publishedAt
  updatedAt
  author {
    ...UserBase
  }
}
`;

/**
 * Fragment: Comment
 * Comment structure with nested author
 */
const commentFragment = zt.t`
fragment CommentFields on Comment {
  id
  body
  createdAt
  author {
    id
    name
    avatar
  }
}
`;

// =====================================================================
// 2. SIMPLE QUERIES
// =====================================================================

/**
 * Query: GetUser - Fetch a single user by ID
 */
const getUser = zt.z({
    userId: z.uuid(),
})`
query GetUser($id: ID!) {
  user(id: $id) {
    ...UserProfile
  }
}

${userProfileFragment}
${userBaseFragment}
`;

/**
 * Query: ListUsers - Fetch users with pagination
 */
const listUsers = zt.z({
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    role: z.enum(['admin', 'user', 'guest']).optional(),
})`
query ListUsers($first: Int!, $offset: Int!, $role: Role) {
  users(first: $first, offset: $offset, role: $role) {
    edges {
      node {
        ...UserBase
        role
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      totalCount
    }
  }
}

${userBaseFragment}
`;

/**
 * Query: GetPost - Fetch a post with comments and author
 */
const getPost = zt.z({
    postId: z.uuid(),
    includeComments: z.boolean().default(true),
})`
query GetPost($id: ID!) {
  post(id: $id) {
    ...PostFields
    ${(ctx) => ctx.includeComments ? zt.t`
    comments {
      ...CommentFields
    }` : zt.t``}
  }
}

${postFragment}
${commentFragment}
${userBaseFragment}
`;

// =====================================================================
// 3. MUTATIONS
// =====================================================================

/**
 * Mutation: CreateUser - Register a new user
 */
const createUser = zt.z({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'user']).default('user'),
})`
mutation CreateUser($name: String!, $email: String!, $password: String!, $role: Role!) {
  createUser(input: {name: $name, email: $email, password: $password, role: $role}) {
    user {
      ...UserProfile
    }
    token
    errors {
      field
      message
    }
  }
}

${userProfileFragment}
${userBaseFragment}
`;

/**
 * Mutation: UpdateUser - Update user profile
 */
const updateUser = zt.z({
    userId: z.uuid(),
    name: z.string().min(1).max(255).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
})`
mutation UpdateUser($id: ID!, $name: String, $bio: String, $avatar: String) {
  updateUser(id: $id, input: {name: $name, bio: $bio, avatar: $avatar}) {
    user {
      ...UserProfile
    }
  }
}

${userProfileFragment}
${userBaseFragment}
`;

/**
 * Mutation: PublishPost - Create and publish a new post
 */
const publishPost = zt.z({
    title: z.string().min(3).max(255),
    content: z.string().min(10),
    slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
    draft: z.boolean().default(false),
})`
mutation PublishPost($title: String!, $content: String!, $slug: String!, $draft: Boolean) {
  createPost(input: {title: $title, content: $content, slug: $slug, draft: $draft}) {
    post {
      ...PostFields
    }
    errors {
      field
      message
    }
  }
}

${postFragment}
${userBaseFragment}
`;

/**
 * Mutation: DeletePost - Remove a post
 */
const deletePost = zt.z({
    postId: z.uuid(),
})`
mutation DeletePost($id: ID!) {
  deletePost(id: ${e => e.postId}) {
    success
    message
  }
}
`;

// =====================================================================
// 4. COMPLEX NESTED QUERIES
// =====================================================================

/**
 * Query: GetUserTimeline - User with posts and their comments
 */
const getUserTimeline = zt.z({
    userId: z.uuid(),
    postLimit: z.number().int().positive().default(10),
    commentLimit: z.number().int().positive().default(5),
})`
query GetUserTimeline($userId: ID!, $postLimit: Int!, $commentLimit: Int!) {
  user(id: $userId) {
    ...UserProfile
    posts(first: $postLimit) {
      edges {
        node {
          id
          title
          slug
          publishedAt
          comments(first: $commentLimit) {
            ...CommentFields
          }
        }
      }
    }
  }
}

${userProfileFragment}
${commentFragment}
${userBaseFragment}
`;

/**
 * Query: SearchPostsAndUsers - Combined search across multiple types
 */
const searchPostsAndUsers = zt.z({
    query: z.string().min(1).max(100),
    postLimit: z.number().int().positive().default(5),
    userLimit: z.number().int().positive().default(5),
})`
query Search($searchQuery: String!, $postFirst: Int!, $userFirst: Int!) {
  searchPosts(query: $searchQuery, first: $postFirst) {
    edges {
      node {
        ...PostFields
      }
    }
  }
  searchUsers(query: $searchQuery, first: $userFirst) {
    edges {
      node {
        ...UserBase
      }
    }
  }
}

${postFragment}
${userBaseFragment}
`;

// =====================================================================
// 5. DYNAMIC FIELD SELECTION (inline parameter)
// =====================================================================

/**
 * Query: GetUserWithDynamicFields - Select specific user fields
 */
const getUserWithFields = zt.z({
    userId: z.uuid(),
})`
query GetUser($id: ID!) {
  user(id: ${e => e.userId}) {
    id
    ${zt.p(
        'fields',
        z.array(z.enum(['name', 'email', 'role', 'avatar', 'bio', 'website', 'createdAt'])).min(1),
        (fields) => zt.unsafe(z.string(), fields.join('\n    '))
    )}
  }
}
`;

// =====================================================================
// TYPE INFERENCE EXAMPLES
// =====================================================================

type GetUserParams = IRenderableKargs<typeof getUser>;
type ListUsersParams = IRenderableKargs<typeof listUsers>;
type CreateUserParams = IRenderableKargs<typeof createUser>;
type GetUserTimelineParams = IRenderableKargs<typeof getUserTimeline>;
type SearchPostsAndUsersParams = IRenderableKargs<typeof searchPostsAndUsers>;

// =====================================================================
// RENDERING EXAMPLES
// =====================================================================

function renderExamples() {
    console.log('\n========== GraphQL Query Examples ==========\n');

    // Example 1: Simple Query
    {
        const rendered = getUser.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
            includeRole: true,
        });
        const query = zt.debug(rendered);
        console.log('1. GET USER:');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 2: List with Pagination and Filter
    {
        const rendered = listUsers.render({
            limit: 20,
            offset: 0,
            role: 'admin',
        });
        const query = zt.debug(rendered);
        console.log('2. LIST USERS (Admin only):');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 3: Mutation - Create User
    {
        const rendered = createUser.render({
            name: 'Jane Smith',
            email: 'jane@example.com',
            password: 'SecurePass123!',
            role: 'user',
        });
        const query = zt.debug(rendered);
        console.log('3. CREATE USER:');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 4: Complex Nested Query
    {
        const rendered = getUserTimeline.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
            postLimit: 5,
            commentLimit: 3,
        });
        const query = zt.debug(rendered);
        console.log('4. GET USER TIMELINE (with posts & comments):');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 5: Mutation - Update User
    {
        const rendered = updateUser.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Jane Doe',
            bio: 'A passionate developer',
            avatar: 'https://example.com/avatar.jpg',
        });
        const query = zt.debug(rendered);
        console.log('5. UPDATE USER PROFILE:');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 6: Dynamic Field Selection
    {
        const rendered = getUserWithFields.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
            fields: ['name', 'email', 'avatar'],
        });
        const query = zt.debug(rendered);
        console.log('6. GET USER (Dynamic Fields):');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 7: Complex Search
    {
        const rendered = searchPostsAndUsers.render({
            query: 'TypeScript',
            postLimit: 10,
            userLimit: 5,
        });
        const query = zt.debug(rendered);
        console.log('7. SEARCH (Posts & Users):');
        console.log(query);
        console.log('\n---\n');
    }

    // Example 8: Mutation - Publish Post
    {
        const rendered = publishPost.render({
            title: 'Getting Started with GraphQL',
            content: 'GraphQL is a query language for APIs that provides a complete and understandable description of the data in your API...',
            slug: 'getting-started-graphql',
            draft: false,
        });
        const query = zt.debug(rendered);
        console.log('8. PUBLISH POST:');
        console.log(query);
        console.log('\n---\n');
    }
}

// =====================================================================
// VALIDATION EXAMPLES
// =====================================================================

function demonstrateValidation() {
    console.log('\n========== VALIDATION EXAMPLES ==========\n');

    // Valid
    try {
        const rendered = createUser.render({
            name: 'Valid User',
            email: 'valid@example.com',
            password: 'SecurePass123!',
            role: 'user',
        });
        console.log('✓ Valid user creation renders successfully');
    } catch (err) {
        console.error('✗ Unexpected error:', err);
    }

    // Invalid email
    try {
        const rendered = createUser.render({
            name: 'Invalid User',
            email: 'not-an-email',
            password: 'SecurePass123!',
            role: 'user',
        });
    } catch (err) {
        console.log('✓ Invalid email caught at validation time');
    }

    // Invalid slug format
    try {
        const rendered = publishPost.render({
            title: 'Valid Title',
            content: 'This is a valid long enough content for the post.',
            slug: 'Invalid Slug With Spaces', // Invalid format
            draft: false,
        });
    } catch (err) {
        console.log('✓ Invalid slug format caught at validation time');
    }

    // Invalid UUID
    try {
        const rendered = getUser.render({
            userId: 'not-a-uuid',
            includeRole: true,
        });
    } catch (err) {
        console.log('✓ Invalid UUID caught at validation time');
    }

    // Invalid role
    try {
        const rendered = createUser.render({
            name: 'User',
            email: 'user@example.com',
            password: 'SecurePass123!',
            role: 'superadmin' as any,
        });
    } catch (err) {
        console.log('✓ Invalid role caught at validation time');
    }
}

// =====================================================================
// TYPE SAFETY DEMONSTRATION
// =====================================================================

function demonstrateTypeSafety() {
    console.log('\n========== TYPE SAFETY EXAMPLES ==========\n');

    // Correctly typed parameters
    const userParams: GetUserParams = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
    };
    console.log('✓ GetUserParams correctly typed');

    // Correctly typed complex query
    const timelineParams: GetUserTimelineParams = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        postLimit: 10,
        commentLimit: 5,
    };
    console.log('✓ GetUserTimelineParams correctly typed');

    // Type checking at compile time
    const searchParams: SearchPostsAndUsersParams = {
        query: 'TypeScript',
        postLimit: 5,
        userLimit: 5,
    };
    console.log('✓ SearchPostsAndUsersParams correctly typed');
}

// =====================================================================
// BEST PRACTICES
// =====================================================================

function demonstrateBestPractices() {
    console.log('\n========== BEST PRACTICES ==========\n');

    console.log('1. FRAGMENT REUSE:');
    console.log('   - Define fragments for commonly selected fields');
    console.log('   - Compose complex queries from fragments');
    console.log('   - Reduces duplication and improves maintainability\n');

    console.log('2. SCHEMA VALIDATION:');
    console.log('   - Use Zod schemas to validate query parameters');
    console.log('   - Catch invalid inputs before sending queries');
    console.log('   - Enable IDE autocomplete for parameters\n');

    console.log('3. TYPE INFERENCE:');
    console.log('   - Leverage IRenderableKargs for type safety');
    console.log('   - Extract parameter types for reuse');
    console.log('   - Avoid casting with `as any`\n');

    console.log('4. DYNAMIC FIELD SELECTION:');
    console.log('   - Use zt.p() for flexible field selection');
    console.log('   - Validate field names against Zod enums');
    console.log('   - Keep selections within reason (1-10 fields)\n');

    console.log('5. CONDITIONAL FIELDS:');
    console.log('   - Use selector functions for conditional rendering');
    console.log('   - Example: ${(ctx) => ctx.includeComments ? comments : ""}');
    console.log('   - Keeps queries clean and readable\n');
}

// =====================================================================
// RUN EXAMPLES
// =====================================================================

renderExamples();
demonstrateValidation();
demonstrateTypeSafety();
demonstrateBestPractices();

console.log('\n========== KEY TAKEAWAYS ==========');
console.log('✓ Fragment composition reduces duplication');
console.log('✓ Zod schemas validate all query parameters');
console.log('✓ Type inference enables IDE support');
console.log('✓ Conditional rendering keeps queries flexible');
console.log('✓ Dynamic field selection for advanced use cases');
